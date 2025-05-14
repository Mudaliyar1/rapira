const UserSubscription = require('../models/UserSubscription');

/**
 * Check and mark expired subscriptions
 * This function should be called periodically (e.g., daily via cron job)
 */
const checkExpiredSubscriptions = async () => {
  try {
    console.log('Checking for expired subscriptions...');
    
    // Find active subscriptions that have expired
    const expiredSubscriptions = await UserSubscription.find({
      status: 'active',
      expiryDate: { $lt: new Date() }
    });
    
    if (expiredSubscriptions.length === 0) {
      console.log('No expired subscriptions found.');
      return { success: true, expired: 0 };
    }
    
    // Mark subscriptions as expired
    for (const subscription of expiredSubscriptions) {
      subscription.status = 'expired';
      await subscription.save();
      console.log(`Marked subscription ${subscription._id} as expired.`);
    }
    
    console.log(`Marked ${expiredSubscriptions.length} subscriptions as expired.`);
    return { success: true, expired: expiredSubscriptions.length };
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get active subscription for a user
 * @param {String} userId - User ID
 * @returns {Object} - Active subscription or null
 */
const getActiveSubscription = async (userId) => {
  try {
    // Find active subscription for the user
    const subscription = await UserSubscription.findOne({
      user: userId,
      status: 'active',
      expiryDate: { $gt: new Date() }
    }).populate('plan');
    
    return subscription;
  } catch (error) {
    console.error('Error getting active subscription:', error);
    return null;
  }
};

/**
 * Apply subscription discount to price
 * @param {Number} price - Original price
 * @param {Object} subscription - User subscription
 * @returns {Number} - Discounted price
 */
const applyDiscount = (price, subscription) => {
  if (!price || !subscription || !subscription.plan || !subscription.plan.discountPercentage) {
    return price;
  }
  
  const discount = (price * subscription.plan.discountPercentage) / 100;
  return Math.max(0, price - discount);
};

/**
 * Calculate days remaining in subscription
 * @param {Object} subscription - User subscription
 * @returns {Number} - Days remaining
 */
const getDaysRemaining = (subscription) => {
  if (!subscription || !subscription.expiryDate) {
    return 0;
  }
  
  const now = new Date();
  const expiryDate = new Date(subscription.expiryDate);
  
  // If already expired, return 0
  if (expiryDate <= now) {
    return 0;
  }
  
  // Calculate days remaining
  const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  return daysRemaining;
};

module.exports = {
  checkExpiredSubscriptions,
  getActiveSubscription,
  applyDiscount,
  getDaysRemaining
};
