const express = require('express');
const router = express.Router();
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Admin: Subscription Plans Management
router.get('/plans', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, isActive, durationUnit, priceRange, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Active status filter
    if (isActive && isActive !== 'all') {
      filter.isActive = isActive === 'true';
    }

    // Duration unit filter
    if (durationUnit && durationUnit !== 'all') {
      filter.durationUnit = durationUnit;
    }

    // Price range filter
    if (priceRange && priceRange !== 'all') {
      if (priceRange === '0-100') {
        filter.price = { $gte: 0, $lte: 100 };
      } else if (priceRange === '101-500') {
        filter.price = { $gte: 101, $lte: 500 };
      } else if (priceRange === '501-1000') {
        filter.price = { $gte: 501, $lte: 1000 };
      } else if (priceRange === '1001+') {
        filter.price = { $gte: 1001 };
      }
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { price: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get plans with filters
    let plans = await SubscriptionPlan.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      plans = plans.filter(plan => {
        const name = (plan.name || '').toLowerCase();
        const benefits = (plan.benefits || '').toLowerCase();

        return name.includes(searchTerm) ||
               benefits.includes(searchTerm);
      });
    }

    // Get statistics
    const totalPlans = await SubscriptionPlan.countDocuments();
    const activePlans = await SubscriptionPlan.countDocuments({ isActive: true });
    const inactivePlans = await SubscriptionPlan.countDocuments({ isActive: false });

    res.render('admin/subscriptions/plans', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/plans',
      title: 'Manage Subscription Plans',
      plans,
      searchParams: {
        search: search || '',
        isActive: isActive || 'all',
        durationUnit: durationUnit || 'all',
        priceRange: priceRange || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'price',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalPlans,
        active: activePlans,
        inactive: inactivePlans,
        filtered: plans.length
      }
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    req.flash('error', 'Failed to load subscription plans');
    res.redirect('/admin');
  }
});

// Export subscription plans to CSV
router.get('/plans/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, isActive, durationUnit, priceRange, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (isActive && isActive !== 'all') {
      filter.isActive = isActive === 'true';
    }

    if (durationUnit && durationUnit !== 'all') {
      filter.durationUnit = durationUnit;
    }

    if (priceRange && priceRange !== 'all') {
      if (priceRange === '0-100') {
        filter.price = { $gte: 0, $lte: 100 };
      } else if (priceRange === '101-500') {
        filter.price = { $gte: 101, $lte: 500 };
      } else if (priceRange === '501-1000') {
        filter.price = { $gte: 501, $lte: 1000 };
      } else if (priceRange === '1001+') {
        filter.price = { $gte: 1001 };
      }
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { price: 1 };
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get plans with filters
    let plans = await SubscriptionPlan.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      plans = plans.filter(plan => {
        const name = (plan.name || '').toLowerCase();
        const benefits = (plan.benefits || '').toLowerCase();

        return name.includes(searchTerm) ||
               benefits.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Name,Price,Duration,Duration Unit,Discount %,Status,Benefits,Created Date\n';
    const csvRows = plans.map(plan => {
      const name = `"${(plan.name || '').replace(/"/g, '""')}"`;
      const price = plan.price || 0;
      const duration = plan.duration || 0;
      const durationUnit = plan.durationUnit || '';
      const discount = plan.discountPercentage || 0;
      const status = plan.isActive ? 'Active' : 'Inactive';
      const benefits = `"${(plan.benefits || '').replace(/"/g, '""')}"`;
      const createdDate = new Date(plan.createdAt).toLocaleDateString();

      return `${name},${price},${duration},${durationUnit},${discount},${status},${benefits},${createdDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `subscription_plans_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export subscription plans error:', error);
    req.flash('error', 'Failed to export subscription plans');
    res.redirect('/admin/subscriptions/plans');
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

// Admin: Delete Subscription Plan Confirmation Page
router.get('/plans/delete/:id/confirm', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      req.flash('error', 'Subscription plan not found');
      return res.redirect('/admin/subscriptions/plans');
    }

    // Check if plan is being used by any active subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      plan: req.params.id,
      status: 'active',
      expiryDate: { $gt: new Date() }
    });

    // Get total subscriptions for this plan
    const totalSubscriptions = await UserSubscription.countDocuments({
      plan: req.params.id
    });

    res.render('admin/subscriptions/delete-plan-confirm', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/plans',
      title: 'Delete Subscription Plan',
      plan,
      activeSubscriptions,
      totalSubscriptions,
      canDelete: activeSubscriptions === 0
    });
  } catch (error) {
    console.error('Error loading delete confirmation:', error);
    req.flash('error', 'Failed to load delete confirmation page');
    res.redirect('/admin/subscriptions/plans');
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
    // Get search parameters
    const { search, status, planId, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Plan filter
    if (planId && planId !== 'all') {
      filter.plan = planId;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get subscriptions with filters
    let subscriptions = await UserSubscription.find(filter)
      .populate('user', 'name email')
      .populate('plan', 'name price duration durationUnit')
      .sort(sortOptions);

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      subscriptions = subscriptions.filter(subscription => {
        const userName = (subscription.user ? subscription.user.name : '').toLowerCase();
        const userEmail = (subscription.user ? subscription.user.email : '').toLowerCase();
        const planName = (subscription.plan ? subscription.plan.name : '').toLowerCase();
        const notes = (subscription.notes || '').toLowerCase();

        return userName.includes(searchTerm) ||
               userEmail.includes(searchTerm) ||
               planName.includes(searchTerm) ||
               notes.includes(searchTerm);
      });
    }

    // Get all plans for filter dropdown
    const allPlans = await SubscriptionPlan.find().sort({ name: 1 });

    // Get statistics
    const totalSubscriptions = await UserSubscription.countDocuments();
    const activeSubscriptions = await UserSubscription.countDocuments({ status: 'active' });
    const expiredSubscriptions = await UserSubscription.countDocuments({ status: 'expired' });
    const cancelledSubscriptions = await UserSubscription.countDocuments({ status: 'cancelled' });

    res.render('admin/subscriptions/users', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/users',
      title: 'User Subscriptions',
      subscriptions,
      searchParams: {
        search: search || '',
        status: status || 'all',
        planId: planId || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        cancelled: cancelledSubscriptions,
        filtered: subscriptions.length
      },
      filterOptions: {
        plans: allPlans
      }
    });
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    req.flash('error', 'Failed to load user subscriptions');
    res.redirect('/admin');
  }
});

// Export user subscriptions to CSV
router.get('/users/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, status, planId, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (planId && planId !== 'all') {
      filter.plan = planId;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get subscriptions with filters
    let subscriptions = await UserSubscription.find(filter)
      .populate('user', 'name email')
      .populate('plan', 'name price duration durationUnit')
      .sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      subscriptions = subscriptions.filter(subscription => {
        const userName = (subscription.user ? subscription.user.name : '').toLowerCase();
        const userEmail = (subscription.user ? subscription.user.email : '').toLowerCase();
        const planName = (subscription.plan ? subscription.plan.name : '').toLowerCase();
        const notes = (subscription.notes || '').toLowerCase();

        return userName.includes(searchTerm) ||
               userEmail.includes(searchTerm) ||
               planName.includes(searchTerm) ||
               notes.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'User Name,User Email,Plan Name,Plan Price,Plan Duration,Status,Purchase Date,Expiry Date,Amount Paid,Payment ID,Notes\n';
    const csvRows = subscriptions.map(subscription => {
      const userName = subscription.user ? subscription.user.name : 'Unknown';
      const userEmail = subscription.user ? subscription.user.email : 'Unknown';
      const planName = subscription.plan ? subscription.plan.name : 'Unknown';
      const planPrice = subscription.plan ? subscription.plan.price : 0;
      const planDuration = subscription.plan ? `${subscription.plan.duration} ${subscription.plan.durationUnit}` : 'Unknown';
      const status = subscription.status || '';
      const purchaseDate = new Date(subscription.createdAt).toLocaleDateString();
      const expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'N/A';
      const amount = subscription.amount || 0;
      const paymentId = subscription.paymentId || '';
      const notes = `"${(subscription.notes || '').replace(/"/g, '""')}"`;

      return `"${userName}","${userEmail}","${planName}",${planPrice},"${planDuration}",${status},${purchaseDate},${expiryDate},${amount},"${paymentId}",${notes}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `user_subscriptions_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export user subscriptions error:', error);
    req.flash('error', 'Failed to export user subscriptions');
    res.redirect('/admin/subscriptions/users');
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

// Admin: Delete User Subscription Confirmation Page
router.get('/users/delete/:id/confirm', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id)
      .populate('user', 'name email')
      .populate('plan', 'name price duration durationUnit');

    if (!subscription) {
      req.flash('error', 'Subscription not found');
      return res.redirect('/admin/subscriptions/users');
    }

    res.render('admin/subscriptions/delete-subscription-confirm', {
      layout: 'admin',
      currentPath: '/admin/subscriptions/users',
      title: 'Delete User Subscription',
      subscription
    });
  } catch (error) {
    console.error('Error loading delete confirmation:', error);
    req.flash('error', 'Failed to load delete confirmation page');
    res.redirect('/admin/subscriptions/users');
  }
});

// Admin: Delete User Subscription
router.post('/users/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id)
      .populate('user', 'name email')
      .populate('plan', 'name');

    if (!subscription) {
      req.flash('error', 'Subscription not found');
      return res.redirect('/admin/subscriptions/users');
    }

    // Store info for success message
    const userName = subscription.user ? subscription.user.name : 'Unknown User';
    const planName = subscription.plan ? subscription.plan.name : 'Unknown Plan';

    // Delete the subscription
    await UserSubscription.findByIdAndDelete(req.params.id);

    req.flash('success', `Successfully deleted subscription for ${userName} (${planName})`);
    res.redirect('/admin/subscriptions/users');
  } catch (error) {
    console.error('Error deleting subscription:', error);
    req.flash('error', 'Failed to delete subscription');
    res.redirect('/admin/subscriptions/users');
  }
});

// Admin: Bulk Delete User Subscriptions
router.post('/users/bulk-delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { subscriptionIds } = req.body;

    if (!subscriptionIds || subscriptionIds.length === 0) {
      req.flash('error', 'No subscriptions selected for deletion');
      return res.redirect('/admin/subscriptions/users');
    }

    // Ensure subscriptionIds is an array
    const idsArray = Array.isArray(subscriptionIds) ? subscriptionIds : [subscriptionIds];

    // Get subscription details for success message
    const subscriptions = await UserSubscription.find({ _id: { $in: idsArray } })
      .populate('user', 'name')
      .populate('plan', 'name');

    // Delete the subscriptions
    const deleteResult = await UserSubscription.deleteMany({ _id: { $in: idsArray } });

    req.flash('success', `Successfully deleted ${deleteResult.deletedCount} subscription(s)`);
    res.redirect('/admin/subscriptions/users');
  } catch (error) {
    console.error('Error bulk deleting subscriptions:', error);
    req.flash('error', 'Failed to delete selected subscriptions');
    res.redirect('/admin/subscriptions/users');
  }
});

module.exports = router;
