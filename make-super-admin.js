require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function makeSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Super admin credentials
    const email = 'vijaymudaliyar224@gmail.com';
    const password = 'vijay123';
    const name = 'Vijay Mudaliyar';
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      // Update existing user
      user.role = 'superAdmin';
      await user.save();
      console.log(`User ${email} updated to Super Admin role`);
    } else {
      // Create new user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      user = new User({
        name,
        email,
        password: hashedPassword,
        role: 'superAdmin'
      });
      
      await user.save();
      console.log(`New Super Admin created: ${email}`);
    }
    
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error:', error);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect error
    }
  }
}

// Run the function
makeSuperAdmin();
