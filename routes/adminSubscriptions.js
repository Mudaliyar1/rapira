const express = require('express');
const router = express.Router();
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Admin: Subscription Plans Management
router.get('/plans', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ price: 1 });

    res.render('admin/subscriptions/plans', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/plans',
      title: 'Manage Subscription Plans',
      plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    req.flash('error', 'Failed to load subscription plans');
    res.redirect('/admin');
  }
});

// Admin: Add Subscription Plan Form
router.get('/plans/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/subscriptions/plan-form', {
    layout: 'admin',
    currentPath: '/admin/subscriptions/plans',
    title: 'Add Subscription Plan',
    plan: null
  });
});

// Admin: Edit Subscription Plan Form
router.get('/plans/edit/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      req.flash('error', 'Subscription plan not found');
      return res.redirect('/admin/subscriptions/plans');
    }

    res.render('admin/subscriptions/plan-form', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/plans',
      title: 'Edit Subscription Plan',
      plan
    });
  } catch (error) {
    console.error('Error fetching subscription plan:', error);
    req.flash('error', 'Failed to load subscription plan');
    res.redirect('/admin/subscriptions/plans');
  }
});

// Admin: Create Subscription Plan
router.post('/plans', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, price, duration, durationUnit, benefits, discountPercentage, isActive } = req.body;

    // Validate input
    if (!name || !price || !duration || !durationUnit || !benefits) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/subscriptions/plans/add');
    }

    // Create new plan
    const newPlan = new SubscriptionPlan({
      name,
      price: parseFloat(price),
      duration: parseInt(duration),
      durationUnit,
      benefits,
      discountPercentage: parseFloat(discountPercentage || 0),
      isActive: isActive === 'on',
      createdBy: req.session.user.id
    });

    await newPlan.save();

    req.flash('success', 'Subscription plan created successfully');
    res.redirect('/admin/subscriptions/plans');
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    req.flash('error', 'Failed to create subscription plan');
    res.redirect('/admin/subscriptions/plans/add');
  }
});

// Admin: Update Subscription Plan
router.post('/plans/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, price, duration, durationUnit, benefits, discountPercentage, isActive } = req.body;

    // Validate input
    if (!name || !price || !duration || !durationUnit || !benefits) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/admin/subscriptions/plans/edit/${req.params.id}`);
    }

    // Update plan
    await SubscriptionPlan.findByIdAndUpdate(req.params.id, {
      name,
      price: parseFloat(price),
      duration: parseInt(duration),
      durationUnit,
      benefits,
      discountPercentage: parseFloat(discountPercentage || 0),
      isActive: isActive === 'on'
    });

    req.flash('success', 'Subscription plan updated successfully');
    res.redirect('/admin/subscriptions/plans');
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    req.flash('error', 'Failed to update subscription plan');
    res.redirect(`/admin/subscriptions/plans/edit/${req.params.id}`);
  }
});

// Admin: Delete Subscription Plan
router.post('/plans/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Check if plan is being used by any active subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      plan: req.params.id,
      status: 'active',
      expiryDate: { $gt: new Date() }
    });

    if (activeSubscriptions > 0) {
      req.flash('error', 'Cannot delete plan with active subscriptions. Deactivate it instead.');
      return res.redirect('/admin/subscriptions/plans');
    }

    await SubscriptionPlan.findByIdAndDelete(req.params.id);

    req.flash('success', 'Subscription plan deleted successfully');
    res.redirect('/admin/subscriptions/plans');
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    req.flash('error', 'Failed to delete subscription plan');
    res.redirect('/admin/subscriptions/plans');
  }
});

// Admin: View User Subscriptions
router.get('/users', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all user subscriptions
    const subscriptions = await UserSubscription.find()
      .populate('user', 'name email')
      .populate('plan', 'name price duration')
      .sort({ createdAt: -1 });

    res.render('admin/subscriptions/users', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/users',
      title: 'User Subscriptions',
      subscriptions
    });
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    req.flash('error', 'Failed to load user subscriptions');
    res.redirect('/admin');
  }
});

// Admin: View subscription details
router.get('/users/view/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id)
      .populate('user', 'name email profileImage')
      .populate('plan');

    if (!subscription) {
      req.flash('error', 'Subscription not found');
      return res.redirect('/admin/subscriptions/users');
    }

    res.render('admin/subscriptions/view-user', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/users',
      title: 'Subscription Details',
      subscription
    });
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    req.flash('error', 'Failed to load subscription details');
    res.redirect('/admin/subscriptions/users');
  }
});

// Admin: Deactivate subscription
router.post('/users/deactivate/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id);

    if (!subscription) {
      req.flash('error', 'Subscription not found');
      return res.redirect('/admin/subscriptions/users');
    }

    // Update subscription status
    subscription.status = 'expired';
    subscription.notes = `Manually deactivated by admin on ${new Date().toLocaleString()}`;
    await subscription.save();

    console.log(`Admin deactivated subscription ${subscription._id} for user ${subscription.user}`);
    req.flash('success', 'Subscription has been deactivated');
    res.redirect('/admin/subscriptions/users');
  } catch (error) {
    console.error('Error deactivating subscription:', error);
    req.flash('error', 'Failed to deactivate subscription');
    res.redirect('/admin/subscriptions/users');
  }
});

// Admin: Reactivate subscription
router.post('/users/reactivate/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id)
      .populate('plan');

    if (!subscription) {
      req.flash('error', 'Subscription not found');
      return res.redirect('/admin/subscriptions/users');
    }

    // Update subscription status
    subscription.status = 'active';

    // Set new expiry date based on plan duration and duration unit
    const now = new Date();
    let expiryDate;

    switch(subscription.plan.durationUnit) {
      case 'seconds':
        expiryDate = new Date(now.getTime() + subscription.plan.duration * 1000);
        break;
      case 'minutes':
        expiryDate = new Date(now.getTime() + subscription.plan.duration * 60 * 1000);
        break;
      case 'hours':
        expiryDate = new Date(now.getTime() + subscription.plan.duration * 60 * 60 * 1000);
        break;
      case 'days':
      default:
        expiryDate = new Date(now.getTime() + subscription.plan.duration * 24 * 60 * 60 * 1000);
        break;
    }

    subscription.expiryDate = expiryDate;
    subscription.notes = `Manually reactivated by admin on ${now.toLocaleString()}`;
    await subscription.save();

    console.log(`Admin reactivated subscription ${subscription._id} for user ${subscription.user}`);
    req.flash('success', 'Subscription has been reactivated');
    res.redirect('/admin/subscriptions/users');
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    req.flash('error', 'Failed to reactivate subscription');
    res.redirect('/admin/subscriptions/users');
  }
});

// Admin: Assign subscription to user form
router.get('/assign', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all users
    const users = await User.find({ role: { $in: ['user', 'artist'] } }).sort({ name: 1 });

    // Get all active subscription plans
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });

    res.render('admin/subscriptions/assign', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/users',
      title: 'Assign Subscription to User',
      users,
      plans
    });
  } catch (error) {
    console.error('Error loading assign subscription form:', error);
    req.flash('error', 'Failed to load form');
    res.redirect('/admin/subscriptions/users');
  }
});

// Admin: Process assign subscription to user
router.post('/assign', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { userId, planId, notes } = req.body;

    // Validate input
    if (!userId || !planId) {
      req.flash('error', 'Please select both user and subscription plan');
      return res.redirect('/admin/subscriptions/assign');
    }

    // Get user and plan
    const user = await User.findById(userId);
    const plan = await SubscriptionPlan.findById(planId);

    if (!user) {
      req.flash('error', 'Selected user not found');
      return res.redirect('/admin/subscriptions/assign');
    }

    if (!plan) {
      req.flash('error', 'Selected subscription plan not found');
      return res.redirect('/admin/subscriptions/assign');
    }

    // Calculate expiry date based on duration unit
    const now = new Date();
    let expiryDate;

    switch(plan.durationUnit) {
      case 'seconds':
        expiryDate = new Date(now.getTime() + plan.duration * 1000);
        break;
      case 'minutes':
        expiryDate = new Date(now.getTime() + plan.duration * 60 * 1000);
        break;
      case 'hours':
        expiryDate = new Date(now.getTime() + plan.duration * 60 * 60 * 1000);
        break;
      case 'days':
      default:
        expiryDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
        break;
    }

    // Create new subscription
    const newSubscription = new UserSubscription({
      user: userId,
      plan: planId,
      expiryDate: expiryDate,
      status: 'active',
      paymentId: 'admin_assigned',
      orderId: 'admin_assigned',
      amount: 0, // No payment required
      notes: notes || `Manually assigned by admin on ${now.toLocaleString()}`
    });

    await newSubscription.save();

    console.log(`Admin assigned subscription to user ${userId} with plan ${planId}`);
    req.flash('success', `Subscription successfully assigned to ${user.name}`);
    res.redirect('/admin/subscriptions/users');
  } catch (error) {
    console.error('Error assigning subscription:', error);
    req.flash('error', 'Failed to assign subscription');
    res.redirect('/admin/subscriptions/assign');
  }
});

module.exports = router;
