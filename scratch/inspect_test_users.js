const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({}, { name: 1, email: 1, role: 1 }).limit(10).lean();
  console.log('Sample Users in DB:', users);
  await mongoose.disconnect();
}

checkUsers().catch(console.error);

