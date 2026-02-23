const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const UserRole = require('../models/UserRole');
const Artist = require('../models/Artist');
const ArtistPost = require('../models/ArtistPost');
const ProducerUnblockRequest = require('../models/ProducerUnblockRequest');

const requireProducerRole = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const producerRole = await UserRole.findOne({ user: req.session.user.id }).populate('role');
    const userRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
    const hasProducerRole = userRoles.some((entry) => entry.role && entry.role.name && entry.role.name.toLowerCase() === 'producer');

    if (!producerRole && !hasProducerRole) {
      req.flash('error', 'You do not have producer access yet.');
      return res.redirect('/producer-applications/apply');
    }

    if (!hasProducerRole) {
      req.flash('error', 'You do not have producer access yet.');
      return res.redirect('/producer-applications/apply');
    }

    // Check if producer is blocked
    const dbUser = await User.findById(req.session.user.id);
    if (dbUser && dbUser.isBlocked) {
      // Redirect to unblock request page instead of allowing access
      return res.redirect('/producer-dashboard/unblock-request');
    }

    next();
  } catch (error) {
    console.error('Producer role middleware error:', error);
    req.flash('error', 'Failed to verify producer access');
    res.redirect('/users/profile');
  }
};

router.get('/', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const { location } = req.query;

    // Get all artists (not just those with roles)
    let artistQuery = Artist.find();

    // Filter by location if specified
    if (location) {
      artistQuery = artistQuery.where('state', location);
    }

    const artists = await artistQuery
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get unique locations for filter
    const allArtists = await Artist.find().select('state').distinct('state');
    const locations = [...new Set(allArtists)].filter(Boolean).sort();

    res.render('producer/dashboard', {
      layout: false,
      title: 'Producer Dashboard',
      currentPath: '/producer-dashboard',
      artists,
      locations,
      selectedLocation: location || '',
      producerUser: req.session.user
    });
  } catch (error) {
    console.error('Producer dashboard error:', error);
    req.flash('error', 'Failed to load producer dashboard');
    res.redirect('/users/profile');
  }
});

// GET - Unblock request page for blocked producers
router.get('/unblock-request', isLoggedIn, async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Fetch user from database to check if blocked
    const dbUser = await User.findById(req.session.user.id);
    
    // Check if user is blocked (check from database, not session)
    if (!dbUser || !dbUser.isBlocked) {
      return res.redirect('/producer-dashboard');
    }

    // Get previous unblock requests
    const previousRequests = await ProducerUnblockRequest.find({ producer: req.session.user.id })
      .populate('reviewedBy')
      .sort({ createdAt: -1 });

    res.render('producer/request-unblock', {
      layout: false,
      title: 'Request Unblock',
      currentPath: '/producer-dashboard/unblock-request',
      producerUser: req.session.user,
      blockReason: dbUser.blockReason || 'Your account has been blocked',
      blockedAt: dbUser.blockedAt,
      previousRequests
    });
  } catch (error) {
    console.error('Error loading unblock request page:', error);
    req.flash('error', 'Failed to load unblock request page');
    res.redirect('/producer-dashboard');
  }
});

// POST - Submit unblock request
router.post('/unblock-request/submit', isLoggedIn, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.session.user.id;

    // Validate message
    if (!message || message.trim().length < 10) {
      return res.json({ success: false, message: 'Please provide a detailed message (at least 10 characters)' });
    }

    // Check if already has pending request
    const existingRequest = await ProducerUnblockRequest.findOne({
      producer: userId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.json({ success: false, message: 'You already have a pending unblock request. Please wait for admin review.' });
    }

    // Create new unblock request
    const unblockRequest = new ProducerUnblockRequest({
      producer: userId,
      message: message.trim()
    });

    await unblockRequest.save();
    res.json({ success: true, message: 'Unblock request submitted successfully. Admin will review it soon.' });
  } catch (error) {
    console.error('Error submitting unblock request:', error);
    res.json({ success: false, message: 'Failed to submit unblock request' });
  }
});

// GET - View unblock request status
router.get('/unblock-request/status', isLoggedIn, async (req, res) => {
  try {
    const user = req.session.user;

    // Get all unblock requests
    const requests = await ProducerUnblockRequest.find({ producer: user.id })
      .populate('reviewedBy')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      isBlocked: user.isBlocked,
      requests
    });
  } catch (error) {
    console.error('Error fetching unblock request status:', error);
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
