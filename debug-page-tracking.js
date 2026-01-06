#!/usr/bin/env node

/**
 * Page Tracking Debug Test
 * Run this to verify page tracking is working correctly
 * 
 * Usage: node debug-page-tracking.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira');
    console.log('✓ Connected to MongoDB');

    // Get a sample user (adjust the email as needed)
    const testUserEmail = process.argv[2] || 'test@example.com';
    const user = await User.findOne({ email: testUserEmail });

    if (!user) {
      console.log(`✗ User not found: ${testUserEmail}`);
      console.log('\nUsage: node debug-page-tracking.js <email>');
      console.log('Example: node debug-page-tracking.js admin@rapira.com');
      process.exit(1);
    }

    console.log('\n=== USER PAGE TRACKING INFO ===');
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`ID: ${user._id}`);
    console.log(`Is Online: ${user.isOnline}`);
    console.log(`Current Page: ${user.currentPage || 'Not set'}`);
    console.log(`Last Page Update: ${user.lastPageUpdate ? user.lastPageUpdate.toLocaleString() : 'Never'}`);
    console.log(`Current Login Time: ${user.currentLoginTime ? user.currentLoginTime.toLocaleString() : 'Never'}`);
    console.log(`Last Login: ${user.lastLogin ? user.lastLogin.toLocaleString() : 'Never'}`);

    // Show if page tracking fields exist
    console.log('\n=== DATABASE FIELD STATUS ===');
    console.log(`✓ currentPage field exists: ${user.hasOwnProperty('currentPage')}`);
    console.log(`✓ lastPageUpdate field exists: ${user.hasOwnProperty('lastPageUpdate')}`);
    console.log(`✓ isOnline field exists: ${user.hasOwnProperty('isOnline')}`);

    // Check if middleware is properly set up
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Have the user navigate to different pages');
    console.log('2. Run this script again with the same email');
    console.log('3. The "Current Page" should update to the new page');
    console.log('4. Check server logs for [PAGE_TRACKING] messages');

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
