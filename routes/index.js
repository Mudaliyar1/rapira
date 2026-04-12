const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const Content = require('../models/Content');
const Page = require('../models/Page');
const ArtistPost = require('../models/ArtistPost');
const { sendTestEmail, sendConcertSubmissionEmail } = require('../utils/emailService');

const POLICY_LAST_UPDATED = '12 Apr 2026';

const getViewsDisplay = (item) => {
  const fake = String(item?.fakeViewsLabel || '').trim();
  if (fake) return fake;
  return String(item?.views || 0);
};

const getLikesDisplay = (item) => {
  const fake = String(item?.fakeLikesLabel || '').trim();
  if (fake) return fake;
  return String(item?.likesCount || (Array.isArray(item?.likes) ? item.likes.length : 0));
};

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
    description: 'Rapira privacy policy details how we collect, use, and protect your personal information.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Terms of service
router.get('/terms-of-service', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('terms-of-service', {
    currentUser,
    path: '/terms-of-service',
    title: 'Terms of Service - Rapira',
    description: 'Rapira terms of service outline the rules and guidelines for using our platform.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Refund policy
router.get('/refund-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('refund-policy', {
    currentUser,
    path: '/refund-policy',
    title: 'Refund Policy - Rapira',
    description: 'Rapira refund policy details our procedures for ticket refunds and cancellations.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Subscription policy
router.get('/subscription-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('subscription-policy', {
    currentUser,
    path: '/subscription-policy',
    title: 'Subscription Policy - Rapira',
    description: 'Rapira subscription policy outlines the terms and conditions for our subscription services.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Shopping policy
router.get('/shopping-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('shopping-policy', {
    currentUser,
    path: '/shopping-policy',
    title: 'Shopping Policy - Rapira',
    description: 'RAPIRA shopping policy covers merchandise purchases, returns, exchanges, shipping, and customer support.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Document and ID protection policy
router.get('/document-id-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('document-id-policy', {
    currentUser,
    path: '/document-id-policy',
    title: 'Document and ID Protection Policy - Rapira',
    description: 'Rapira document and ID protection policy explains how we collect, store, and protect uploaded identity documents and ID numbers.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Event attending policy
router.get('/event-attending-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('event-attending-policy', {
    currentUser,
    path: '/event-attending-policy',
    title: 'Event Attending Policy - Rapira',
    description: 'Rapira event attending policy outlines the rules and conditions applicable to attendees of events and concerts.',
    lastUpdatedDate: POLICY_LAST_UPDATED
  });
});

// Temporary email policy
router.get('/temp-email-policy', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('temp-email-policy', {
    currentUser,
    path: '/temp-email-policy',
    title: 'Temporary Email Policy - Rapira',
    description: 'Rapira temporary email policy explains why disposable emails are not allowed and what types of email addresses are acceptable.',
    lastUpdatedDate: POLICY_LAST_UPDATED
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
    const { mediaType = '', artist = '', sort = 'latest' } = req.query;

    // Helper: extract YouTube ID from a URL
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const extractYoutubeId = (url) => {
      if (!url) return null;
      const match = url.match(youtubeRegex);
      return match ? match[1] : null;
    };

    // --- Build Filters ---
    const contentFilter = {};
    const postFilter = { isActive: true, isApproved: true };

    if (artist) {
      contentFilter.artist = artist;
      postFilter.artist = artist;
    }

    // --- Fetch Artists for Sidebar ---
    const [artistsWithContent, artistsWithPosts] = await Promise.all([
      Content.distinct('artist'),
      ArtistPost.find({ isActive: true, isApproved: true }).distinct('artist')
    ]);
    const allArtistIds = [...new Set([...artistsWithContent, ...artistsWithPosts])];
    const artists = await Artist.find({ _id: { $in: allArtistIds } })
      .populate('user', 'name')
      .sort({ 'user.name': 1 });
    const validArtists = artists.filter(a => a.user);

    // --- Query Both Collections ---
    const [rawContent, rawPosts] = await Promise.all([
      Content.find(contentFilter).populate({ path: 'artist', populate: { path: 'user', select: 'name' } }).lean(),
      ArtistPost.find(postFilter).populate({ path: 'artist', populate: { path: 'user', select: 'name' } }).lean()
    ]);

    // --- Standardize Data Formats ---
    let unifiedList = [
      ...rawContent.map(item => {
        const ytId = item.isYoutubeLink ? item.youtubeId : extractYoutubeId(item.fileUrl);
        return {
          _id: item._id,
          title: item.title,
          description: item.description,
          artist: item.artist,
          createdAt: item.createdAt,
          views: item.views || 0,
          viewsDisplay: String(item.views || 0),
          likesCount: item.likes || 0,
          media: {
            url: item.fileUrl,
            mediaType: item.type === 'song' ? 'audio' : 'video'
          },
          isYoutube: !!ytId || item.isYoutubeLink,
          youtubeId: ytId || item.youtubeId,
          youtubeThumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : (item.thumbnailUrl || null),
          sourceModel: 'Content'
        };
      }),
      ...rawPosts.map(post => {
        const ytId = extractYoutubeId(post.media?.url);
        return {
          ...post,
          title: post.title || post.caption || 'Artist Post',
          viewsDisplay: getViewsDisplay(post),
          likesDisplay: getLikesDisplay(post),
          likesCount: post.likesCount || (post.likes ? post.likes.length : 0),
          isYoutube: !!ytId,
          youtubeId: ytId,
          youtubeThumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null,
          sourceModel: 'ArtistPost'
        };
      })
    ];

    // --- Apply Media Type Filtering on Unified List ---
    if (mediaType) {
      unifiedList = unifiedList.filter(item => {
        if (mediaType === 'youtube_video') return item.isYoutube && item.media.mediaType === 'video';
        if (mediaType === 'youtube_audio') return item.isYoutube && item.media.mediaType === 'audio';
        return item.media.mediaType === mediaType;
      });
    }

    // --- Apply Sorting ---
    unifiedList.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === 'popular') return (b.views + b.likesCount) - (a.views + a.likesCount);
      return new Date(b.createdAt) - new Date(a.createdAt); // latest
    });

    // --- Pagination ---
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const paginatedList = unifiedList.slice(skip, skip + limit);
    const totalPages = Math.ceil(unifiedList.length / limit);

    // --- Statistics ---
    const stats = {
      total: unifiedList.length,
      images: unifiedList.filter(i => i.media.mediaType === 'image').length,
      videos: unifiedList.filter(i => i.media.mediaType === 'video' && !i.isYoutube).length,
      audio: unifiedList.filter(i => i.media.mediaType === 'audio' && !i.isYoutube).length,
      youtubeVideos: unifiedList.filter(i => i.media.mediaType === 'video' && i.isYoutube).length,
      youtubeAudios: unifiedList.filter(i => i.media.mediaType === 'audio' && i.isYoutube).length,
      filtered: unifiedList.length
    };

    res.render('content-library', {
      posts: paginatedList,
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