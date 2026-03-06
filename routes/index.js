const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const Content = require('../models/Content');
const Page = require('../models/Page');
const ArtistPost = require('../models/ArtistPost');
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
      })
      .populate('venue', 'name address city');

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

    // Get featured products - limit to 4
    const Product = require('../models/Product');
    const featuredProducts = await Product.find({
      isActive: true,
      isFeatured: true
    })
      .sort({ totalSales: -1, createdAt: -1 })
      .limit(4)
      .lean();

    // Get 6 random reels for homepage attraction
    const homeReels = await ArtistPost.aggregate([
      {
        $match: {
          isActive: true,
          isApproved: true,
          'media.mediaType': { $in: ['video', 'audio'] }
        }
      },
      { $sample: { size: 6 } },
      {
        $lookup: {
          from: 'artists',
          localField: 'artist',
          foreignField: '_id',
          as: 'artistData'
        }
      },
      { $unwind: '$artistData' },
      {
        $lookup: {
          from: 'users',
          localField: 'artistData.user',
          foreignField: '_id',
          as: 'artistUser'
        }
      },
      { $unwind: { path: '$artistUser', preserveNullAndEmptyArrays: true } }
    ]);

    const formattedReels = homeReels.map(reel => ({
      _id: reel._id,
      media: reel.media,
      artist: {
        stageName: reel.artistData.stageName,
        profileImage: reel.artistUser ? reel.artistUser.profileImage : '/images/default-profile.svg'
      }
    }));

    // Get current user data
    const currentUser = req.session.user || null;

    res.render('index', {
      upcomingConcerts,
      featuredArtists,
      latestContent,
      featuredProducts,
      homeReels: formattedReels,
      user: currentUser
    });
  } catch (error) {
    console.error('Home page error:', error);
    req.flash('error', 'Something went wrong');
    res.status(500).render('error/500');
  }
});

// About page
router.get('/about', async (req, res) => {
  try {
    const currentUser = req.session.user || null;

    // Import TeamMember model
    const TeamMember = require('../models/TeamMember');

    // Get active team members ordered by display order
    const teamMembers = await TeamMember.find({ isActive: true }).sort({ order: 1, createdAt: 1 });

    res.render('about', {
      currentUser,
      teamMembers,
      path: '/about',
      title: 'About Us - Rapira',
      description: 'Learn about Rapira, the ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.'
    });
  } catch (error) {
    console.error('Error loading about page:', error);
    const currentUser = req.session.user || null;
    res.render('about', {
      currentUser,
      teamMembers: [],
      path: '/about',
      title: 'About Us - Rapira',
      description: 'Learn about Rapira, the ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.'
    });
  }
});

// Contact page
router.get('/contact', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('contact', {
    currentUser,
    path: '/contact',
    title: 'Contact Us - Rapira',
    description: 'Get in touch with the Rapira team for any questions, feedback, or support.'
  });
});

// Contact form submission
router.post('/contact/submit', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate input
    if (!name || !email || !subject || !message) {
      req.flash('error', 'All fields are required');
      return res.redirect('/contact');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect('/contact');
    }

    // Import Contact model
    const Contact = require('../models/Contact');

    // Save to database
    const newContact = new Contact({
      name,
      email,
      subject,
      message
    });

    await newContact.save();

    // Log the submission for debugging
    console.log('Contact form submission saved:', { name, email, subject });

    // Flash a success message
    req.flash('success', 'Thank you for your message! We will get back to you soon.');

    // Redirect back to the contact page
    res.redirect('/contact');
  } catch (error) {
    console.error('Error saving contact form submission:', error);
    req.flash('error', 'There was an error submitting your message. Please try again later.');
    res.redirect('/contact');
  }
});

// Privacy policy
router.get('/privacy-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('privacy-policy', {
    currentUser,
    path: '/privacy-policy',
    title: 'Privacy Policy - Rapira',
    description: 'Rapira privacy policy details how we collect, use, and protect your personal information.'
  });
});

// Terms of service
router.get('/terms-of-service', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('terms-of-service', {
    currentUser,
    path: '/terms-of-service',
    title: 'Terms of Service - Rapira',
    description: 'Rapira terms of service outline the rules and guidelines for using our platform.'
  });
});

// Refund policy
router.get('/refund-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('refund-policy', {
    currentUser,
    path: '/refund-policy',
    title: 'Refund Policy - Rapira',
    description: 'Rapira refund policy details our procedures for ticket refunds and cancellations.'
  });
});

// Subscription policy
router.get('/subscription-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('subscription-policy', {
    currentUser,
    path: '/subscription-policy',
    title: 'Subscription Policy - Rapira',
    description: 'Rapira subscription policy outlines the terms and conditions for our subscription services.'
  });
});

// Shopping policy
router.get('/shopping-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('shopping-policy', {
    currentUser,
    path: '/shopping-policy',
    title: 'Shopping Policy - Rapira',
    description: 'RAPIRA shopping policy covers merchandise purchases, returns, exchanges, shipping, and customer support.'
  });
});

// Event attending policy
router.get('/event-attending-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('event-attending-policy', {
    currentUser,
    path: '/event-attending-policy',
    title: 'Event Attending Policy - Rapira',
    description: 'Rapira event attending policy outlines the rules and conditions applicable to attendees of events and concerts.'
  });
});

// Temporary email policy
router.get('/temp-email-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('temp-email-policy', {
    currentUser,
    path: '/temp-email-policy',
    title: 'Temporary Email Policy - Rapira',
    description: 'Rapira temporary email policy explains why disposable emails are not allowed and what types of email addresses are acceptable.'
  });
});

// Account reactivation
router.get('/account-reactivation', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('users/account-reactivation', {
    currentUser,
    path: '/account-reactivation',
    title: 'Account Reactivation - Rapira',
    description: 'Reactivate your deleted account on Rapira.'
  });
});

// FAQ page
router.get('/faq', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('faq', {
    currentUser,
    path: '/faq',
    title: 'Frequently Asked Questions - Rapira',
    description: 'Find answers to common questions about Rapira, our services, and how to use our platform.'
  });
});

// Content library page
router.get('/content', async (req, res) => {
  try {
    // Get filter parameters with proper defaults
    const { mediaType = '', artist = '', sort = 'latest' } = req.query;

    // Build post filter object for artist posts
    const postFilter = { isActive: true };

    // Media type filter for artist posts (images/videos/audio)
    if (mediaType && ['image', 'video', 'audio'].includes(mediaType)) {
      postFilter['media.mediaType'] = mediaType;
    }

    // Artist filter
    if (artist && artist !== '') {
      postFilter.artist = artist;
    }

    // Build sort object
    let sortOption = { createdAt: -1 }; // Default: latest first
    switch (sort) {
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'popular':
        sortOption = { views: -1, createdAt: -1 };
        break;
      case 'latest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // Get all artists for filter dropdown (only those with posts)
    const artistsWithPosts = await ArtistPost.find({ isActive: true }).distinct('artist');
    const artists = await Artist.find({ _id: { $in: artistsWithPosts } })
      .populate('user', 'name')
      .sort({ 'user.name': 1 });

    // Filter out artists with no user
    const validArtists = artists.filter(artist => artist.user);

    // Get artist posts with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Count total posts for pagination
    const totalPosts = await ArtistPost.countDocuments(postFilter);
    const totalPages = Math.ceil(totalPosts / limit);

    // Get posts
    const posts = await ArtistPost.find(postFilter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'artist', populate: { path: 'user', select: 'name' } })
      .lean();

    // Get statistics
    const stats = {
      total: await ArtistPost.countDocuments({ isActive: true }),
      images: await ArtistPost.countDocuments({ isActive: true, 'media.mediaType': 'image' }),
      videos: await ArtistPost.countDocuments({ isActive: true, 'media.mediaType': 'video' }),
      audio: await ArtistPost.countDocuments({ isActive: true, 'media.mediaType': 'audio' }),
      filtered: totalPosts
    };

    res.render('content-library', {
      posts,
      artists: validArtists,
      currentFilters: {
        mediaType: mediaType || '',
        artist: artist || '',
        sort: sort || 'latest'
      },
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats
    });
  } catch (error) {
    console.error('Content library error:', error);
    req.flash('error', 'Failed to load content library');
    res.redirect('/');
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

// Demo page
router.get('/demo', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('demo', {
    title: 'Interactive Demo - Rapira',
    description: 'Try out Rapira features with our interactive demo. Learn how to become an artist, create concerts, purchase tickets, and more.',
    path: '/demo',
    currentUser
  });
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