const Ticket = require('../models/Ticket');
const Artist = require('../models/Artist');
const Concert = require('../models/Concert');
const Content = require('../models/Content');
const mongoose = require('mongoose');

/**
 * Cleanup pending tickets that are older than the specified time
 * @param {Number} minutes - Time in minutes after which pending tickets should be removed
 * @param {Number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Number>} - Number of deleted tickets
 */
const cleanupPendingTickets = async (minutes = 30, maxRetries = 3) => {
  let retries = 0;

  // Retry function with exponential backoff
  const executeWithRetry = async () => {
    try {
      // Check if MongoDB connection is ready
      if (mongoose.connection.readyState !== 1) {
        console.log('MongoDB connection not ready. Current state:', mongoose.connection.readyState);
        if (retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff
          console.log(`Retrying cleanup in ${delay/1000} seconds... (Attempt ${retries} of ${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await executeWithRetry();
        } else {
          console.error('Max retries reached. Cleanup aborted.');
          return 0;
        }
      }

      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      console.log(`Cleaning up pending tickets older than ${cutoffTime.toISOString()}`);

      // Find and delete pending tickets older than the cutoff time
      const result = await Ticket.deleteMany({
        paymentStatus: 'pending',
        createdAt: { $lt: cutoffTime }
      }).maxTimeMS(30000); // Set a 30-second timeout for the operation

      console.log(`Cleaned up ${result.deletedCount} pending tickets`);
      return result.deletedCount;
    } catch (error) {
      // Check if this is a network error that we should retry
      const isNetworkError = error.name === 'MongoNetworkError' ||
                            error.name === 'MongoServerSelectionError' ||
                            error.message.includes('network') ||
                            error.message.includes('timeout') ||
                            error.message.includes('ENOTFOUND') ||
                            error.message.includes('PoolClearedOnNetworkError');

      if (isNetworkError && retries < maxRetries) {
        retries++;
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        console.error(`Network error during cleanup: ${error.message}`);
        console.log(`Retrying cleanup in ${delay/1000} seconds... (Attempt ${retries} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return await executeWithRetry();
      }

      console.error('Error cleaning up pending tickets:', error);
      return 0;
    }
  };

  return await executeWithRetry();
};

/**
 * Cleanup orphaned artist records (artists without valid user references)
 * @param {Number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Number>} - Number of deleted artist records
 */
const cleanupOrphanedArtists = async (maxRetries = 3) => {
  let retries = 0;
  let deletedCount = 0;

  // Retry function with exponential backoff
  const executeWithRetry = async () => {
    try {
      // Check if MongoDB connection is ready
      if (mongoose.connection.readyState !== 1) {
        console.log('MongoDB connection not ready. Current state:', mongoose.connection.readyState);
        if (retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff
          console.log(`Retrying orphaned artists cleanup in ${delay/1000} seconds... (Attempt ${retries} of ${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await executeWithRetry();
        } else {
          console.error('Max retries reached. Orphaned artists cleanup aborted.');
          return 0;
        }
      }

      console.log('Cleaning up orphaned artist records...');

      // Find all artists and populate their user references
      const orphanedArtists = await Artist.find().populate('user');

      // Process each artist
      for (const artist of orphanedArtists) {
        if (!artist.user) {
          console.log(`Found orphaned artist record: ${artist._id}. Deleting...`);

          // Delete artist's concerts
          const concertResult = await Concert.deleteMany({ artist: artist._id });
          console.log(`Deleted ${concertResult.deletedCount} concerts for orphaned artist ${artist._id}`);

          // Delete artist's content
          const contentResult = await Content.deleteMany({ artist: artist._id });
          console.log(`Deleted ${contentResult.deletedCount} content items for orphaned artist ${artist._id}`);

          // Delete artist profile
          await Artist.findByIdAndDelete(artist._id);
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} orphaned artist records`);
      return deletedCount;
    } catch (error) {
      // Check if this is a network error that we should retry
      const isNetworkError = error.name === 'MongoNetworkError' ||
                            error.name === 'MongoServerSelectionError' ||
                            error.message.includes('network') ||
                            error.message.includes('timeout') ||
                            error.message.includes('ENOTFOUND') ||
                            error.message.includes('PoolClearedOnNetworkError');

      if (isNetworkError && retries < maxRetries) {
        retries++;
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        console.error(`Network error during orphaned artists cleanup: ${error.message}`);
        console.log(`Retrying cleanup in ${delay/1000} seconds... (Attempt ${retries} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return await executeWithRetry();
      }

      console.error('Error cleaning up orphaned artists:', error);
      return 0;
    }
  };

  return await executeWithRetry();
};

module.exports = {
  cleanupPendingTickets,
  cleanupOrphanedArtists
};
