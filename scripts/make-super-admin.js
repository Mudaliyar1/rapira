require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Email and password from command line arguments
const email = process.argv[2] || 'vijaymudaliyar224@gmail.com';
const password = process.argv[3] || 'vijay123';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Find user by email
      let user = await User.findOne({ email });
      
      if (user) {
        console.log(`User found: ${user.name} (${user.email})`);
        
        // Update user role to admin
        user.role = 'admin';
        user.isAdmin = true;
        
        // Update password if provided
        if (password) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          user.password = hashedPassword;
          console.log('Password updated');
        }
        
        await user.save();
        console.log(`User ${user.email} has been made a super admin`);
      } else {
        console.log(`User with email ${email} not found`);
        console.log('Creating new super admin user...');
        
        // Create new admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newUser = new User({
          name: 'Super Admin',
          email,
          password: hashedPassword,
          role: 'admin',
          isAdmin: true
        });
        
        await newUser.save();
        console.log(`New super admin created with email: ${email}`);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
