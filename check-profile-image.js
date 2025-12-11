const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkProfileImage(email) {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('\n=== User Profile Image Info ===');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Profile Image:', user.profileImage || 'NOT SET');
    console.log('Profile Media ID:', user.profileMedia || 'NOT SET');
    
    if (user.profileImage) {
      console.log('\n✓ Profile image is set in database');
      console.log('URL:', user.profileImage);
    } else {
      console.log('\n✗ No profile image found in database');
      console.log('User will see generated avatar with initial:', user.name.charAt(0).toUpperCase());
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node check-profile-image.js <email>');
  console.log('Example: node check-profile-image.js user@example.com');
  process.exit(1);
}

checkProfileImage(email);
