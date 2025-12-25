const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check the admin users
    const User = require('./models/User');
    const adminUsers = await User.find({ role: { $in: ['admin', 'superAdmin'] } });
    
    console.log('Admin users found:');
    for (const admin of adminUsers) {
      console.log(`- ID: ${admin._id}, Name: ${admin.name}, Role: ${admin.role}`);
    }
    
    // Check permissions for each admin user
    const AdminPagePermission = require('./models/AdminPagePermission');
    for (const admin of adminUsers) {
      console.log(`\nChecking permissions for ${admin.name} (${admin.role}):`);
      
      const permissions = await AdminPagePermission.findOne({ admin: admin._id });
      if (permissions) {
        console.log('  - Has permissions document');
        console.log('  - Page permissions:', Object.fromEntries(permissions.pagePermissions));
        
        // Check if they have permission for user_roles
        const hasUserRolesPermission = permissions.pagePermissions.get('user_roles');
        console.log(`  - Has User Roles permission: ${hasUserRolesPermission}`);
      } else {
        console.log('  - No permissions document found');
      }
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });