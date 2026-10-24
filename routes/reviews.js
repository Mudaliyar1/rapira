const express = require('express');
const router = express.Router();
const ProductReview = require('../models/ProductReview');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');

// Add product review
router.post('/add', isLoggedIn, async (req, res) => {
  try {
    const { productId, orderId, rating, title, comment, size } = req.body;

    // Validate input
    if (!productId || !orderId || !rating || !title || !comment || !size) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.session.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is delivered
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'You can only review products from delivered orders'
      });
    }

    // Check if product exists in the order
    const orderItem = order.items.find(item =>
      item.product.toString() === productId && item.size === size
    );

    if (!orderItem) {
      return res.status(400).json({
        success: false,
        message: 'Product not found in this order'
      });
    }

    // Check if review already exists
    const existingReview = await ProductReview.findOne({
      user: req.session.user.id,
      product: productId,
      order: orderId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product from this order'
      });
    }

    // Create review
    const review = new ProductReview({
      product: productId,
      user: req.session.user.id,
      order: orderId,
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      size: size,
      isVerifiedPurchase: true,
      isApproved: false // Reviews need admin approval
    });

    await review.save();

    res.json({
      success: true,
      message: 'Review submitted successfully. It will be visible after admin approval.'
    });

  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting review'
    });
  }
});

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get approved reviews
    const reviews = await ProductReview.find({
      product: productId,
      isApproved: true
    })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const totalReviews = await ProductReview.countDocuments({
      product: productId,
      isApproved: true
    });

    // Get rating statistics
    const ratingStats = await ProductReview.calculateProductRating(productId);

    res.json({
      success: true,
      reviews,
      totalReviews,
      ratingStats,
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit)
    });

  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews'
    });
  }
});

// Mark review as helpful
router.post('/:reviewId/helpful', isLoggedIn, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { helpful } = req.body; // true or false

    const review = await ProductReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is trying to vote on their own review
    if (review.user.toString() === req.session.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot vote on your own review'
      });
    }

    review.addHelpfulVote(req.session.user.id, helpful);
    await review.save();

    res.json({
      success: true,
      message: 'Vote recorded successfully',
      helpfulVotes: review.helpfulVotes,
      totalVotes: review.votedBy.length
    });

  } catch (error) {
    console.error('Mark review helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording vote'
    });
  }
});

// Get user's reviews
router.get('/my-reviews', isLoggedIn, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const reviews = await ProductReview.find({ user: req.session.user.id })
      .populate('product', 'name images')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReviews = await ProductReview.countDocuments({ user: req.session.user.id });

    res.render('shop/my-reviews', {
      title: 'My Reviews - RAPIRA',
      reviews,
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      layout: 'layouts/main'
    });

  } catch (error) {
    console.error('My reviews error:', error);
    req.flash('error', 'Error loading reviews');
    res.redirect('/users/profile');
  }
});

// Admin: Get all reviews for moderation
router.get('/admin', hasAdminPermission('manage_reviews'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.isApproved = req.query.status === 'approved';
    }
    if (req.query.rating && req.query.rating !== 'all') {
      filter.rating = parseInt(req.query.rating);
    }
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { comment: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const reviews = await ProductReview.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name images')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReviews = await ProductReview.countDocuments(filter);

    res.render('admin/merchandise/reviews', {
      title: 'Review Management',
      reviews,
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews,
      filters: req.query,
      currentPath: req.path,
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Admin reviews error:', error);
    req.flash('error', 'Error loading reviews');
    res.redirect('/admin');
  }
});

// Admin: Approve/reject review
router.post('/admin/:reviewId/moderate', hasAdminPermission('manage_reviews'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { action, notes } = req.body; // 'approve' or 'reject'

    const review = await ProductReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (action === 'approve') {
      review.approve(req.session.user.id, notes);
    } else if (action === 'reject') {
      review.reject(req.session.user.id, notes);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

    await review.save();

    res.json({
      success: true,
      message: `Review ${action}ed successfully`
    });

  } catch (error) {
    console.error('Moderate review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error moderating review'
    });
  }
});

// Admin: Add response to review
router.post('/admin/:reviewId/respond', hasAdminPermission('manage_reviews'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Response message is required'
      });
    }

    const review = await ProductReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.addAdminResponse(req.session.user.id, message.trim());
    await review.save();

    res.json({
      success: true,
      message: 'Response added successfully'
    });

  } catch (error) {
    console.error('Add review response error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding response'
    });
  }
});

// Admin: Delete review
router.delete('/admin/:reviewId', hasAdminPermission('manage_reviews'), async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await ProductReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    await ProductReview.findByIdAndDelete(reviewId);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review'
    });
  }
});

module.exports = router;
