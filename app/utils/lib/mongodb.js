/* eslint-disable new-cap */
const mongoose = require('mongoose');

function MongoClient() {
  this.options = {
    // useUnifiedTopology: true,
    // useFindAndModify: false,
    // useNewUrlParser: true, // Use the new URL parser
    // seNewUrlParser: true,
    useNewUrlParser: true, // Use the new URL parser
    useUnifiedTopology: true,
    connectTimeoutMS: 30000, // Increase the connection timeout to 30 seconds
    socketTimeoutMS: 30000,
  };
}

MongoClient.prototype.initialize = async function () {
  // console.log(process.env.DB_URL);
  mongoose
    .connect(process.env.DB_URL, this.options)
    .then(() => log.yellow('Database connected'))
    .catch(error => {
      throw error;
    });
};

MongoClient.prototype.mongify = function (id) {
  return mongoose.Types.ObjectId(id);
};

// mongoose.set('debug', (collectionName, methodName, query, updateQuery) => {
//     if (collectionName !== 'rummytables') return false;
//     if (methodName !== 'updateOne') return false;
//     log.cyan('const query = ', query);
//     log.cyan('const updateQuery', updateQuery);
//     log.cyan(`${collectionName}.${methodName}(query, updateQuery)`);
// });

module.exports = new MongoClient();
