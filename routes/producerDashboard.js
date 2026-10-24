const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const UserRole = require('../models/UserRole');
const Artist = require('../models/Artist');
const ArtistPost = require('../models/ArtistPost');
const ProducerUnblockRequest = require('../models/ProducerUnblockRequest');
const ProducerBeat = require('../models/ProducerBeat');
const multer = require('multer');
const { uploadFileToCloudinary } = require('../utils/mediaService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

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

// GET - View producer beats
router.get('/beats', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const beats = await ProducerBeat.find({ producer: req.session.user.id })
      .sort({ createdAt: -1 });

    res.render('producer/beats', {
      layout: false,
      title: 'Manage Beats',
      currentPath: '/producer-dashboard/beats',
      producerUser: req.session.user,
      beats,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching producer beats:', error);
    req.flash('error', 'Failed to load beats');
    res.redirect('/producer-dashboard');
  }
});

// POST - Upload a new beat
router.post('/beats', isLoggedIn, requireProducerRole, upload.single('mediaFile'), async (req, res) => {
  try {
    const { title, price, mediaType } = req.body;

    if (!req.file) {
      req.flash('error', 'Please upload an audio or video file');
      return res.redirect('/producer-dashboard/beats');
    }

    // Upload to Cloudinary
    const { media } = await uploadFileToCloudinary(req.file, {
      module: 'producerBeats',
      ownerType: 'producer',
      ownerId: req.session.user.id,
      folder: 'rapira/producer/beats'
    });

    // Create beat record
    const newBeat = new ProducerBeat({
      producer: req.session.user.id,
      title: title.trim(),
      mediaType,
      mediaUrl: media.secure_url,
      publicId: media.public_id,
      price: parseFloat(price)
    });

    await newBeat.save();

    req.flash('success', 'Beat uploaded successfully');
    res.redirect('/producer-dashboard/beats');

  } catch (error) {
    console.error('Error uploading beat:', error);
    req.flash('error', 'Failed to upload beat');
    res.redirect('/producer-dashboard/beats');
  }
});

// GET - View beat sales and receipts
router.get('/beat-sales', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const BeatPurchase = require('../models/BeatPurchase');

    // Get query parameters for filtering
    const { searchArtist, dateFrom, dateTo } = req.query;

    // Build base query
    const query = { producer: req.session.user.id, status: 'completed', isDeletedByProducer: { $ne: true } };

    // Date filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Set to end of day
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    // First fetch the sales without artist filter (since artist is a populated field)
    let sales = await BeatPurchase.find(query)
      .populate('artist', 'name email profileImage')
      .populate('beat', 'title price')
      .sort({ createdAt: -1 });

    // Client-side filtering for artist name since it's populated
    if (searchArtist) {
      const searchRegex = new RegExp(searchArtist, 'i');
      sales = sales.filter(sale =>
        sale.artist && sale.artist.name && searchRegex.test(sale.artist.name)
      );
    }

    const totalEarned = sales.reduce((sum, sale) => sum + sale.amount, 0);

    // Calculate total ever earned (unfiltered) for the top widget
    const allSales = await BeatPurchase.find({ producer: req.session.user.id, status: 'completed' });
    const lifetimeEarned = allSales.reduce((sum, sale) => sum + sale.amount, 0);

    res.render('producer/beat-sales', {
      layout: false,
      title: 'Beat Sales',
      currentPath: '/producer-dashboard/beat-sales',
      producer: { user: req.session.user },
      producerUser: req.session.user,
      sales,
      totalEarned,
      lifetimeEarned,
      filters: { searchArtist, dateFrom, dateTo },
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching beat sales:', error);
    req.flash('error', 'Failed to load beat sales');
    res.redirect('/producer-dashboard');
  }
});

// POST - Delete producer receipt
router.post('/beat-sales/:id/delete', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const BeatPurchase = require('../models/BeatPurchase');
    const purchase = await BeatPurchase.findOne({ _id: req.params.id, producer: req.session.user.id });
    if (!purchase) {
      req.flash('error', 'Receipt not found');
      return res.redirect('/producer-dashboard/beat-sales');
    }

    purchase.isDeletedByProducer = true;
    await purchase.save();

    req.flash('success', 'Sale record hidden from your dashboard');
    res.redirect('/producer-dashboard/beat-sales');
  } catch (error) {
    console.error('Error deleting producer receipt:', error);
    req.flash('error', 'Failed to delete sale record');
    res.redirect('/producer-dashboard/beat-sales');
  }
});

// GET - View specific receipt for producer
router.get('/beat-sales/:id/receipt', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const BeatPurchase = require('../models/BeatPurchase');
    const purchase = await BeatPurchase.findOne({ _id: req.params.id, producer: req.session.user.id })
      .populate('artist', 'name email')
      .populate('producer', 'name email')
      .populate('beat', 'title mediaType');

    if (!purchase) {
      req.flash('error', 'Receipt not found');
      return res.redirect('/producer-dashboard/beat-sales');
    }

    res.render('shared/receipt', {
      layout: false,
      purchase,
      backUrl: '/producer-dashboard/beat-sales'
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    req.flash('error', 'Failed to load receipt');
    res.redirect('/producer-dashboard/beat-sales');
  }
});

// POST - Edit a beat
router.post('/beats/:id/edit', isLoggedIn, requireProducerRole, upload.single('mediaFile'), async (req, res) => {
  try {
    const { title, price, mediaType, isActive } = req.body;
    const beat = await ProducerBeat.findOne({ _id: req.params.id, producer: req.session.user.id });

    if (!beat) {
      req.flash('error', 'Beat not found');
      return res.redirect('/producer-dashboard/beats');
    }

    if (title) beat.title = title.trim();
    if (price) beat.price = parseFloat(price);

    // Checkbox mapping
    beat.isActive = !!isActive;

    if (req.file) {
      // User replaced the media file
      beat.mediaType = mediaType || detectMediaType(req.file.mimetype) || beat.mediaType;

      const { media } = await uploadFileToCloudinary(req.file, {
        module: 'producerBeats',
        ownerType: 'producer',
        ownerId: req.session.user.id,
        folder: 'rapira/producer/beats'
      });
      beat.mediaUrl = media.secure_url;
      beat.publicId = media.public_id;
    } else if (mediaType) {
      beat.mediaType = mediaType;
    }

    await beat.save();

    req.flash('success', 'Beat updated successfully');
    res.redirect('/producer-dashboard/beats');

  } catch (error) {
    console.error('Error editing beat:', error);
    req.flash('error', 'Failed to update beat');
    res.redirect('/producer-dashboard/beats');
  }
});

// Helper if needed to guess type (multer memory upload has mimetype)
function detectMediaType(mimetype) {
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return null;
}

// POST - Delete a beat
router.post('/beats/:id/delete', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const beat = await ProducerBeat.findOne({ _id: req.params.id, producer: req.session.user.id });

    if (!beat) {
      req.flash('error', 'Beat not found');
      return res.redirect('/producer-dashboard/beats');
    }

    // Cloudinary delete is handled by util, but if we don't have it natively we just update status
    // or we delete the document
    await ProducerBeat.deleteOne({ _id: beat._id });

    req.flash('success', 'Beat deleted successfully');
    res.redirect('/producer-dashboard/beats');

  } catch (error) {
    console.error('Error deleting beat:', error);
    req.flash('error', 'Failed to delete beat');
    res.redirect('/producer-dashboard/beats');
  }
});

module.exports = router;
