const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const test = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB:', mongoose.connection.name);

    const user = await User.findOne({ email: 'admin@retailedge.co.ke' });
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    const match = await user.matchPassword('admin1234');
    console.log('Password "admin1234" matches?', match);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

test();
