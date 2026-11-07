const mongoose = require('mongoose');
require('dotenv').config();
const Session = require('../models/Session');
const User = require('../models/User');

async function createTestSession() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await User.findOne({ email: 'valrein09@gmail.com' }).lean();
  console.log('User found:', user.name, user.email, user._id);

  const sessionId = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await Session.findOneAndUpdate({ _id: sessionId }, {
    _id: sessionId,
    expiresAt,
    data: {
      cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 },
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  }, { upsert: true });

  console.log('Test session created:', sessionId);
  await mongoose.disconnect();
}

createTestSession().catch(console.error);
