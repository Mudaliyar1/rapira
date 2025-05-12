const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const Content = require('../models/Content');
const Page = require('../models/Page');
const { sendTestEmail, sendConcertSubmissionEmail } = require('../utils/emailService');

// Home page
router.get('/', async (req, res) => {
  try {
    // Get upcoming concerts - limit to 3
    const upcomingConcerts = await Concert.find({
      status: 'approved',
      date: { $gte: new Date() }
    })
    .sort({ date: 1 })
    .limit(3)
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name profileImage' }
    });

    // Get featured artists - limit to 4
    const featuredArtists = await Artist.find({ featuredArtist: true })
      .limit(4)
      .populate('user', 'name profileImage');

    // Get latest content - limit to 4
    const latestContent = await Content.find()
      .sort({ createdAt: -1 })
      .limit(4)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    res.render('index', {
      upcomingConcerts,
      featuredArtists,
      latestContent
    });
  } catch (error) {
    console.error('Home page error:', error);
    req.flash('error', 'Something went wrong');
    res.status(500).render('error/500');
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about');
});

// Contact page
router.get('/contact', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('contact', { currentUser });
});

// Privacy policy
router.get('/privacy-policy', (req, res) => {
  res.render('privacy-policy');
});

// Terms of service
router.get('/terms-of-service', (req, res) => {
  res.render('terms-of-service');
});

// Content library page
router.get('/content', async (req, res) => {
  try {
    // Get filter parameters
    const { type, artist, sort = 'latest' } = req.query;

    // Build filter object
    const filter = {};
    if (type) filter.type = type;
    if (artist) filter.artist = artist;

    // Build sort object
    let sortOption = { createdAt: -1 }; // Default: latest first
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'popular') sortOption = { views: -1 };
    if (sort === 'alphabetical') sortOption = { title: 1 };

    // Get all artists for filter dropdown
    const artists = await Artist.find()
      .populate('user', 'name')
      .then(artists => artists.filter(artist => artist.user)); // Filter out artists with no user

    // Get content with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Count total content for pagination
    const totalContent = await Content.countDocuments(filter);
    const totalPages = Math.ceil(totalContent / limit);

    // Get content
    const content = await Content.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    res.render('content-library', {
      content,
      artists,
      currentFilters: { type, artist, sort },
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Content library error:', error);
    req.flash('error', 'Failed to load content library');
    res.redirect('/');
  }
});

// Content viewer page - dedicated page for viewing individual content
router.get('/content/:id', async (req, res) => {
  try {
    // Find the content by ID
    const content = await Content.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/content');
    }

    // Increment view count
    content.views += 1;
    await content.save();

    // Get related content from the same artist (excluding current content)
    const relatedContent = await Content.find({
      artist: content.artist._id,
      _id: { $ne: content._id }
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name' }
    });

    // Render the content viewer page
    res.render('content-viewer', {
      content,
      relatedContent
    });
  } catch (error) {
    console.error('Content viewer error:', error);
    req.flash('error', 'Failed to load content');
    res.redirect('/content');
  }
});

// Dynamic pages
router.get('/page/:slug', async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, published: true });

    if (!page) {
      return res.status(404).render('error/404');
    }

    // Pass currentUser to the template
    const currentUser = req.session.user || null;

    res.render('page', { page, currentUser });
  } catch (error) {
    console.error('Page view error:', error);
    res.status(500).render('error/500');
  }
});

// Email test page
router.get('/email-test', (req, res) => {
  res.render('email-test');
});

// Test concert submission email route
router.get('/test-concert-email', async (req, res) => {
  try {
    const { email, name } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    // Create a mock artist and concert
    const mockArtist = {
      email: email,
      name: name || email.split('@')[0]
    };

    const mockConcert = {
      title: 'Test Concert',
      date: new Date(),
      venue: 'Test Venue',
      city: 'Test City',
      description: 'This is a test concert for email verification'
    };

    console.log('Sending test concert submission email to:', email);
    const result = await sendConcertSubmissionEmail(mockArtist, mockConcert);

    if (result.success) {
      return res.json({
        success: true,
        message: `Concert submission test email sent successfully to ${email}. Please check your inbox (and spam folder).`,
        data: result.data
      });
    } else {
      console.error('Concert submission test email error details:', result.details);
      return res.status(500).json({
        success: false,
        message: `Failed to send concert submission test email: ${result.error}`,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Concert submission test email error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send concert submission test email', error: error.message });
  }
});

// Public test email route (for development only)
router.get('/test-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    console.log('Sending public test email to:', email);
    const result = await sendTestEmail(email);

    if (result.success) {
      return res.json({
        success: true,
        message: `Test email sent successfully to ${email}. Please check your inbox (and spam folder).`,
        data: result.data
      });
    } else {
      console.error('Public test email error details:', result.details);
      return res.status(500).json({
        success: false,
        message: `Failed to send test email: ${result.error}`,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Public test email error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send test email', error: error.message });
  }
});

module.exports = router;