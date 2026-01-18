const mongoose = require('mongoose');

async function connectToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    // If your Atlas connection string already includes a db name, you can omit this.
    dbName: process.env.MONGODB_DB || undefined
  });

  return mongoose;
}

module.exports = { connectToMongo };
