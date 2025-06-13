const mongoose = require('mongoose');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const User = require('../models/User');

// Load environment variables
require('dotenv').config();

async function cleanupOrphanedRoles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name');
    console.log('Connected to MongoDB');

    // Find all UserRole assignments
    const userRoles = await UserRole.find().populate('role').populate('user');
    console.log(`Found ${userRoles.length} user role assignments`);

    let orphanedRoleCount = 0;
    let orphanedUserCount = 0;
    const orphanedRoleIds = [];
    const orphanedUserIds = [];

    // Check for orphaned role references
    for (const userRole of userRoles) {
      if (!userRole.role) {
        orphanedRoleCount++;
        orphanedRoleIds.push(userRole._id);
        console.log(`Found orphaned role assignment: UserRole ID ${userRole._id} - Role reference is null`);
      }

      if (!userRole.user) {
        orphanedUserCount++;
        orphanedUserIds.push(userRole._id);
        console.log(`Found orphaned user assignment: UserRole ID ${userRole._id} - User reference is null`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Total UserRole assignments: ${userRoles.length}`);
    console.log(`- Orphaned role references: ${orphanedRoleCount}`);
    console.log(`- Orphaned user references: ${orphanedUserCount}`);

    if (orphanedRoleIds.length > 0 || orphanedUserIds.length > 0) {
      console.log('\nCleaning up orphaned assignments...');

      // Remove orphaned role assignments
      if (orphanedRoleIds.length > 0) {
        const result1 = await UserRole.deleteMany({ _id: { $in: orphanedRoleIds } });
        console.log(`Removed ${result1.deletedCount} UserRole assignments with orphaned role references`);
      }

      // Remove orphaned user assignments
      if (orphanedUserIds.length > 0) {
        const result2 = await UserRole.deleteMany({ _id: { $in: orphanedUserIds } });
        console.log(`Removed ${result2.deletedCount} UserRole assignments with orphaned user references`);
      }

      console.log('\nCleanup completed successfully!');
    } else {
      console.log('\nNo orphaned assignments found. Database is clean!');
    }

    // Verify cleanup
    const remainingUserRoles = await UserRole.find().populate('role').populate('user');
    const stillOrphaned = remainingUserRoles.filter(ur => !ur.role || !ur.user);
    
    if (stillOrphaned.length > 0) {
      console.log(`\nWarning: ${stillOrphaned.length} orphaned assignments still remain`);
    } else {
      console.log(`\nVerification: All ${remainingUserRoles.length} remaining UserRole assignments are valid`);
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupOrphanedRoles()
    .then(() => {
      console.log('Cleanup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupOrphanedRoles;
