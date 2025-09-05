const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Concert = require('../models/Concert');
const VenueEditRequest = require('../models/VenueEditRequest');
const WebsiteSettings = require('../models/WebsiteSettings');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isLoggedIn } = require('../middleware/auth');

// Configure multer for venue image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/uploads/venues/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET /users/venues - View user's registered venues
router.get('/', isLoggedIn, async (req, res) => {
  try {
    // Get venues created by this user
    const venues = await Venue.find({ createdBy: req.session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    // Get booking statistics for each venue
    const venuesWithStats = await Promise.all(venues.map(async (venue) => {
      const totalBookings = await Concert.countDocuments({ venue: venue._id });
      const activeBookings = await Concert.countDocuments({ 
        venue: venue._id, 
        status: 'approved',
        date: { $gte: new Date() }
      });
      const pendingBookings = await Concert.countDocuments({ 
        venue: venue._id, 
        status: 'pending'
      });

      return {
        ...venue,
        stats: {
          totalBookings,
          activeBookings,
          pendingBookings
        }
      };
    }));

    res.render('users/venues/index', {
      title: 'My Registered Venues',
      venues: venuesWithStats,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading user venues:', error);
    req.flash('error', 'Failed to load your venues');
    res.redirect('/users/profile');
  }
});

// GET /users/venues/:id - View specific venue details with bookings
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.id,
      createdBy: req.session.user.id // Ensure user can only view their own venues
    });

    if (!venue) {
      req.flash('error', 'Venue not found or you do not have access to it');
      return res.redirect('/users/venues');
    }

    // Get bookings for this venue
    const bookings = await Concert.find({ venue: venue._id })
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ date: -1 })
      .lean();

    // Calculate revenue and statistics
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter(b => b.status === 'confirmed' && new Date(b.date) >= new Date()).length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const completedBookings = bookings.filter(b => b.status === 'confirmed' && new Date(b.date) < new Date()).length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

    // Calculate total revenue from commission
    let totalRevenue = 0;
    bookings.forEach(booking => {
      if (booking.status === 'confirmed' && booking.venueBooking) {
        const hours = booking.venueBooking.bookingHours || 1;
        const rate = booking.venueBooking.totalCost / hours;
        const commissionRate = booking.venueBooking.commissionPercentage || 10;
        const commission = (rate * commissionRate) / 100;
        totalRevenue += commission * hours;
      }
    });

    // Get recent bookings for sidebar
    const recentBookings = bookings
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .slice(0, 5);

    res.render('users/venues/details', {
      title: `${venue.name} - Venue Details`,
      venue,
      bookings,
      bookingStats: {
        totalBookings,
        activeBookings,
        pendingBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue
      },
      recentBookings,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue details:', error);
    req.flash('error', 'Failed to load venue details');
    res.redirect('/users/venues');
  }
});

// GET /users/venues/:id/bookings - View venue bookings calendar
router.get('/:id/bookings', isLoggedIn, async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.id,
      createdBy: req.session.user.id
    });

    if (!venue) {
      req.flash('error', 'Venue not found or you do not have access to it');
      return res.redirect('/users/venues');
    }

    const { month, year } = req.query;
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();

    // Get start and end of the month
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0);

    console.log('Fetching bookings for venue:', venue.name);
    console.log('Date range:', startOfMonth, 'to', endOfMonth);

    // Get all bookings for this venue (not limited to current month for initial load)
    const bookings = await Concert.find({
      venue: venue._id
    })
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name email' }
    })
    .sort({ date: 1, time: 1 })
    .lean();

    console.log('Found bookings:', bookings.length);
    if (bookings.length > 0) {
      console.log('Sample booking:', JSON.stringify(bookings[0], null, 2));
    }

    res.render('users/venues/bookings-new', {
      title: `${venue.name} - Venue Bookings`,
      venue,
      bookings,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue bookings:', error);
    req.flash('error', 'Failed to load venue bookings');
    res.redirect(`/users/venues/${req.params.id}`);
  }
});

// GET /users/venues/:id/edit - Show venue edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const venue = await Venue.findOne({ 
      _id: req.params.id, 
      owner: req.session.user._id 
    });
    
    if (!venue) {
      req.flash('error', 'Venue not found or you do not have permission to edit it');
      return res.redirect('/users/venues');
    }

    // Check if there's already a pending edit request
    const pendingRequest = await VenueEditRequest.findOne({
      venue: venue._id,
      status: 'pending'
    });

    if (pendingRequest) {
      req.flash('error', 'You already have a pending edit request for this venue. Please wait for admin approval.');
      return res.redirect(`/users/venues/${venue._id}`);
    }

    res.render('users/venues/edit', {
      title: `Edit ${venue.name}`,
      venue,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue edit form:', error);
    req.flash('error', 'Failed to load venue edit form');
    res.redirect('/users/venues');
  }
});

// POST /users/venues/:id/edit - Submit venue edit request
router.post('/:id/edit', upload.array('newImages', 10), async (req, res) => {
  try {
    const venue = await Venue.findOne({ 
      _id: req.params.id, 
      owner: req.session.user._id 
    });
    
    if (!venue) {
      req.flash('error', 'Venue not found or you do not have permission to edit it');
      return res.redirect('/users/venues');
    }

    // Check if there's already a pending edit request
    const pendingRequest = await VenueEditRequest.findOne({
      venue: venue._id,
      status: 'pending'
    });

    if (pendingRequest) {
      req.flash('error', 'You already have a pending edit request for this venue. Please wait for admin approval.');
      return res.redirect(`/users/venues/${venue._id}`);
    }

    const {
      name, address, city, state, zipCode, contactNumber, email, website,
      description, venueType, capacity, priceRange, facilities, reason,
      pricing, imagesToRemove
    } = req.body;

    // Get default commission from website settings
    const settings = await WebsiteSettings.getSettings();
    const defaultCommission = settings.venueSettings.defaultCommissionPercentage || 10;

    // Process hourly rates (1-24 hours)
    const hourlyRatesArray = [];
    if (pricing.hourlyRates && Array.isArray(pricing.hourlyRates)) {
      for (let i = 0; i < pricing.hourlyRates.length; i++) {
        const hourData = pricing.hourlyRates[i];
        if (hourData && hourData.rate && parseFloat(hourData.rate) > 0) {
          const rateValue = parseFloat(hourData.rate);
          const commissionAmount = (rateValue * defaultCommission) / 100;
          
          hourlyRatesArray.push({
            hours: parseInt(hourData.hours) || (i + 1),
            rate: rateValue,
            commissionPercentage: defaultCommission,
            commissionAmount: commissionAmount
          });
        }
      }
    }

    // Process pricing data
    const pricingData = {
      hourlyRates: hourlyRatesArray,
      minimumHours: parseInt(pricing.minimumHours) || 1,
      currency: pricing.currency || 'INR',
      adminCommission: {
        percentage: defaultCommission,
        advanceAmount: parseInt(pricing.adminCommission?.advanceAmount) || 0
      },
      ticketPricing: {
        minimumPrice: parseInt(pricing.ticketPricing?.minimumPrice) || 10,
        suggestedPrice: parseInt(pricing.ticketPricing?.suggestedPrice) || 1000
      },
      additionalCharges: {}
    };

    // Handle new image uploads
    const newImages = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        newImages.push(`/uploads/venues/${file.filename}`);
      });
    }

    // Prepare the requested changes
    const requestedChanges = {
      name,
      address,
      city,
      state,
      zipCode,
      contactNumber,
      email: email || '',
      website: website || '',
      description: description || '',
      venueType,
      capacity: parseInt(capacity),
      priceRange,
      facilities: Array.isArray(facilities) ? facilities : (facilities ? [facilities] : []),
      pricing: pricingData
    };

    // Store original data for comparison
    const originalData = {
      name: venue.name,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      zipCode: venue.zipCode,
      contactNumber: venue.contactNumber,
      email: venue.email || '',
      website: venue.website || '',
      description: venue.description || '',
      venueType: venue.venueType,
      capacity: venue.capacity,
      priceRange: venue.priceRange,
      facilities: venue.facilities || [],
      pricing: venue.pricing || {}
    };

    // Determine which fields have changed
    const changedFields = [];
    Object.keys(requestedChanges).forEach(key => {
      if (key === 'facilities') {
        const originalFacilities = originalData.facilities.sort();
        const newFacilities = requestedChanges.facilities.sort();
        if (JSON.stringify(originalFacilities) !== JSON.stringify(newFacilities)) {
          changedFields.push(key);
        }
      } else if (key === 'pricing') {
        if (JSON.stringify(originalData.pricing) !== JSON.stringify(requestedChanges.pricing)) {
          changedFields.push(key);
        }
      } else if (originalData[key] != requestedChanges[key]) {
        changedFields.push(key);
      }
    });

    // Check if images are being changed
    if (newImages.length > 0) {
      changedFields.push('newImages');
    }
    if (imagesToRemove && imagesToRemove.length > 0) {
      changedFields.push('imagesToRemove');
    }

    // Check if any changes were made
    if (changedFields.length === 0 && (!newImages.length) && (!imagesToRemove || imagesToRemove.length === 0)) {
      req.flash('error', 'No changes detected. Please make some changes before submitting.');
      return res.redirect(`/users/venues/${venue._id}/edit`);
    }

    // Create the edit request
    const editRequest = new VenueEditRequest({
      venue: venue._id,
      user: req.session.user.id,
      originalData,
      requestedChanges,
      changedFields,
      reason,
      newImages,
      imagesToRemove: Array.isArray(imagesToRemove) ? imagesToRemove : (imagesToRemove ? [imagesToRemove] : [])
    });

    await editRequest.save();

    req.flash('success', 'Edit request submitted successfully! You will be notified once it is reviewed by an administrator.');
    res.redirect(`/users/venues/${venue._id}`);

  } catch (error) {
    console.error('Error submitting venue edit request:', error);
    req.flash('error', 'Failed to submit edit request');
    res.redirect(`/users/venues/${req.params.id}/edit`);
  }
});

// GET /users/venues/:venueId/bookings/:bookingId - View specific booking details
router.get('/:venueId/bookings/:bookingId', isLoggedIn, async (req, res) => {
  try {
    const { venueId, bookingId } = req.params;
    
    // Verify venue ownership
    const venue = await Venue.findOne({
      _id: venueId,
      createdBy: req.session.user.id
    });

    if (!venue) {
      req.flash('error', 'Venue not found or you do not have access to it');
      return res.redirect('/users/venues');
    }

    // Get the specific booking
    const booking = await Concert.findOne({
      _id: bookingId,
      venue: venueId
    })
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name email phone createdAt' }
    })
    .lean();

    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect(`/users/venues/${venueId}/bookings`);
    }

    res.render('users/venues/booking-details', {
      title: `Booking Details - ${venue.name}`,
      venue,
      booking,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading booking details:', error);
    req.flash('error', 'Failed to load booking details');
    res.redirect(`/users/venues/${req.params.venueId}/bookings`);
  }
});

// PUT /users/venues/bookings/:id/status - Update booking status
router.put('/bookings/:id/status', isLoggedIn, async (req, res) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;

    // Validate status
    if (!['approved', 'confirmed', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved, confirmed, rejected, or cancelled.'
      });
    }

    // Find the booking and verify ownership
    const booking = await Concert.findById(bookingId).populate('venue');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns the venue
    if (booking.venue.createdBy.toString() !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this booking'
      });
    }

    // Check if booking can be updated
    if (!['pending', 'approved'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be updated in its current status'
      });
    }

    // Update booking status
    booking.status = status;
    booking.venueApprovedAt = new Date();
    booking.venueApprovedBy = req.session.user.id;
    
    await booking.save();

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      booking: {
        id: booking._id,
        status: booking.status,
        venueApprovedAt: booking.venueApprovedAt
      }
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status'
    });
  }
});

// GET /users/venues/bookings/:id/receipt - Download booking receipt
router.get('/bookings/:id/receipt', isLoggedIn, async (req, res) => {
  try {
    const bookingId = req.params.id;

    // Find the booking and verify ownership
    const booking = await Concert.findById(bookingId)
      .populate('venue')
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      });
    
    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('back');
    }

    // Check if user owns the venue
    if (booking.venue.createdBy.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to access this booking');
      return res.redirect('back');
    }

    // Check if booking is confirmed
    if (booking.status !== 'confirmed') {
      req.flash('error', 'Receipt is only available for confirmed bookings');
      return res.redirect('back');
    }

    // Generate simple receipt HTML
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking Receipt - ${booking.venue.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .receipt-details { margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>VENUE BOOKING RECEIPT</h1>
          <h2>${booking.venue.name}</h2>
          <p>${booking.venue.address}, ${booking.venue.city}, ${booking.venue.state}</p>
        </div>
        
        <div class="receipt-details">
          <div class="detail-row"><strong>Receipt ID:</strong> <span>VB-${booking._id.toString().slice(-8).toUpperCase()}</span></div>
          <div class="detail-row"><strong>Event Title:</strong> <span>${booking.title || 'Concert Event'}</span></div>
          <div class="detail-row"><strong>Artist:</strong> <span>${booking.artist ? (booking.artist.stageName || booking.artist.user.name) : 'TBD'}</span></div>
          <div class="detail-row"><strong>Date:</strong> <span>${new Date(booking.date).toLocaleDateString('en-IN')}</span></div>
          <div class="detail-row"><strong>Time:</strong> <span>${booking.time || 'TBD'}</span></div>
          <div class="detail-row"><strong>Duration:</strong> <span>${booking.venueBooking?.bookingHours || 'TBD'} hours</span></div>
          <div class="detail-row"><strong>Status:</strong> <span style="color: green;">CONFIRMED</span></div>
          <div class="detail-row"><strong>Venue Cost:</strong> <span>₹${booking.venueBooking?.totalCost ? booking.venueBooking.totalCost.toLocaleString('en-IN') : 'TBD'}</span></div>
          <div class="detail-row"><strong>Booking Date:</strong> <span>${new Date(booking.createdAt || booking.date).toLocaleDateString('en-IN')}</span></div>
          <div class="detail-row"><strong>Confirmed Date:</strong> <span>${booking.venueApprovedAt ? new Date(booking.venueApprovedAt).toLocaleDateString('en-IN') : 'N/A'}</span></div>
        </div>
        
        <div class="footer">
          <p>This is a computer-generated receipt. Thank you for choosing our venue!</p>
          <p>Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}</p>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="booking-receipt-${booking._id}.html"`);
    res.send(receiptHTML);
  } catch (error) {
    console.error('Error generating receipt:', error);
    req.flash('error', 'Failed to generate receipt');
    res.redirect('back');
  }
});

module.exports = router;
