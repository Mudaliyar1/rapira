require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Super admin credentials
const email = 'vijaymudaliyar224@gmail.com';
const password = 'vijay123';
const name = 'Vijay Mudaliyar';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    createSuperAdmin();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function createSuperAdmin() {
  try {
    // Check if user with this email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // If user exists but is not a super admin, upgrade them
      if (existingUser.role !== 'superAdmin') {
        existingUser.role = 'superAdmin';
        await existingUser.save();
        console.log(`User ${email} upgraded to Super Admin successfully!`);
      } else {
        console.log(`User ${email} is already a Super Admin.`);
      }
    } else {
      // Create a new super admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        role: 'superAdmin'
      });

      await newUser.save();
      console.log(`Super Admin created successfully!`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log(`Name: ${name}`);
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error creating Super Admin:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}
