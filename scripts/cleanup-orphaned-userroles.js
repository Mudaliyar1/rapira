const mongoose = require('mongoose');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const User = require('../models/User');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const cleanupOrphanedUserRoles = async () => {
  try {
    console.log('Starting cleanup of orphaned UserRole records...\n');

    // Find all UserRole records
    const allUserRoles = await UserRole.find();
    console.log(`Found ${allUserRoles.length} total UserRole records`);

    let orphanedCount = 0;
    const orphanedIds = [];

    // Check each UserRole record
    for (const userRole of allUserRoles) {
      let isOrphaned = false;

      // Check if the referenced user exists
      const userExists = await User.findById(userRole.user);
      if (!userExists) {
        console.log(`UserRole ${userRole._id} references non-existent user ${userRole.user}`);
        isOrphaned = true;
      }

      // Check if the referenced role exists
      const roleExists = await Role.findById(userRole.role);
      if (!roleExists) {
        console.log(`UserRole ${userRole._id} references non-existent role ${userRole.role}`);
        isOrphaned = true;
      }

      if (isOrphaned) {
        orphanedCount++;
        orphanedIds.push(userRole._id);
      }
    }

    console.log(`\nFound ${orphanedCount} orphaned UserRole records`);

    if (orphanedCount > 0) {
      console.log('\nOrphaned UserRole IDs:');
      orphanedIds.forEach(id => console.log(`- ${id}`));

      // Ask for confirmation before deletion
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('\nDo you want to delete these orphaned records? (yes/no): ', resolve);
      });

      rl.close();

      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        // Delete orphaned records
        const deleteResult = await UserRole.deleteMany({ _id: { $in: orphanedIds } });
        console.log(`\nDeleted ${deleteResult.deletedCount} orphaned UserRole records`);
      } else {
        console.log('\nCleanup cancelled. No records were deleted.');
      }
    } else {
      console.log('\nNo orphaned UserRole records found. Database is clean!');
    }

    console.log('\nCleanup process completed.');

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

// Run the cleanup
const runCleanup = async () => {
  await connectDB();
  await cleanupOrphanedUserRoles();
};

// Check if this script is being run directly
if (require.main === module) {
  runCleanup().catch(console.error);
}

module.exports = { cleanupOrphanedUserRoles };
