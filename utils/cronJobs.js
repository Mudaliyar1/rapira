const cron = require('node-cron');
const { checkExpiredSubscriptions } = require('./subscriptionService');
const { cleanupPendingTickets, cleanupOrphanedArtists } = require('./cleanupService');

/**
 * Initialize all cron jobs
 */
const initializeCronJobs = () => {
  // Check for expired subscriptions daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily subscription expiry check...');
    try {
      const result = await checkExpiredSubscriptions();
      console.log(`Subscription check complete: ${result.expired} subscriptions marked as expired`);
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }
  });

  // Cleanup pending tickets every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running cleanup for pending tickets...');
    try {
      const result = await cleanupPendingTickets();
      console.log(`Cleanup complete: ${result.cleaned} pending tickets removed`);
    } catch (error) {
      console.error('Error cleaning up pending tickets:', error);
    }
  });

  // Cleanup orphaned artists weekly (Sunday at 1 AM)
  cron.schedule('0 1 * * 0', async () => {
    console.log('Running cleanup for orphaned artists...');
    try {
      const result = await cleanupOrphanedArtists();
      console.log(`Cleanup complete: ${result.cleaned} orphaned artists removed`);
    } catch (error) {
      console.error('Error cleaning up orphaned artists:', error);
    }
  });

  console.log('All cron jobs initialized');
};

module.exports = {
  initializeCronJobs
};
