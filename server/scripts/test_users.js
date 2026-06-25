const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const { getMongoUri } = require('../config/env');

const test = async () => {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--prod-safe')) {
    console.error('ERROR: Running test script in production is disabled unless --prod-safe is passed.');
    process.exit(1);
  }

  try {
    const mongoUri = getMongoUri();
    if (!mongoUri) {
      throw new Error('Mongo connection string is missing. Set MONGO_URI or MONGODB_URI.');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to DB:', mongoose.connection.name);

    const user = await User.findOne({ email: 'admin@retailedge.co.ke' });
    if (!user) {
      console.log('User not found!');
      return;
    }

    const match = await user.matchPassword('admin1234');
    console.log('Password "admin1234" matches?', match);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

test();
