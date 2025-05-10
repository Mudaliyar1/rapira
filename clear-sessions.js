/**
 * Script to clear all sessions in MongoDB
 * 
 * Run this script if you're experiencing session-related errors:
 * node clear-sessions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

// Get MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Get the sessions collection
    const sessionsCollection = mongoose.connection.collection('sessions');
    
    // Delete all documents in the sessions collection
    return sessionsCollection.deleteMany({});
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
    process.exit(0);
  })
  .catch(err => {
    console.error('Error clearing sessions:', err);
    process.exit(1);
  });
