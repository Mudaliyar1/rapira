/**
 * Script to fix session issues in production
 * 
 * This script:
 * 1. Clears all sessions in MongoDB
 * 2. Verifies session configuration
 * 3. Provides diagnostic information
 * 
 * Run this script if you're experiencing session-related errors:
 * node scripts/fix-sessions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { URL } = require('url');

// Get MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// Check environment configuration
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Session Secret: ${process.env.SESSION_SECRET ? 'Set' : 'Not set'}`);

// Check BASE_URL configuration
const baseUrl = process.env.BASE_URL || '';
if (baseUrl) {
  try {
    const url = new URL(baseUrl);
    console.log('BASE_URL:', baseUrl);
    console.log('Hostname:', url.hostname);
    console.log('Protocol:', url.protocol);
    
    // Verify protocol for production
    if (isProduction && url.protocol !== 'https:') {
      console.warn('WARNING: In production, BASE_URL should use HTTPS protocol');
    }
  } catch (e) {
    console.error('Error parsing BASE_URL:', e.message);
  }
} else {
  console.warn('WARNING: BASE_URL is not set');
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Get the sessions collection
    const sessionsCollection = mongoose.connection.collection('sessions');
    
    // Count sessions before deletion
    return sessionsCollection.countDocuments()
      .then(count => {
        console.log(`Found ${count} sessions in the database`);
        
        // Delete all documents in the sessions collection
        return sessionsCollection.deleteMany({});
      });
  })
  .then(result => {
    console.log(`Successfully cleared ${result.deletedCount} sessions`);
    console.log('All sessions have been cleared. This should fix session-related errors.');
    console.log('You will need to log in again to create a new session.');
    
    // Close the connection
    return mongoose.connection.close();
  })
  .then(() => {
    console.log('MongoDB connection closed');
    console.log('\nSession Fix Complete!');
    console.log('---------------------');
    console.log('If login issues persist, check the following:');
    console.log('1. Make sure your server is using HTTPS in production');
    console.log('2. Verify that cookies are not being blocked by the browser');
    console.log('3. Check for any CORS issues if your frontend and backend are on different domains');
    console.log('4. Ensure your domain name is correctly set in the BASE_URL environment variable');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
