const userModels = require('../models/users-models');
const packagesModels = require("../models/packages-models");
const formResponse = require('../helpers/form-response');

const dataUri = require('../middleware/multer').dataUri;
const uploader = require('../configs/cloudinaryConfig').uploader;

module.exports = {
  login: (req, res) => {
    const number = req.params.number;
    userModels.getUser(number)
    .then(result => {
      if(result.length){
        formResponse.success(res, 200, result[0])
      } else {
        // get date now + daysUntilExpired, expirationdate = 30days from registered
        var expDate = new Date();
        expDate.setDate(expDate.getDate() + 30);
        
        const data ={
          number: number,
          name: "Welcome",
          email: "",
          photo: "",
          alternateNumber: number,
          balance: 0,
          expirationDate: expDate,
          daysUntilExpired: 30,
          totalQuota:0,
          totalCall:0,
          totalSMS:0,
          remainingQuota: 0,
          remainingCall: 0,
          remainingSMS: 0,
          packages: []
        }   

        userModels.addUser(data)
        .then(result => {
          formResponse.success(res, 200, data)
        })
        .catch(error => {
          res.json(error)
        })
      }     
    })
  },

  test: (req, res) => {
    if(req.file){
      const file = dataUri(req).content;
      return uploader.upload(file).then((result) => {
        const image = result.url;
        return res.status(200).json({
          msg:'success',
          data:{
            image
          }
        })
      })
    }
  },

  getAllUsers: (req, res) => {
    userModels.getAllUsers()
    .then(result => {
      formResponse.success(res, 200, result)
    })
    .catch(error => {
      res.json(error)
    })
  },

  getUser: async (req, res) => { 
    const number = req.params.number;
    let user = await userModels.getUser(number)
    .then(result => {
      return result[0];
      
    })
    .catch(error => {
      res.json(error)
    })
    
    //check unlimited package
    let found = 0;
    user.packages.map(package => {
      package.packageItems.map(item => {
        if(item.value == -1){
          found = 1;
        }
      })
    })
    
    user = {
      ...user,
        unlimited:found
    }
    formResponse.success(res, 200, user)
  },
  
  buyPackage: async (req, res) => {
    const number = req.params.number;
    const packageID = req.body.packageID;
    
    const targetPackage = await packagesModels.getPackage(packageID)
    .then(result => {
      return result[0];
    })

    const user = await userModels.getUser(number)
    .then(result => {
      return result[0];
    })

    //check balance < price ?
    if(targetPackage.price >= user.balance){
      res.json({error:'Maaf, pulsa anda tidak mencukupi.'})
    } else {
      //pulsa cukup

      //reduce balance
      const newBalance = user.balance - targetPackage.price

      try {
        await userModels.setBalance(number, newBalance)
      } catch (error) {
        res.json(error);
      }
    

      const currentPackages = user.packages;
      let found = false;
      let currentPackage = {};
      await currentPackages.map(pack => {
        // (pack.id == packageID) ? found = true: null
        if(pack.id == packageID){
          found = true;
          currentPackage = pack;
        }
      })

      targetPackage.packageItems.map(item => {
        switch(item.type){
          case "internet" :
            if(item.value > 0){
              user.totalQuota += item.value;
              user.remainingQuota += item.remaining;
            }
            break;
          case "telpon":
            user.totalCall += item.value;
            user.remainingCall += item.remaining;
            break;
          case "sms":
            user.totalSMS += item.value;
            user.remainingSMS += item.remaining;
            break;
        }
      })
      const totalAndRemaining = {
        totalQuota:user.totalQuota,
        totalCall:user.totalCall,
        totalSMS:user.totalSMS,
        remainingQuota:user.remainingQuota,
        remainingCall:user.remainingCall,
        remainingSMS:user.remainingSMS
      }
      userModels.updateUser(number,totalAndRemaining)
  
      if(found){
        //add quota to existing package
        currentPackage.packageItems.map((item, index) => {
          if(currentPackage.packageItems[index].value > 0){
            currentPackage.packageItems[index].value += targetPackage.packageItems[index].value
          }
        })

        currentPackages.map(pack => {
          if(pack.id == currentPackage.id){
            pack = currentPackage;
          }
        })
        
        userModels.editPackage(number, currentPackages)
        .then(result => {
          formResponse.success(res, 200, currentPackages);
        })

      } else {
        //add new package
        await userModels.addPackage(number, targetPackage)
        .then(result => {
          formResponse.success(res, 200, targetPackage)
        })
      }
    }

  },

  removePackage: async (req, res) => {
    const number = req.params.number;
    const packageID = req.body.packageID;

    
    const user = await userModels.getUser(number)
    .then(result => {
      return result[0];
    })
    let targetPackage = {};
    user.packages.map(pack => {
      if(pack.id == packageID){
        targetPackage = pack
      }
    })
    
    targetPackage.packageItems.map(item => {
      switch(item.type){
        case "internet" :
          if(item.value > 0){
            user.totalQuota -= item.value;
            user.remainingQuota -= item.remaining;
          }
          break;
        case "telpon":
          user.totalCall -= item.value;
          user.remainingCall -= item.remaining;
          break;
        case "sms":
          user.totalSMS -= item.value;
          user.remainingSMS -= item.remaining;
          break;
      }
    })
    const totalAndRemaining = {
      totalQuota:user.totalQuota,
      totalCall:user.totalCall,
      totalSMS:user.totalSMS,
      remainingQuota:user.remainingQuota,
      remainingCall:user.remainingCall,
      remainingSMS:user.remainingSMS
    }
    userModels.updateUser(number,totalAndRemaining)

    userModels.removePackage(number, packageID)
    .then(result => {
      const data = {
        number,
        packageID
      }
      formResponse.success(res, 200, data)
    })
  },

  topUp: (req, res) => {
    const number = req.params.number;
    const amount = req.body.amount;

    userModels.getUser(number)
    .then(result => {
      return result[0].balance;
    })
    .then(result => {
      const balance = parseInt(result)+parseInt(amount);

      try {
        userModels.setBalance(number, balance)
        const data = {
          number,
          balance
        } 
        formResponse.success(res, 200, data)

      } catch (error) {
        res.json(error);
      }
    })   
    .catch(error => {
      res.json(error)
    })
  },

  shareBalance: (req, res) => {
    const number = req.params.number;
    const target = req.body.target;
    const amount = req.body.amount;

    userModels.getUser(number)
    .then(result => {
      return result[0].balance;
    })
    .then(result => {
      if(parseInt(result) <= parseInt(amount)){
        res.json({error:'Maaf, pulsa anda tidak cukup!'})
      } else {
        const balance = parseInt(result)-parseInt(amount);
        try {
          userModels.setBalance(number, balance)
        } catch (error) {
          res.json(error);
        }
        
        userModels.getUser(target)
        .then(result => {
          return result[0].balance;
        })
        .then(result => {
          const balance = parseInt(result)+parseInt(amount);
    
          try {
            userModels.setBalance(target, balance)
            const data = {
              number:target,
              balance
            } 
            formResponse.success(res, 200, data)
          } catch (error) {
            res.json(error);
          }
        })   
        .catch(error => {
          res.json(error)
        })
      }
      
    })   
    .catch(error => {
      res.json(error)
    })

  }
};
