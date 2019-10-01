const conn = require("../configs/db-config");

const userModels = {
  getAllUsers: () => {
    return new Promise((resolve, reject) => {
      result = conn().collection('users').find().toArray();
      resolve(result);
    })
  },

  getUser: number => {
    return new Promise((resolve, reject) => {
      result = conn()
        .collection("users")
        .find({ number: number })
        .toArray();

      resolve(result);
    });
  },

  addUser: data => {
    return new Promise((resolve, reject) => {
      result = conn().collection('users').insertOne(data)
      resolve(result);
    })  
  },

  setBalance: (number, amount) => {
    return new Promise((resolve, reject) => {
      result = conn().collection('users').updateOne({number:number}, {$set:{balance:amount}})
      resolve(result);
    })
  },

  addPackage: (number, package) => {
    return new Promise((resolve, reject) => {
      result = conn().collection('users').updateOne({number:number}, { $push:{packages:package}})
      resolve(result);
    })
  },

  editPackage: (number, package) => {
    return new Promise((resolve, reject) => {
      result = conn().collection('users').updateOne({number:number}, { $set:{packages:package}})
      resolve(result);
    })
  },
};

module.exports = userModels;
