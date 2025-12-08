const mongoose = require('mongoose');
const Follow = require('../models/Follow');
const User = require('../models/User');

async function cleanupOrphanedFollows() {
  try {
    // Load environment variables
    require('dotenv').config();
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira');
    console.log('Connected to MongoDB');

    // Find all follows
    const allFollows = await Follow.find();
    console.log(`Total follows in database: ${allFollows.length}`);

    let orphanedCount = 0;
    const orphanedIds = [];

    // Check each follow for valid user references
    for (const follow of allFollows) {
      const followerExists = await User.findById(follow.followerId);
      const followingExists = await User.findById(follow.followingId);

      if (!followerExists || !followingExists) {
        orphanedIds.push(follow._id);
        orphanedCount++;
        console.log(`Orphaned follow found: ${follow._id}`);
        console.log(`  - Follower (${follow.followerId}): ${followerExists ? 'EXISTS' : 'MISSING'}`);
        console.log(`  - Following (${follow.followingId}): ${followingExists ? 'EXISTS' : 'MISSING'}`);
      }
    }

    if (orphanedCount > 0) {
      console.log(`\nFound ${orphanedCount} orphaned follow records.`);
      console.log('Deleting orphaned records...');
      
      const result = await Follow.deleteMany({ _id: { $in: orphanedIds } });
      console.log(`Deleted ${result.deletedCount} orphaned follow records.`);
    } else {
      console.log('\nNo orphaned follow records found.');
    }

    console.log('\nCleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupOrphanedFollows();
