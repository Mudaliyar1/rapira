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

// Function to promote an admin to super admin
const promoteSuperAdmin = async () => {
  try {
    // Find the first admin user
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.error('No admin user found to promote');
      process.exit(1);
    }
    
    // Update the admin to super admin
    adminUser.role = 'superAdmin';
    await adminUser.save();
    
    console.log(`Admin user ${adminUser.name} (${adminUser.email}) promoted to Super Admin successfully`);
    process.exit(0);
  } catch (error) {
    console.error('Error promoting admin to super admin:', error);
    process.exit(1);
  }
};

// Run the promotion function
promoteSuperAdmin();
