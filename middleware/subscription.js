const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

/**
 * Middleware to check if user has an active subscription
 * Adds hasActiveSubscription and activeSubscription to res.locals
 */
const checkSubscription = async (req, res, next) => {
  try {
    // Default values
    res.locals.hasActiveSubscription = false;
    res.locals.activeSubscription = null;
    res.locals.subscriptionDiscount = 0;

    // Only check for logged in users
    if (!req.session.user) {
      return next();
    }

    // Find active subscription for the user (must be active status and not expired)
    const activeSubscription = await UserSubscription.findOne({
      user: req.session.user.id,
      status: 'active', // Only 'active' status, not 'pending' or 'cancelled'
      expiryDate: { $gt: new Date() }
    }).populate('plan');

    if (activeSubscription) {
      res.locals.hasActiveSubscription = true;
      res.locals.activeSubscription = activeSubscription;

      // Set discount percentage if available
      if (activeSubscription.plan && activeSubscription.plan.discountPercentage) {
        res.locals.subscriptionDiscount = activeSubscription.plan.discountPercentage;
      }
    }

    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    next();
  }
};

/**
 * Apply subscription discount to ticket price
 * @param {Number} price - Original price
 * @param {Number} discountPercentage - Discount percentage
 * @returns {Number} - Discounted price
 */
const applySubscriptionDiscount = (price, discountPercentage) => {
  if (!price || !discountPercentage) return price;

  const discount = (price * discountPercentage) / 100;
  return Math.max(0, price - discount);
};

module.exports = {
  checkSubscription,
  applySubscriptionDiscount
};
