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

    // Get current user data
    const currentUser = req.session.user || null;

    res.render('index', {
      upcomingConcerts,
      featuredArtists,
      latestContent,
      featuredProducts,
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
    const { type, artist, sort = 'latest', search } = req.query;

    // Build filter object
    const filter = {};

    // Content type filter (only allow valid types)
    if (type && ['song', 'video'].includes(type)) {
      filter.type = type;
    }

    // Artist filter
    if (artist && artist !== '') {
      filter.artist = artist;
    }

    // Search filter (search in title and description)
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
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
      case 'alphabetical':
        sortOption = { title: 1 };
        break;
      case 'latest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // Get all artists for filter dropdown (only those with content)
    const artistsWithContent = await Content.distinct('artist');
    const artists = await Artist.find({ _id: { $in: artistsWithContent } })
      .populate('user', 'name')
      .sort({ 'user.name': 1 });

    // Filter out artists with no user
    const validArtists = artists.filter(artist => artist.user);

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

    // Also load approved artist posts for library display
    const postFilter = { isApproved: true, isActive: true };
    if (artist && artist !== '') {
      postFilter.artist = artist;
    }
    const posts = await ArtistPost.find(postFilter)
      .sort({ createdAt: -1 })
      .limit(24)
      .populate({ path: 'artist', populate: { path: 'user', select: 'name' } })
      .lean();

    // Get content statistics
    const stats = {
      total: await Content.countDocuments(),
      songs: await Content.countDocuments({ type: 'song' }),
      videos: await Content.countDocuments({ type: 'video' }),
      filtered: totalContent
    };

    res.render('content-library', {
      content,
      posts,
      artists: validArtists,
      currentFilters: {
        type: type || '',
        artist: artist || '',
        sort: sort || 'latest',
        search: search || ''
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

// Sitemap route
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Set cache control headers (cache for 1 hour)
    res.set({
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    });

    // Base URLs that are always included
    const staticUrls = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/about', priority: '0.8', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'yearly' },
      { url: '/artists', priority: '0.9', changefreq: 'daily' },
      { url: '/concerts', priority: '0.9', changefreq: 'hourly' },
      { url: '/content', priority: '0.8', changefreq: 'daily' },
      { url: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
      { url: '/terms-of-service', priority: '0.3', changefreq: 'yearly' },
      { url: '/refund-policy', priority: '0.3', changefreq: 'yearly' },
      { url: '/subscription-policy', priority: '0.3', changefreq: 'yearly' },
      { url: '/shopping-policy', priority: '0.3', changefreq: 'yearly' },
      { url: '/faq', priority: '0.5', changefreq: 'monthly' }
    ];

    // Get dynamic URLs from MongoDB
    const Concert = require('../models/Concert');
    const Artist = require('../models/Artist');
    const Content = require('../models/Content');
    const Page = require('../models/Page');

    // Get approved concerts
    const concerts = await Concert.find({ status: 'approved' })
      .select('_id date updatedAt')
      .sort({ date: -1 });

    // Get active artists
    const artists = await Artist.find({ verified: true })
      .select('_id updatedAt')
      .populate('user', 'name');

    // Get published content
    const contents = await Content.find({})
      .select('_id updatedAt')
      .sort({ createdAt: -1 });

    // Get published pages
    const pages = await Page.find({ published: true })
      .select('slug updatedAt');

    // Build dynamic URLs
    const dynamicUrls = [];

    // Concert URLs
    concerts.forEach(concert => {
      dynamicUrls.push({
        url: `/concerts/${concert._id}`,
        lastmod: concert.updatedAt || concert.date,
        priority: '0.8',
        changefreq: 'daily'
      });
    });

    // Artist URLs
    artists.forEach(artist => {
      dynamicUrls.push({
        url: `/artists/${artist._id}`,
        lastmod: artist.updatedAt,
        priority: '0.7',
        changefreq: 'weekly'
      });
    });

    // Content URLs
    contents.forEach(content => {
      dynamicUrls.push({
        url: `/content/${content._id}`,
        lastmod: content.updatedAt,
        priority: '0.6',
        changefreq: 'monthly'
      });
    });

    // Page URLs
    pages.forEach(page => {
      dynamicUrls.push({
        url: `/page/${page.slug}`,
        lastmod: page.updatedAt,
        priority: '0.5',
        changefreq: 'monthly'
      });
    });

    // Combine all URLs
    const allUrls = [...staticUrls, ...dynamicUrls];

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    allUrls.forEach(item => {
      xml += '  <url>\n';
      xml += `    <loc>https://${req.get('host')}${item.url}</loc>\n`;
      
      if (item.lastmod) {
        // Format date as YYYY-MM-DD
        const lastmodDate = new Date(item.lastmod);
        xml += `    <lastmod>${lastmodDate.toISOString().split('T')[0]}</lastmod>\n`;
      }
      
      xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
      xml += `    <priority>${item.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

module.exports = router;