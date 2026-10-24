const express = require('express');
const router = express.Router();
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const { isLoggedIn } = require('../middleware/auth');
const { createOrder, verifyPayment } = require('../utils/paymentService');
const { sendSubscriptionConfirmationEmail } = require('../utils/emailService');

// Public: View all subscription plans
router.get('/', async (req, res) => {
  try {
    // Get all active subscription plans
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });

    res.render('subscriptions/index', {
      title: 'Subscription Plans',
      plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    req.flash('error', 'Failed to load subscription plans');
    res.redirect('/');
  }
});

// Purchase subscription page (logged in users only)
router.get('/purchase/:id', isLoggedIn, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan || !plan.isActive) {
      req.flash('error', 'Subscription plan not found or inactive');
      return res.redirect('/subscriptions');
    }

    // Check if user already has an active subscription
    const existingSubscription = await UserSubscription.findOne({
      user: req.session.user.id,
      status: 'active',
      expiryDate: { $gt: new Date() }
    }).populate('plan');

    res.render('subscriptions/purchase-direct', {
      title: 'Purchase Subscription',
      plan,
      existingSubscription,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Error loading subscription purchase page:', error);
    req.flash('error', 'Failed to load subscription purchase page');
    res.redirect('/subscriptions');
  }
});

// Create order for subscription payment
router.post('/create-order/:id', isLoggedIn, async (req, res) => {
  try {
    console.log('Create order route called with plan ID:', req.params.id);
    console.log('User ID:', req.session.user.id);

    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan || !plan.isActive) {
      // Check if this is an AJAX request or a form submission
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found or inactive'
        });
      } else {
        req.flash('error', 'Subscription plan not found or inactive');
        return res.redirect('/subscriptions');
      }
    }

    // Calculate expiry date based on duration unit
    let expiryDate = new Date();
    switch (plan.durationUnit) {
      case 'seconds':
        expiryDate = new Date(Date.now() + plan.duration * 1000);
        break;
      case 'minutes':
        expiryDate = new Date(Date.now() + plan.duration * 60 * 1000);
        break;
      case 'hours':
        expiryDate = new Date(Date.now() + plan.duration * 60 * 60 * 1000);
        break;
      case 'days':
      default:
        expiryDate = new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);
        break;
    }

    // Create a temporary subscription record with pending status
    const tempSubscription = new UserSubscription({
      user: req.session.user.id,
      plan: plan._id,
      expiryDate: expiryDate,
      status: 'pending', // Set as pending until payment is verified
      paymentId: 'pending',
      orderId: 'pending',
      amount: plan.price,
      notes: 'Awaiting payment confirmation'
    });

    await tempSubscription.save();

    // Ensure minimum amount is at least 1 rupee (Razorpay requirement)
    let finalAmount = plan.price;
    let originalAmount = plan.price;
    if (finalAmount < 1) {
      console.log(`Subscription amount ${finalAmount} is less than minimum 1 rupee, setting to minimum 1 rupee for payment`);
      finalAmount = 1;
    }

    // Create Razorpay order
    const orderResult = await createOrder({
      amount: finalAmount,
      receipt: tempSubscription._id.toString(),
      notes: {
        planId: plan._id.toString(),
        userId: req.session.user.id,
        type: 'subscription',
        originalAmount: originalAmount // Store the original amount for reference
      }
    });

    if (!orderResult.success) {
      // Update subscription with error information
      tempSubscription.status = 'expired';
      tempSubscription.notes = `Payment order creation failed: ${orderResult.error || 'Unknown error'}`;
      await tempSubscription.save();

      // Check if this is an AJAX request or a form submission
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(503).json({
          success: false,
          message: 'Failed to create payment order',
          errorType: orderResult.code || 'PAYMENT_GATEWAY_ERROR',
          details: orderResult.error || 'Unknown payment gateway error'
        });
      } else {
        req.flash('error', 'Failed to create payment order: ' + (orderResult.error || 'Unknown error'));
        return res.redirect('/subscriptions');
      }
    }

    // Update subscription with order ID
    tempSubscription.orderId = orderResult.data.id;
    await tempSubscription.save();

    // Check if this is an AJAX request or a form submission
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      // Return order details with complete information for AJAX requests
      console.log('Sending order details to client');
      return res.json({
        success: true,
        order: orderResult.data,
        subscription: tempSubscription._id,
        key: process.env.RAZORPAY_KEY_ID
      });
    } else {
      // For form submissions, render a page that will open Razorpay
      // Skip the layout for this page to avoid potential conflicts
      return res.render('subscriptions/payment-redirect', {
        layout: false,
        order: orderResult.data,
        subscription: tempSubscription._id,
        key: process.env.RAZORPAY_KEY_ID,
        plan: plan,
        currentUser: req.session.user
      });
    }
  } catch (error) {
    console.error('Error creating subscription order:', error);

    // Check if this is an AJAX request or a form submission
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create subscription order',
        error: error.message
      });
    } else {
      req.flash('error', 'Failed to create subscription order: ' + error.message);
      return res.redirect('/subscriptions');
    }
  }
});

// Verify subscription payment
router.post('/verify-payment', isLoggedIn, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      subscription_id,
      is_mock_payment
    } = req.body;

    // Log payment verification attempt
    console.log('Subscription payment verification attempt:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      subscriptionId: subscription_id,
      isMockPayment: is_mock_payment === 'true'
    });

    // Always verify the payment signature
    const verificationResult = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    // Check verification result
    if (!verificationResult.success) {
      console.error('Payment verification failed:', verificationResult);
      req.flash('error', 'Payment verification failed');
      return res.redirect('/subscriptions');
    }

    // Find and update subscription
    const subscription = await UserSubscription.findById(subscription_id);

    if (!subscription) {
      console.error('Subscription not found:', subscription_id);
      req.flash('error', 'Subscription not found');
      return res.redirect('/subscriptions');
    }

    // Update subscription payment details
    subscription.paymentId = razorpay_payment_id;

    // Only activate subscription after successful payment
    subscription.status = 'active';
    subscription.notes = 'Payment verified and subscription activated';

    await subscription.save();
    console.log('Subscription updated with payment details:', {
      subscriptionId: subscription._id,
      paymentId: subscription.paymentId
    });

    // Log the transaction for admin payments page
    const { logTransaction } = require('../utils/transactionLogger');
    const planForLog = await SubscriptionPlan.findById(subscription.plan);
    await logTransaction({
      user: subscription.user,
      type: 'subscription',
      amount: subscription.amount,
      platformFee: 0,
      paymentId: subscription.paymentId,
      orderId: subscription.orderId,
      sourceModel: 'UserSubscription',
      sourceId: subscription._id,
      description: `Subscription plan: ${planForLog ? planForLog.name : 'Unknown'}`
    });

    // Get plan details for email
    const plan = await SubscriptionPlan.findById(subscription.plan);
    const user = await User.findById(req.session.user.id);

    // Send confirmation email
    try {
      await sendSubscriptionConfirmationEmail(user, subscription, plan);
      console.log('Subscription confirmation email sent to:', user.email);
    } catch (emailError) {
      console.error('Error sending subscription confirmation email:', emailError);
    }

    // Set success message
    req.flash('success', 'Payment successful! Your subscription has been activated. A confirmation email has been sent to your email address.');

    res.redirect('/subscriptions/my-subscriptions');
  } catch (error) {
    console.error('Verify subscription payment error:', error);
    req.flash('error', 'Payment verification failed: ' + (error.message || 'Unknown error'));
    res.redirect('/subscriptions');
  }
});

// Handle payment cancellation
router.get('/cancel-payment/:id', isLoggedIn, async (req, res) => {
  try {
    const subscriptionId = req.params.id;

    // Find the subscription
    const subscription = await UserSubscription.findById(subscriptionId);

    if (!subscription) {
      req.flash('error', 'Subscription not found');
      return res.redirect('/subscriptions');
    }

    // Check if this subscription belongs to the current user
    if (subscription.user.toString() !== req.session.user.id) {
      req.flash('error', 'Unauthorized access');
      return res.redirect('/subscriptions');
    }

    // Only cancel if the subscription is still pending
    if (subscription.status === 'pending') {
      subscription.status = 'cancelled';
      subscription.notes = 'Payment cancelled by user';
      await subscription.save();

      console.log('Subscription cancelled:', {
        subscriptionId: subscription._id,
        userId: req.session.user.id
      });

      req.flash('info', 'Payment cancelled. No charges have been made.');
    } else {
      req.flash('info', 'This subscription has already been processed and cannot be cancelled.');
    }

    res.redirect('/subscriptions');
  } catch (error) {
    console.error('Error cancelling subscription payment:', error);
    req.flash('error', 'Failed to cancel payment: ' + error.message);
    res.redirect('/subscriptions');
  }
});

// User: View my subscriptions (logged in users only)
router.get('/my-subscriptions', isLoggedIn, async (req, res) => {
  try {
    // Get user's active subscription (must be active status and not expired)
    const activeSubscription = await UserSubscription.findOne({
      user: req.session.user.id,
      status: 'active', // Only 'active' status, not 'pending' or 'cancelled'
      expiryDate: { $gt: new Date() }
    }).populate('plan');

    // Get user's subscription history
    const subscriptionHistory = await UserSubscription.find({
      user: req.session.user.id
    }).populate('plan').sort({ createdAt: -1 });

    res.render('subscriptions/my-subscriptions', {
      title: 'My Subscriptions',
      activeSubscription,
      subscriptionHistory
    });
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    req.flash('error', 'Failed to load subscription information');
    res.redirect('/users/profile');
  }
});

module.exports = router;
