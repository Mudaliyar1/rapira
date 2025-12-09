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
    const WebsiteSettings = require('../models/WebsiteSettings');
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

    // Get website settings for commission defaults
    const settings = await WebsiteSettings.getSettings();
    const defaultCommissionPercentage = settings.venueSettings?.defaultCommissionPercentage || 10;
    const allowUserCommissionEdit = settings.venueSettings?.allowUserCommissionEdit || false;

    res.render('users/venues/edit', {
      title: `Edit ${venue.name}`,
      venue,
      user: req.session.user,
      defaultCommissionPercentage,
      allowUserCommissionEdit
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
    const WebsiteSettings = require('../models/WebsiteSettings');
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
      name, address, city, state, pincode, contactName, contactPhone, contactEmail, website,
      description, venueType, capacity, priceRange, facilities, reason,
      pricing, imagesToRemove
    } = req.body;

    // Get website settings for commission defaults
    const settings = await WebsiteSettings.getSettings();
    const defaultCommission = settings.venueSettings?.defaultCommissionPercentage || 10;
    const allowUserCommissionEdit = settings.venueSettings?.allowUserCommissionEdit || false;

    // Process hourly rates (1-24 hours)
    const hourlyRatesArray = [];
    if (pricing.hourlyRates && Array.isArray(pricing.hourlyRates)) {
      for (let i = 0; i < pricing.hourlyRates.length; i++) {
        const hourData = pricing.hourlyRates[i];
        if (hourData && hourData.rate && parseFloat(hourData.rate) > 0) {
          const rateValue = parseFloat(hourData.rate);
          // Use admin default if user edit is disabled
          const commissionToUse = allowUserCommissionEdit ? (parseFloat(hourData.commissionPercentage) || defaultCommission) : defaultCommission;
          const commissionAmount = (rateValue * commissionToUse) / 100;
          
          hourlyRatesArray.push({
            hours: parseInt(hourData.hours) || (i + 1),
            rate: rateValue,
            commissionPercentage: commissionToUse,
            commissionAmount: commissionAmount
          });
        }
      }
    }

    // Process pricing data
    // Commission percentage: use submitted value if allowed, otherwise use admin default
    const commissionPercentage = allowUserCommissionEdit 
      ? (parseFloat(pricing.adminCommission?.percentage) || defaultCommission) 
      : defaultCommission;
    
    const pricingData = {
      hourlyRates: hourlyRatesArray,
      minimumHours: parseInt(pricing.minimumHours) || 1,
      currency: pricing.currency || 'INR',
      adminCommission: {
        percentage: commissionPercentage
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
      pincode: pincode || '',
      contactName: contactName || '',
      contactPhone: contactPhone || '',
      contactEmail: contactEmail || '',
      website: website || '',
      googleMapsLink: req.body.googleMapsLink || '',
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
      pincode: venue.pincode || '',
      contactName: venue.contactPerson?.name || '',
      contactPhone: venue.contactPerson?.phone || '',
      contactEmail: venue.contactPerson?.email || '',
      website: venue.website || '',
      googleMapsLink: venue.googleMapsLink || '',
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

    // Allow receipt for approved/confirmed bookings (artist has paid commission)
    if (!['approved', 'confirmed'].includes(booking.status)) {
      req.flash('error', 'Receipt is only available for approved bookings');
      return res.redirect('back');
    }

    // Financial calculations
    const totalVenueCost = booking.venueBooking?.totalVenueCost || 0;
    const commissionPercentage = booking.venueBooking?.adminCommission?.percentage || 0;
    const commissionAmount = (totalVenueCost * commissionPercentage) / 100;
    
    // Get actual commission paid from database
    const storedCommission = booking.venueBooking?.adminCommission?.advanceAmount;
    const commissionPaid = Number.isFinite(storedCommission) && storedCommission > 0 
      ? storedCommission 
      : 0;
    
    // Get actual artist direct payment from database
    const artistPaidDirect = booking.venueBooking?.amountPaidByArtist || 0;
    
    // Total paid by artist (commission + direct payment)
    const totalArtistPaid = commissionPaid + artistPaidDirect;
    
    // Remaining is the total cost minus total paid
    const remainingBalance = Math.max(totalVenueCost - totalArtistPaid, 0);

    // Generate professional receipt HTML with styling
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Booking Receipt - ${booking.venue.name}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <style>
          * { margin: 0; padding: 0; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f5f5f5;
            padding: 20px;
          }
          .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }
          .header h1 { 
            font-size: 32px; 
            margin-bottom: 10px;
            font-weight: bold;
          }
          .header p { 
            font-size: 16px; 
            opacity: 0.9;
            margin: 5px 0;
          }
          .content { padding: 40px; }
          .section { margin-bottom: 30px; }
          .section-title { 
            font-size: 16px;
            font-weight: bold;
            color: #333;
            background: #f0f4ff;
            padding: 12px 15px;
            border-left: 4px solid #667eea;
            margin-bottom: 15px;
            border-radius: 4px;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px;
            margin-bottom: 15px;
          }
          .info-item { 
            background: #f9f9f9;
            padding: 12px;
            border-radius: 4px;
            border: 1px solid #eee;
          }
          .info-label { 
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
            font-weight: 600;
          }
          .info-value { 
            font-size: 14px;
            color: #333;
            font-weight: 500;
          }
          .highlight { color: #667eea; font-weight: bold; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
          }
          table thead {
            background: #667eea;
            color: white;
          }
          table th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
            font-size: 13px;
          }
          table tbody tr:last-child td {
            border-bottom: none;
          }
          .financial-summary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            font-size: 14px;
          }
          .summary-row:last-child {
            border-bottom: none;
            font-size: 18px;
            font-weight: bold;
            padding-top: 15px;
          }
          .amount { font-weight: bold; }
          .status-approved { color: #28a745; font-weight: bold; }
          .footer { 
            background: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
          }
          .divider { 
            border-top: 2px dashed #ddd;
            margin: 20px 0;
          }
          
          /* Print styles */
          @media print {
            body { 
              background: white; 
              padding: 0; 
            }
            .container { 
              box-shadow: none; 
              border-radius: 0; 
            }
            button { 
              display: none !important; 
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>VENUE BOOKING RECEIPT</h1>
            <p>Receipt ID: <strong>VB-${booking._id.toString().slice(-8).toUpperCase()}</strong></p>
            <p style="margin-top: 15px; font-size: 14px;">Date Generated: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}</p>
          </div>

          <!-- Content -->
          <div class="content">
            <!-- Venue Info Section -->
            <div class="section">
              <div class="section-title">📍 VENUE INFORMATION</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Venue Name</div>
                  <div class="info-value">${booking.venue.name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Venue Type</div>
                  <div class="info-value">${booking.venue.venueType || 'Not Specified'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Address</div>
                  <div class="info-value">${booking.venue.address}, ${booking.venue.city}, ${booking.venue.state}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Venue Capacity</div>
                  <div class="info-value"><span class="highlight">${booking.venue.capacity || 'N/A'}</span> seats</div>
                </div>
              </div>
            </div>

            <!-- Event Info Section -->
            <div class="section">
              <div class="section-title">🎵 EVENT INFORMATION</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Event Title</div>
                  <div class="info-value">${booking.title || 'Concert Event'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Event Status</div>
                  <div class="info-value"><span class="status-approved">✓ ${booking.status.toUpperCase()}</span></div>
                </div>
                <div class="info-item">
                  <div class="info-label">Event Date</div>
                  <div class="info-value"><strong>${new Date(booking.date).toLocaleDateString('en-IN', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</strong></div>
                </div>
                <div class="info-item">
                  <div class="info-label">Event Time</div>
                  <div class="info-value">${booking.time || 'TBD'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Duration</div>
                  <div class="info-value"><span class="highlight">${booking.venueBooking?.bookingHours || '0'}</span> hours</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Event Type</div>
                  <div class="info-value">${booking.eventType || 'Live Performance'}</div>
                </div>
              </div>
            </div>

            <!-- Artist Info Section -->
            <div class="section">
              <div class="section-title">🎤 ARTIST INFORMATION</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Artist Stage Name</div>
                  <div class="info-value">${booking.artist?.stageName || 'Not Provided'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Real Name</div>
                  <div class="info-value">${booking.artist?.user?.name || 'Not Provided'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Email</div>
                  <div class="info-value">${booking.artist?.user?.email || 'Not Provided'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Genre</div>
                  <div class="info-value">${booking.artist?.genre || 'Not Specified'}</div>
                </div>
              </div>
            </div>

            <!-- Seat Allocation Section -->
            <div class="section">
              <div class="section-title">🎫 SEAT ALLOCATION</div>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Seats</th>
                    <th style="text-align: right;">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Venue Capacity</td>
                    <td style="text-align: right; font-weight: bold;">${booking.venue.capacity || '0'} seats</td>
                    <td style="text-align: right;">100%</td>
                  </tr>
                  <tr style="background: #f0f4ff;">
                    <td><strong>Allocated to Artist</strong></td>
                    <td style="text-align: right; color: #667eea; font-weight: bold;">${booking.maxTickets || 'Unlimited'} seats</td>
                    <td style="text-align: right; color: #667eea; font-weight: bold;">${booking.venue.capacity && booking.maxTickets ? ((booking.maxTickets / booking.venue.capacity) * 100).toFixed(1) : 'N/A'}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Financial Summary -->
            <div class="section">
              <div class="section-title">💰 FINANCIAL DETAILS</div>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Venue Booking Cost</td>
                    <td style="text-align: right; font-weight: bold;">₹${totalVenueCost.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>Commission Rate (% of Total Cost)</td>
                    <td style="text-align: right; font-weight: bold;">${commissionPercentage}%</td>
                  </tr>
                  <tr style="background: #e3f2fd;">
                    <td><strong>Commission Amount (Paid by Artist)</strong></td>
                    <td style="text-align: right; color: #1976d2; font-weight: bold;">✓ ₹${commissionPaid.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  <tr style="background: #fff3e0;">
                    <td><strong>Additional Artist Payment</strong></td>
                    <td style="text-align: right; color: #e65100; font-weight: bold;">₹${artistPaidDirect.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  <tr style="background: #f3e5f5;">
                    <td><strong>Remaining Balance (To Venue Owner)</strong></td>
                    <td style="text-align: right; color: #7b1fa2; font-weight: bold;">₹${remainingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                </tbody>
              </table>

              <div class="financial-summary">
                <div class="summary-row">
                  <span>Total Venue Cost:</span>
                  <span class="amount">₹${totalVenueCost.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-row">
                  <span>Commission % Paid:</span>
                  <span class="amount">✓ ₹${commissionPaid.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="summary-row">
                  <span>Additional Artist Payment:</span>
                  <span class="amount">₹${artistPaidDirect.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="summary-row">
                  <span>Total Paid by Artist:</span>
                  <span class="amount">₹${totalArtistPaid.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="summary-row">
                  <span>Remaining Balance:</span>
                  <span class="amount">₹${remainingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>

            <!-- Booking Timeline -->
            <div class="section">
              <div class="section-title">📅 BOOKING TIMELINE</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Booking Created Date</div>
                  <div class="info-value">${new Date(booking.createdAt || booking.date).toLocaleDateString('en-IN')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Approval/Confirmation Date</div>
                  <div class="info-value">${booking.venueApprovedAt ? new Date(booking.venueApprovedAt).toLocaleDateString('en-IN') : new Date(booking.createdAt || booking.date).toLocaleDateString('en-IN')}</div>
                </div>
              </div>
            </div>

            <div class="divider"></div>
            
            <!-- Download Button -->
            <div id="downloadSection" style="text-align: center; margin: 30px 0;">
              <button onclick="downloadPDF()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 15px 40px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                📥 Download as PDF
              </button>
              <p style="color: #666; font-size: 12px; margin-top: 10px;">Click the button to download this receipt as PDF</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p><strong>RAPIRA - Professional Venue Booking Platform</strong></p>
            <p>This is an official computer-generated receipt for your venue booking.</p>
            <p>For any queries, please contact the venue management or visit our platform.</p>
            <p style="margin-top: 15px; color: #999;">Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')} | Receipt ID: VB-${booking._id.toString().slice(-8).toUpperCase()}</p>
          </div>
        </div>
        
        <script>
          function downloadPDF() {
            const button = document.querySelector('button');
            const downloadSection = document.getElementById('downloadSection');
            button.disabled = true;
            button.textContent = '⏳ Generating PDF...';
            
            // Hide download section
            downloadSection.style.display = 'none';
            
            const element = document.querySelector('.container');
            
            const opt = {
              margin: 10,
              filename: 'booking-receipt-${booking._id.toString().slice(-8).toUpperCase()}.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { 
                scale: 2,
                useCORS: true,
                letterRendering: true,
                scrollY: 0,
                scrollX: 0
              },
              jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true
              },
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            
            html2pdf().set(opt).from(element).save().then(() => {
              downloadSection.style.display = 'block';
              button.disabled = false;
              button.textContent = '📥 Download as PDF';
            }).catch((error) => {
              console.error('Error generating PDF:', error);
              downloadSection.style.display = 'block';
              button.disabled = false;
              button.textContent = '❌ Error - Try Again';
            });
          }
        </script>
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

// GET /users/venues/:venueId/revenue-analytics - Revenue analytics for venue
router.get('/:venueId/revenue-analytics', isLoggedIn, async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      createdBy: req.session.user.id
    });

    if (!venue) {
      req.flash('error', 'Venue not found or you do not have access to it');
      return res.redirect('/users/venues');
    }

    // Filters
    const { concertId, startDate, endDate } = req.query;

    // Fetch all bookings for filter dropdowns
    const allBookings = await Concert.find({
      venue: venue._id,
      status: { $in: ['approved', 'confirmed'] }
    })
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name email' }
    })
    .sort({ date: -1 })
    .lean();

    // Apply filters in-memory for consistency with populated data
    const filteredBookings = allBookings.filter(booking => {
      const matchConcert = concertId ? booking._id.toString() === concertId : true;

      let matchDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchDate = matchDate && new Date(booking.date) >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchDate = matchDate && new Date(booking.date) <= end;
      }

      return matchConcert && matchDate;
    });

    // Calculate revenue analytics
    const analytics = {
      totalBookings: filteredBookings.length,
      totalVenueCost: 0,
      totalArtistPaid: 0,
      totalPending: 0,
      bookingDetails: []
    };

    filteredBookings.forEach(booking => {
      const totalCost = booking.venueBooking?.totalVenueCost || 0;
      const commissionPercentage = booking.venueBooking?.adminCommission?.percentage || 0;
      const storedCommission = booking.venueBooking?.adminCommission?.advanceAmount;
      const commissionPaid = Number.isFinite(storedCommission) && storedCommission > 0
        ? storedCommission
        : (booking.venueBooking?.isPaid && commissionPercentage > 0
            ? (totalCost * commissionPercentage) / 100
            : 0);

      const artistPaidDirect = booking.venueBooking?.amountPaidByArtist || 0;
      const artistPaidTotal = artistPaidDirect + commissionPaid;

      // Pending = total cost - (commission already collected) - (any additional amount paid to venue)
      const pendingRaw = totalCost - artistPaidTotal;
      const pending = pendingRaw > 0 ? pendingRaw : 0;
      const paymentStatus = pending <= 0 ? 'Full Paid' : pending === totalCost ? 'No Payment' : 'Partial Paid';

      analytics.totalVenueCost += totalCost;
      analytics.totalArtistPaid += artistPaidTotal;
      analytics.totalPending += pending;

      analytics.bookingDetails.push({
        id: booking._id,
        title: booking.title,
        artistName: booking.artist?.stageName || booking.artist?.user?.name || 'Unknown',
        date: booking.date,
        totalCost,
        artistPaid: artistPaidTotal,
        pending,
        paymentStatus,
        commissionPercentage,
        commissionPaid
      });
    });

    res.render('venues/revenue-analytics', {
      title: `${venue.name} - Revenue Analytics`,
      venue,
      analytics,
      filters: {
        concertId: concertId || '',
        startDate: startDate || '',
        endDate: endDate || ''
      },
      availableConcerts: allBookings.map(b => ({
        id: b._id,
        title: b.title,
        date: b.date
      })),
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading revenue analytics:', error);
    req.flash('error', 'Failed to load revenue analytics');
    res.redirect('/users/venues');
  }
});

// GET /users/venues/bookings/:id/edit-payment - Dedicated page to edit artist payment
router.get('/bookings/:id/edit-payment', isLoggedIn, async (req, res) => {
  try {
    const booking = await Concert.findById(req.params.id)
      .populate({ path: 'venue' })
      .populate({ path: 'artist', populate: { path: 'user', select: 'name email' } })
      .lean();

    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/users/venues');
    }

    if (booking.venue?.createdBy.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to edit this booking payment');
      return res.redirect('/users/venues');
    }

    const totalCost = booking.venueBooking?.totalVenueCost || 0;
    const commissionPercentage = booking.venueBooking?.adminCommission?.percentage || 0;
    const storedCommission = booking.venueBooking?.adminCommission?.advanceAmount;
    const commissionPaid = Number.isFinite(storedCommission) && storedCommission > 0
      ? storedCommission
      : (booking.venueBooking?.isPaid && commissionPercentage > 0
          ? (totalCost * commissionPercentage) / 100
          : 0);

    const artistPaidDirect = booking.venueBooking?.amountPaidByArtist || 0;
    const artistPaidTotal = artistPaidDirect + commissionPaid;
    const pending = Math.max(totalCost - artistPaidTotal, 0);

    const returnTo = req.query.returnTo || `/users/venues/${booking.venue._id}/revenue-analytics`;

    res.render('venues/edit-payment', {
      title: `${booking.title} - Edit Payment`,
      bookingView: {
        id: booking._id,
        title: booking.title,
        artistName: booking.artist?.stageName || booking.artist?.user?.name || 'Unknown',
        date: booking.date,
        totalCost,
        commissionPercentage,
        commissionPaid,
        artistPaidDirect,
        artistPaidTotal,
        pending
      },
      venue: booking.venue,
      returnTo,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading payment edit page:', error);
    req.flash('error', 'Failed to load payment edit page');
    res.redirect('/users/venues');
  }
});

// GET /users/venues/bookings/:id/confirm-payment - Show confirmation page before updating
router.get('/bookings/:id/confirm-payment', isLoggedIn, async (req, res) => {
  try {
    const { amount, returnTo } = req.query;
    const newAmount = parseFloat(amount);

    if (isNaN(newAmount) || newAmount < 0) {
      req.flash('error', 'Invalid amount provided');
      return res.redirect('/users/venues');
    }

    const booking = await Concert.findById(req.params.id)
      .populate({ path: 'venue' })
      .populate({ path: 'artist', populate: { path: 'user', select: 'name email' } })
      .lean();

    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/users/venues');
    }

    if (booking.venue?.createdBy.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to edit this booking payment');
      return res.redirect('/users/venues');
    }

    const totalCost = booking.venueBooking?.totalVenueCost || 0;
    const commissionPercentage = booking.venueBooking?.adminCommission?.percentage || 0;
    const storedCommission = booking.venueBooking?.adminCommission?.advanceAmount;
    const commissionPaid = Number.isFinite(storedCommission) && storedCommission > 0
      ? storedCommission
      : (booking.venueBooking?.isPaid && commissionPercentage > 0
          ? (totalCost * commissionPercentage) / 100
          : 0);

    const artistPaidDirect = booking.venueBooking?.amountPaidByArtist || 0;
    
    // Validation: amount cannot exceed total cost
    if (newAmount > totalCost) {
      req.flash('error', `Amount cannot exceed total venue cost of ₹${totalCost.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      return res.redirect(`/users/venues/bookings/${booking._id}/edit-payment?returnTo=${encodeURIComponent(returnTo)}`);
    }

    const editPageReturnTo = `/users/venues/bookings/${booking._id}/edit-payment?returnTo=${encodeURIComponent(returnTo || `/users/venues/${booking.venue._id}/revenue-analytics`)}`;

    res.render('venues/confirm-payment', {
      title: `${booking.title} - Confirm Payment Update`,
      bookingView: {
        id: booking._id,
        title: booking.title,
        artistName: booking.artist?.stageName || booking.artist?.user?.name || 'Unknown',
        date: booking.date,
        totalCost,
        commissionPercentage,
        commissionPaid,
        artistPaidDirect,
        artistPaidTotal: artistPaidDirect + commissionPaid
      },
      newAmount,
      venue: booking.venue,
      returnTo: returnTo || `/users/venues/${booking.venue._id}/revenue-analytics`,
      editPageReturnTo,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading confirmation page:', error);
    req.flash('error', 'Failed to load confirmation page');
    res.redirect('/users/venues');
  }
});

// POST /users/venues/bookings/:id/confirm-payment - Finalize payment update
router.post('/bookings/:id/confirm-payment', isLoggedIn, async (req, res) => {
  try {
    const { amountPaid, returnTo } = req.body;
    const amount = parseFloat(amountPaid);

    if (isNaN(amount) || amount < 0) {
      req.flash('error', 'Invalid amount provided');
      return res.redirect('/users/venues');
    }

    const booking = await Concert.findById(req.params.id)
      .populate('venue');

    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/users/venues');
    }

    if (booking.venue?.createdBy.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to edit this booking payment');
      return res.redirect('/users/venues');
    }

    const totalCost = booking.venueBooking?.totalVenueCost || 0;
    
    // Validation: amount cannot exceed total cost
    if (amount > totalCost) {
      req.flash('error', `Amount cannot exceed total venue cost of ₹${totalCost.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      return res.redirect(`/users/venues/bookings/${booking._id}/edit-payment?returnTo=${encodeURIComponent(returnTo)}`);
    }
    
    booking.venueBooking.amountPaidByArtist = Math.min(amount, totalCost);

    const commissionPct = booking.venueBooking?.adminCommission?.percentage || 0;
    const existingAdvance = booking.venueBooking?.adminCommission?.advanceAmount;
    const commissionPaid = Number.isFinite(existingAdvance) && existingAdvance > 0
      ? existingAdvance
      : (booking.venueBooking?.isPaid && commissionPct > 0
          ? (totalCost * commissionPct) / 100
          : 0);

    if (booking.venueBooking?.adminCommission) {
      booking.venueBooking.adminCommission.advanceAmount = commissionPaid;
    }

    await booking.save();

    req.flash('success', 'Payment updated successfully!');
    const finalReturnTo = returnTo || `/users/venues/${booking.venue._id}/revenue-analytics`;
    res.redirect(finalReturnTo);
  } catch (error) {
    console.error('Error updating payment:', error);
    req.flash('error', 'Failed to update payment');
    res.redirect('/users/venues');
  }
});

// PUT /users/venues/bookings/:id/update-payment - Update artist payment amount
router.put('/bookings/:id/update-payment', isLoggedIn, async (req, res) => {
  try {
    const { amountPaid } = req.body;

    if (!amountPaid || isNaN(amountPaid) || amountPaid < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount provided'
      });
    }

    const booking = await Concert.findById(req.params.id)
      .populate('venue');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify venue ownership
    if (booking.venue.createdBy.toString() !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this booking'
      });
    }

    // Update amount paid (direct to venue) and recompute pending including commission already collected
    const totalCost = booking.venueBooking?.totalVenueCost || 0;
    booking.venueBooking.amountPaidByArtist = Math.min(amountPaid, totalCost);

    const commissionPct = booking.venueBooking?.adminCommission?.percentage || 0;
    const existingAdvance = booking.venueBooking?.adminCommission?.advanceAmount;
    const commissionPaid = Number.isFinite(existingAdvance) && existingAdvance > 0
      ? existingAdvance
      : (booking.venueBooking?.isPaid && commissionPct > 0
          ? (totalCost * commissionPct) / 100
          : 0);

    // Persist derived commission so future analytics stay consistent
    if (booking.venueBooking?.adminCommission) {
      booking.venueBooking.adminCommission.advanceAmount = commissionPaid;
    }

    await booking.save();

    const pending = Math.max(totalCost - booking.venueBooking.amountPaidByArtist - commissionPaid, 0);

    res.json({
      success: true,
      message: 'Payment amount updated successfully',
      booking: {
        id: booking._id,
        amountPaid: booking.venueBooking.amountPaidByArtist,
        totalCost: booking.venueBooking.totalVenueCost,
        commissionPaid,
        pending
      }
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment amount'
    });
  }
});

module.exports = router;

