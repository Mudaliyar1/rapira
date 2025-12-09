const express = require('express');
const router = express.Router();
const VenueRequest = require('../models/VenueRequest');
const WebsiteSettings = require('../models/WebsiteSettings');
const { isLoggedIn } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Import upload helper
const { createUpload } = require('../utils/uploadHelper');

// Configure multer for venue image uploads
const upload = createUpload({
  uploadType: 'venues',
  fileSize: 5 * 1024 * 1024, // 5MB limit
  filenameGenerator: (file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    return 'venue-request-' + uniqueSuffix + ext;
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// GET /users/venue-requests - View user's venue requests
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const venueRequests = await VenueRequest.getByUser(req.session.user.id);

    res.render('users/venue-requests/index', {
      title: 'My Venue Requests',
      venueRequests,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue requests:', error);
    req.flash('error', 'Failed to load venue requests');
    res.redirect('/users/profile');
  }
});

// GET /users/venue-requests/create - Create venue request form
router.get('/create', isLoggedIn, async (req, res) => {
  try {
    // Check if user has any pending venue requests
    const pendingRequest = await VenueRequest.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (pendingRequest) {
      req.flash('info', 'You already have a pending venue request. Please wait for admin approval before submitting another.');
      return res.redirect('/users/venue-requests');
    }

    res.render('users/venue-requests/create', {
      title: 'Request New Venue Registration',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue request form:', error);
    req.flash('error', 'Failed to load venue request form');
    res.redirect('/users/venue-requests');
  }
});

// POST /users/venue-requests/create - Submit venue request
router.post('/create', isLoggedIn, upload.array('images', 5), async (req, res) => {
  try {
    // Check if user has any pending venue requests
    const pendingRequest = await VenueRequest.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (pendingRequest) {
      req.flash('error', 'You already have a pending venue request. Please wait for admin approval.');
      return res.redirect('/users/venue-requests');
    }

    const {
      name, address, city, state, pincode, capacity, venueType,
      facilities, contactName, contactPhone, contactEmail,
      priceRange, description, googleMapsLink, website,
      minimumHours, minimumTicketPrice, suggestedTicketPrice
    } = req.body;

    // Validate required fields
    if (!name || !address || !city || !state) {
      req.flash('error', 'Please fill in all required fields (Name, Address, City, State)');
      return res.redirect('/users/venue-requests/create');
    }

    // Process uploaded images
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(`/uploads/venues/${file.filename}`);
      });
    }

    // Process facilities (convert to array if it's a string)
    let facilitiesArray = [];
    if (facilities) {
      if (Array.isArray(facilities)) {
        facilitiesArray = facilities;
      } else {
        facilitiesArray = [facilities];
      }
    }

    // Get default commission from website settings
    const settings = await WebsiteSettings.getSettings();
    const defaultCommission = settings.venueSettings.defaultCommissionPercentage || 10;

    // Process hourly rates (1-24 hours)
    const hourlyRates = [];
    for (let i = 1; i <= 24; i++) {
      const rateKey = `hourlyRate_${i}`;
      const rate = req.body[rateKey];
      
      // Only add if rate is provided
      if (rate && parseFloat(rate) > 0) {
        const rateValue = parseFloat(rate);
        const commissionAmount = (rateValue * defaultCommission) / 100;
        
        hourlyRates.push({
          hours: i,
          rate: rateValue,
          commissionPercentage: defaultCommission,
          commissionAmount: commissionAmount
        });
      }
    }

    // Create venue request
    const venueRequest = new VenueRequest({
      user: req.session.user.id,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode ? pincode.trim() : '',
      capacity: capacity ? parseInt(capacity) : null,
      venueType: venueType || 'Indoor Hall',
      facilities: facilitiesArray,
      contactPerson: {
        name: contactName ? contactName.trim() : '',
        phone: contactPhone ? contactPhone.trim() : '',
        email: contactEmail ? contactEmail.trim().toLowerCase() : ''
      },
      priceRange: priceRange || 'Mid-Range',
      pricing: {
        hourlyRates: hourlyRates,
        minimumHours: minimumHours ? parseInt(minimumHours) : 1,
        currency: 'INR',
        ticketPricing: {
          minimumPrice: minimumTicketPrice ? parseFloat(minimumTicketPrice) : 0,
          suggestedPrice: suggestedTicketPrice ? parseFloat(suggestedTicketPrice) : 100
        }
      },
      description: description ? description.trim() : '',
      images: images,
      googleMapsLink: googleMapsLink ? googleMapsLink.trim() : '',
      website: website ? website.trim() : ''
    });

    await venueRequest.save();

    req.flash('success', 'Venue registration request submitted successfully! Please wait for admin approval.');
    res.redirect('/users/venue-requests');
  } catch (error) {
    console.error('Error creating venue request:', error);
    req.flash('error', 'Failed to submit venue request. Please try again.');
    res.redirect('/users/venue-requests/create');
  }
});

// GET /users/venue-requests/:id - View specific venue request details
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findOne({
      _id: req.params.id,
      user: req.session.user.id // Ensure user can only view their own requests
    })
    .populate('reviewedBy', 'name email')
    .populate('createdVenue', 'name isActive');

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/users/venue-requests');
    }

    res.render('users/venue-requests/details', {
      title: `Venue Request - ${venueRequest.name}`,
      venueRequest,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue request details:', error);
    req.flash('error', 'Failed to load venue request details');
    res.redirect('/users/venue-requests');
  }
});

// GET /users/venue-requests/:id/cancel - Confirm cancellation page
router.get('/:id/cancel', isLoggedIn, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findOne({
      _id: req.params.id,
      user: req.session.user.id,
      status: 'pending'
    });

    if (!venueRequest) {
      req.flash('error', 'Venue request not found or cannot be cancelled');
      return res.redirect('/users/venue-requests');
    }

    res.render('users/venue-requests/cancel', {
      title: 'Cancel Venue Request',
      venueRequest,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading cancel page:', error);
    req.flash('error', 'Failed to load cancel page');
    res.redirect('/users/venue-requests');
  }
});

// POST /users/venue-requests/:id/cancel - Cancel pending venue request
router.post('/:id/cancel', isLoggedIn, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findOne({
      _id: req.params.id,
      user: req.session.user.id,
      status: 'pending'
    });

    if (!venueRequest) {
      req.flash('error', 'Venue request not found or cannot be cancelled');
      return res.redirect('/users/venue-requests');
    }

    venueRequest.status = 'cancelled';
    venueRequest.cancelReason = req.body.cancelReason || '';
    venueRequest.cancelledAt = new Date();
    venueRequest.cancelledBy = req.session.user.id;
    await venueRequest.save();

    req.flash('success', 'Venue request cancelled successfully');
    res.redirect('/users/venue-requests');
  } catch (error) {
    console.error('Error cancelling venue request:', error);
    req.flash('error', 'Failed to cancel venue request');
    res.redirect('/users/venue-requests');
  }
});

module.exports = router;
