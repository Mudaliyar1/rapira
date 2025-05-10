require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

const resetAdmin = async () => {
  try {
    // Delete existing admin user
    await User.deleteOne({ role: 'admin' });
    console.log('Existing admin user deleted');
    
    // Create new admin user
    const adminUser = new User({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@rapira.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@2025',
      role: 'admin'
    });
    
    await adminUser.save();
    
    console.log('Admin user reset successfully');
    console.log(`Email: ${adminUser.email}`);
    console.log(`Password: ${process.env.ADMIN_PASSWORD || 'Admin@2025'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting admin user:', error);
    process.exit(1);
  }
};

resetAdmin();
