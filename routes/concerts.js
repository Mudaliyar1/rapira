const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const ConcertEditRequest = require('../models/ConcertEditRequest');
const WebsiteSettings = require('../models/WebsiteSettings');
const Media = require('../models/Media');
const { isLoggedIn, isArtist, canCreateConcert } = require('../middleware/auth');
const { sendConcertSubmissionEmail } = require('../utils/emailService');
const { applySubscriptionDiscount } = require('../middleware/subscription');
const { getActiveSubscription, applyDiscount } = require('../utils/subscriptionService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import payment service
const { createOrder, verifyPayment } = require('../utils/paymentService');

// Import upload helper and media service
const { getFileUrl } = require('../utils/fileHelper');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

// Configure multer for concert image uploads (memory → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// List all concerts
router.get('/', async (req, res) => {
  try {
    // Get filter parameters
    const { city, date, type, search, sort } = req.query;

    // Build filter object
    const filter = { status: 'approved' };

    if (city) {
      filter.city = city;
    }

    // Only include upcoming concerts by default (hide past concerts)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // If no specific date is selected, only show upcoming concerts
    if (!date) {
      filter.date = { $gte: today };
    } else {
      // If a specific date is selected, use that date
      const selectedDate = new Date(date);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filter.date = {
        $gte: selectedDate,
        $lt: nextDay
      };
    }

    if (type === 'free') {
      filter.isPaid = false;
    } else if (type === 'paid') {
      filter.isPaid = true;
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { venue: searchRegex },
        { city: searchRegex },
        { description: searchRegex }
      ];
    }

    // Build sort object
    let sortObj = { date: 1 }; // Default sort by date ascending

    if (sort) {
      switch (sort) {
        case 'title':
          sortObj = { title: 1 };
          break;
        case 'city':
          sortObj = { city: 1 };
          break;
        case 'price':
          sortObj = { price: 1 };
          break;
        case 'date':
        default:
          sortObj = { date: 1 };
          break;
      }
    }

    // Get concerts
    const concerts = await Concert.find(filter)
      .sort(sortObj)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      })
      .populate('venue');

    // Get unique cities for filter
    const cities = await Concert.distinct('city', { status: 'approved' });

    // Calculate statistics
    const totalConcerts = await Concert.countDocuments({ status: 'approved' });
    const upcomingConcerts = await Concert.countDocuments({
      status: 'approved',
      date: { $gte: today }
    });
    const freeConcerts = await Concert.countDocuments({
      status: 'approved',
      isPaid: false
    });
    const paidConcerts = await Concert.countDocuments({
      status: 'approved',
      isPaid: true
    });

    const stats = {
      total: totalConcerts,
      upcoming: upcomingConcerts,
      free: freeConcerts,
      paid: paidConcerts,
      filtered: concerts.length
    };

    res.render('concerts/index', {
      concerts,
      cities,
      filters: { city, date, type, search, sort: sort || 'date' },
      stats
    });
  } catch (error) {
    console.error('Concerts list error:', error);
    req.flash('error', 'Failed to load concerts');
    res.redirect('/');
  }
});

// Create concert page
router.get('/create', isLoggedIn, canCreateConcert, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get active venues for the dropdown
    const Venue = require('../models/Venue');
    const venues = await Venue.getActiveVenues();

    // Get current admin commission setting
    const settings = await WebsiteSettings.getSettings();
    const currentCommissionPercentage = settings.venueSettings?.defaultCommissionPercentage || 10;

    res.render('concerts/create-new', {
      layout: false,
      currentPath: '/concerts/create',
      title: 'Create Concert',
      artist,
      venues,
      currentCommissionPercentage
    });
  } catch (error) {
    console.error('Create concert page error:', error);
    req.flash('error', 'Failed to load create concert page');
    res.redirect('/artists/dashboard');
  }
});

// Create payment order for venue booking
router.post('/create-payment-order', isLoggedIn, canCreateConcert, (req, res, next) => {
  // Use .any() to accept all text fields (no file uploads on this route)
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    }
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ success: false, error: 'An error occurred processing the form' });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('Payment order request received');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body:', req.body);

    const {
      title, description, date, time, venue, city,
      isPaid, price, maxTickets, bookingHours, ticketPrice
    } = req.body;

    // Handle both 'price' and 'ticketPrice' field names for flexibility
    const finalTicketPrice = ticketPrice || price;

    // More detailed validation logging
    console.log('Extracted fields:', {
      title: title || 'MISSING',
      description: description || 'MISSING', 
      date: date || 'MISSING',
      time: time || 'MISSING',
      venue: venue || 'MISSING',
      city: city || 'auto-filled',
      price: price || 'MISSING',
      ticketPrice: ticketPrice || 'not provided',
      finalTicketPrice: finalTicketPrice || 'MISSING',
      bookingHours: bookingHours || 'default-1'
    });

    // Validate input - city and ticketPrice are optional as they can be auto-filled
    if (!title || !description || !date || !time || !venue) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ success: false, error: 'Please fill in all required fields' });
    }

    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      return res.status(400).json({ success: false, error: 'Artist profile not found' });
    }

    // Validate and get venue information
    const Venue = require('../models/Venue');
    const selectedVenue = await Venue.findById(venue);

    if (!selectedVenue || !selectedVenue.isActive) {
      console.log('Venue validation failed:', {
        venueFound: !!selectedVenue,
        venueActive: selectedVenue?.isActive
      });
      return res.status(400).json({ success: false, error: 'Selected venue is not available' });
    }

    console.log('Venue found:', {
      name: selectedVenue.name,
      city: selectedVenue.city,
      isActive: selectedVenue.isActive
    });

    // ENHANCED VENUE BOOKING CONFLICT CHECK WITH 12-HOUR GAPS
    const bookingDate = new Date(date);
    const [startHours, startMinutes] = time.split(':').map(Number);
    const durationHours = parseInt(bookingHours) || 1;

    // Enhanced booking search: Check current date and surrounding dates for cross-day conflicts
    const currentDate = new Date(bookingDate);
    const previousDate = new Date(currentDate);
    previousDate.setDate(currentDate.getDate() - 1);
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);

    // Find existing bookings for this venue on current date, previous date, and next date
    const existingBookings = await Concert.find({
      venue: venue,
      date: {
        $gte: new Date(previousDate.setHours(0, 0, 0, 0)),
        $lte: new Date(nextDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['pending', 'approved'] } // Only check non-cancelled bookings
    });

    // Enhanced conflict checking with new rules
    const conflicts = [];
    const MINIMUM_GAP_HOURS = 12; // 12-hour minimum gap requirement

    // Function to get actual concert end time (including cross-day scenarios)
    const getConcertEndTime = (startDate, startTime, duration) => {
      const concertStart = new Date(startDate);
      const [hours, minutes] = startTime.split(':').map(Number);
      concertStart.setHours(hours, minutes, 0, 0);
      
      const concertEnd = new Date(concertStart);
      concertEnd.setTime(concertEnd.getTime() + (duration * 60 * 60 * 1000));
      
      return concertEnd;
    };

    // Function to get concert start time
    const getConcertStartTime = (startDate, startTime) => {
      const concertStart = new Date(startDate);
      const [hours, minutes] = startTime.split(':').map(Number);
      concertStart.setHours(hours, minutes, 0, 0);
      
      return concertStart;
    };

    // Get requested concert times
    const requestedStartTime = getConcertStartTime(bookingDate, time);
    const requestedEndTime = getConcertEndTime(bookingDate, time, durationHours);

    existingBookings.forEach(booking => {
      if (booking.time && booking.venueBooking && booking.venueBooking.bookingHours) {
        const existingBookingDate = new Date(booking.date);
        const existingDuration = booking.venueBooking.bookingHours;
        
        const existingStartTime = getConcertStartTime(existingBookingDate, booking.time);
        const existingEndTime = getConcertEndTime(existingBookingDate, booking.time, existingDuration);

        // Rule 1: Check for direct time overlap
        if (requestedStartTime < existingEndTime && requestedEndTime > existingStartTime) {
          conflicts.push({
            title: booking.title,
            time: booking.time,
            duration: existingDuration,
            status: booking.status,
            reason: 'Time slots overlap directly'
          });
        }

        // Rule 2: Check for 12-hour minimum gap requirement
        const timeBetweenConcerts1 = Math.abs(requestedStartTime - existingEndTime) / (1000 * 60 * 60); // Gap from existing end to requested start
        const timeBetweenConcerts2 = Math.abs(existingStartTime - requestedEndTime) / (1000 * 60 * 60); // Gap from requested end to existing start

        if (timeBetweenConcerts1 < MINIMUM_GAP_HOURS && timeBetweenConcerts1 >= 0) {
          conflicts.push({
            title: booking.title,
            time: booking.time,
            duration: existingDuration,
            status: booking.status,
            reason: `Minimum ${MINIMUM_GAP_HOURS}-hour gap required. Your concert starts only ${timeBetweenConcerts1.toFixed(1)} hours after previous concert ends`
          });
        }

        if (timeBetweenConcerts2 < MINIMUM_GAP_HOURS && timeBetweenConcerts2 >= 0) {
          conflicts.push({
            title: booking.title,
            time: booking.time,
            duration: existingDuration,
            status: booking.status,
            reason: `Minimum ${MINIMUM_GAP_HOURS}-hour gap required. Next concert starts only ${timeBetweenConcerts2.toFixed(1)} hours after your concert ends`
          });
        }
      }
    });

    // If there are conflicts, reject the booking
    if (conflicts.length > 0) {
      const conflictDetails = conflicts.map(c => `${c.title} (${c.time} for ${c.duration}h - ${c.status})`).join(', ');
      console.log('Venue booking conflict detected:', conflictDetails);
      return res.status(400).json({ 
        success: false, 
        error: 'Venue booking conflict detected',
        message: `This time slot conflicts with existing bookings: ${conflictDetails}`,
        conflicts: conflicts
      });
    }

    console.log('No venue conflicts detected, proceeding with booking...');

    // Use venue city if not provided in form
    const finalCity = city || selectedVenue.city;

    // Calculate venue booking cost using hourly rate from form (this is the FIXED price for the selected duration)
    const hours = parseInt(bookingHours) || 1;
    const hourlyRate = parseFloat(req.body.hourlyRate) || 0; // This is the FIXED price for selected hours, not per-hour
    const totalVenueCost = hourlyRate; // Use the rate directly - it's already the full price

    // Calculate commission (artist pays this based on venue cost and commission percentage)
    // First get website settings to determine commission logic
    const websiteSettings = await WebsiteSettings.getSettings();
    const useUserCommission = websiteSettings.venueSettings?.allowUserCommissionEdit || false;
    const defaultAdminCommission = parseFloat(websiteSettings.venueSettings?.defaultCommissionPercentage) || 10;
    
    let validCommissionPercentage = defaultAdminCommission; // Default to admin commission
    
    // If user commission is allowed, use venue-specific commission data
    if (useUserCommission) {
      // Use venue-specific commission percentage
      const adminCommissionPercentage = parseFloat(selectedVenue.pricing?.adminCommission?.percentage) || 0;
      validCommissionPercentage = isNaN(adminCommissionPercentage) ? 0 : adminCommissionPercentage;
    } else {
      // Use admin-set default commission percentage
      validCommissionPercentage = defaultAdminCommission;
    }

    // Artist pays commission amount based on venue cost and commission percentage
    const commissionAmount = (totalVenueCost * validCommissionPercentage) / 100;
    const totalAmountToPay = commissionAmount;

    // Ensure minimum payment amount (Razorpay requires at least ₹1)
    const finalAmount = Math.max(totalAmountToPay, 1);

    console.log('Creating payment order for venue booking:', {
      venueName: selectedVenue.name,
      hours,
      totalVenueCost,
      commissionPercentage: validCommissionPercentage,
      commissionAmount,
      totalAmountToPay: finalAmount,
      artistEmail: artist.user.email
    });

    // Create Razorpay order
    const receipt = `c_${Date.now()}_${artist._id.toString().substring(0, 8)}`;
    console.log('Generated receipt (length: ' + receipt.length + '):', receipt);
    const orderResult = await createOrder({
      amount: finalAmount,
      receipt: receipt,
      currency: 'INR',
      notes: {
        artistId: artist._id.toString(),
        venueId: selectedVenue._id.toString(),
        venueName: selectedVenue.name,
        bookingHours: hours,
        totalVenueCost: totalVenueCost,
        commissionPercentage: validCommissionPercentage,
        commissionAmount: commissionAmount,
        concertTitle: title
      }
    });

    if (!orderResult.success) {
      console.error('Failed to create payment order:', orderResult.error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create payment order. Please try again.' 
      });
    }

    // Store concert data in session for completion after payment
    req.session.pendingConcert = {
      title, description, date, time, venue, 
      city: finalCity,
      isPaid, 
      price: finalTicketPrice, 
      maxTickets, 
      bookingHours, 
      ticketPrice: finalTicketPrice,
      venueBooking: {
        bookingHours: hours,
        totalVenueCost: totalVenueCost,
        adminCommission: {
          percentage: validCommissionPercentage,
          advanceAmount: commissionAmount
        },
        isPaid: false
      },
      orderId: orderResult.data.id,
      receipt: receipt
    };
    
    console.log('Stored pending concert in session:', req.session.pendingConcert);

    res.json({
      success: true,
      order: orderResult.data,
      amount: finalAmount,
      currency: 'INR',
      name: 'Rapira Music Platform',
      description: `Venue booking for "${title}" at ${selectedVenue.name}`,
      prefill: {
        name: artist.user.name,
        email: artist.user.email
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID // Send the correct key to frontend
    });

  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
});

// Wrapper to catch upload middleware errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error handler for multer
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('error', 'File size too large. Maximum size is 5MB.');
      return res.redirect('/concerts/create');
    }
    if (err.code === 'UNEXPECTED_FILE') {
      req.flash('error', 'Invalid file field. Please use the correct form.');
      return res.redirect('/concerts/create');
    }
    req.flash('error', `File upload error: ${err.message}`);
    return res.redirect('/concerts/create');
  }
  
  if (err) {
    console.error('Upload error:', err);
    req.flash('error', 'An error occurred during file upload.');
    return res.redirect('/concerts/create');
  }
  next();
};

// Verify payment and create concert
router.post('/verify-payment', isLoggedIn, canCreateConcert, (req, res, next) => {
  // Handle upload with error catching - use .any() to accept all fields
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        req.flash('error', 'File size too large. Maximum size is 5MB.');
        return res.redirect('/concerts/create');
      }
      req.flash('error', `File upload error: ${err.message}`);
      return res.redirect('/concerts/create');
    }
    if (err) {
      console.error('Upload error:', err);
      req.flash('error', 'An error occurred during file upload.');
      return res.redirect('/concerts/create');
    }
    next();
  });
}, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log('Checking for pending concert in session...');
    console.log('Session data:', req.session);
    console.log('Pending concert in session:', req.session.pendingConcert);
    
    if (!req.session.pendingConcert) {
      req.flash('error', 'No pending concert found');
      return res.redirect('/concerts/create');
    }

    // Verify payment
    const verificationResult = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!verificationResult.success) {
      req.flash('error', 'Payment verification failed');
      return res.redirect('/concerts/create');
    }

    console.log('Payment verified successfully:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id
    });

    // Get artist
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get pending concert data
    const concertData = req.session.pendingConcert;

    // ENHANCED DOUBLE-CHECK FOR VENUE BOOKING CONFLICTS BEFORE FINAL CREATION
    const bookingDate = new Date(concertData.date);
    const [startHours, startMinutes] = concertData.time.split(':').map(Number);
    const durationHours = concertData.venueBooking?.bookingHours || 1;

    // Enhanced booking search: Check current date and surrounding dates for cross-day conflicts
    const currentDate = new Date(bookingDate);
    const previousDate = new Date(currentDate);
    previousDate.setDate(currentDate.getDate() - 1);
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);

    // Find existing bookings for this venue on current date, previous date, and next date
    const existingBookings = await Concert.find({
      venue: concertData.venue,
      date: {
        $gte: new Date(previousDate.setHours(0, 0, 0, 0)),
        $lte: new Date(nextDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['pending', 'approved'] }
    });

    // Enhanced conflict checking with new rules
    let hasConflict = false;
    const MINIMUM_GAP_HOURS = 12; // 12-hour minimum gap requirement

    // Function to get actual concert end time (including cross-day scenarios)
    const getConcertEndTime = (startDate, startTime, duration) => {
      const concertStart = new Date(startDate);
      const [hours, minutes] = startTime.split(':').map(Number);
      concertStart.setHours(hours, minutes, 0, 0);
      
      const concertEnd = new Date(concertStart);
      concertEnd.setTime(concertEnd.getTime() + (duration * 60 * 60 * 1000));
      
      return concertEnd;
    };

    // Function to get concert start time
    const getConcertStartTime = (startDate, startTime) => {
      const concertStart = new Date(startDate);
      const [hours, minutes] = startTime.split(':').map(Number);
      concertStart.setHours(hours, minutes, 0, 0);
      
      return concertStart;
    };

    // Get requested concert times
    const requestedStartTime = getConcertStartTime(bookingDate, concertData.time);
    const requestedEndTime = getConcertEndTime(bookingDate, concertData.time, durationHours);

    existingBookings.forEach(booking => {
      if (booking.time && booking.venueBooking && booking.venueBooking.bookingHours) {
        const existingBookingDate = new Date(booking.date);
        const existingDuration = booking.venueBooking.bookingHours;
        
        const existingStartTime = getConcertStartTime(existingBookingDate, booking.time);
        const existingEndTime = getConcertEndTime(existingBookingDate, booking.time, existingDuration);

        // Rule 1: Check for direct time overlap
        if (requestedStartTime < existingEndTime && requestedEndTime > existingStartTime) {
          hasConflict = true;
        }

        // Rule 2: Check for 12-hour minimum gap requirement
        const timeBetweenConcerts1 = Math.abs(requestedStartTime - existingEndTime) / (1000 * 60 * 60); // Gap from existing end to requested start
        const timeBetweenConcerts2 = Math.abs(existingStartTime - requestedEndTime) / (1000 * 60 * 60); // Gap from requested end to existing start

        if ((timeBetweenConcerts1 < MINIMUM_GAP_HOURS && timeBetweenConcerts1 >= 0) || 
            (timeBetweenConcerts2 < MINIMUM_GAP_HOURS && timeBetweenConcerts2 >= 0)) {
          hasConflict = true;
        }
      }
    });

    // If there are conflicts during payment verification, show error
    if (hasConflict) {
      console.log('Venue booking conflict detected during payment verification');
      delete req.session.pendingConcert; // Clear the pending concert
      req.flash('error', 'Venue booking conflict detected. Another artist has booked this time slot. Please create a new concert with a different time.');
      return res.redirect('/concerts/create');
    }

    console.log('Final conflict check passed, creating concert...');

    // Create concert
    const newConcert = new Concert({
      artist: artist._id,
      title: concertData.title,
      description: concertData.description,
      date: concertData.date,
      time: concertData.time,
      venue: concertData.venue,
      city: concertData.city,
      isPaid: true, // All concerts are now paid
      price: parseFloat(concertData.ticketPrice || concertData.price || 0),
      maxTickets: concertData.maxTickets || 0,
      paymentId: razorpay_payment_id, // Add payment ID at root level
      orderId: razorpay_order_id, // Add order ID at root level
      venueBooking: {
        ...concertData.venueBooking,
        isPaid: true, // Mark venue booking as paid
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paidAt: new Date()
      }
    });

    // Upload poster image to Cloudinary if provided
    if (req.files && req.files['posterImage'] && req.files['posterImage'][0]) {
      try {
        const posterFile = req.files['posterImage'][0];
        const { media } = await uploadFileToCloudinary(posterFile, {
          module: 'concertPoster',
          ownerType: 'artist',
          ownerId: artist._id,
          folder: 'rapira/concerts/posters'
        });
        newConcert.posterImage = media.secure_url;
        newConcert.posterMedia = media._id;
      } catch (err) {
        console.error('Poster image upload error:', err);
        req.flash('warning', 'Concert created, but poster image upload failed.');
      }
    }

    console.log('Saving new concert:', newConcert);
    await newConcert.save();
    console.log('Concert saved successfully with ID:', newConcert._id);

    // Clear pending concert from session
    delete req.session.pendingConcert;

    // Send email notification
    try {
      const emailResult = await sendConcertSubmissionEmail(artist.user, newConcert);
      if (emailResult.success) {
        console.log('Concert submission email sent successfully');
      }
    } catch (emailError) {
      console.error('Error sending concert submission email:', emailError);
    }

    req.flash('success', 'Payment successful! Your concert has been submitted for approval.');
    
    // For AJAX requests, send JSON response instead of redirect
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ 
        success: true, 
        message: 'Payment successful! Your concert has been submitted for approval.',
        redirectUrl: '/artists/manage-concerts'
      });
    }
    
    // For regular form submissions, use redirect
    res.redirect('/artists/manage-concerts');

  } catch (error) {
    console.error('Error verifying payment:', error);
    req.flash('error', 'Failed to process payment verification');
    res.redirect('/concerts/create');
  }
});
// Create concert process (now redirects to payment)
router.post('/create', isLoggedIn, canCreateConcert, async (req, res) => {
  try {
    // This route now just validates and redirects to payment
    // The actual concert creation happens in /verify-payment after successful payment
    
    const {
      title, description, date, time, venue, city,
      isPaid, price, maxTickets, bookingHours, ticketPrice
    } = req.body;

    // Basic validation
    if (!title || !description || !date || !time || !venue) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/concerts/create');
    }

    // Validate venue and calculate cost
    const Venue = require('../models/Venue');
    const selectedVenue = await Venue.findById(venue);

    if (!selectedVenue || !selectedVenue.isActive) {
      req.flash('error', 'Selected venue is not available');
      return res.redirect('/concerts/create');
    }

    // Calculate total cost and redirect to payment
    req.flash('info', 'Please complete the venue booking payment to submit your concert');
    res.redirect('/concerts/create#payment');

  } catch (error) {
    console.error('Create concert redirect error:', error);
    req.flash('error', 'Failed to process concert submission');
    res.redirect('/concerts/create');
  }
});

// Artist route to view their edit requests (MUST be before /:id route)
router.get('/edit-requests', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/artists/dashboard');
    }

    const editRequests = await ConcertEditRequest.find({ artist: artist._id })
      .populate('concert')
      .populate('artist')
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ requestedAt: -1 });

    res.render('artist/edit-requests', { 
      layout: false,
      title: 'My Edit Requests', 
      editRequests,
      artist,
      user: req.session.user,
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error fetching edit requests:', error);
    req.flash('error', 'Failed to load edit requests');
    res.redirect('/artists/dashboard');
  }
});

// API route to get edit request details (MUST be before /:id route)
router.get('/edit-request/:requestId/details', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { requestId } = req.params;
    const artist = await Artist.findOne({ user: req.session.user.id });
    
    if (!artist) {
      return res.json({ success: false, message: 'Artist profile not found' });
    }

    const editRequest = await ConcertEditRequest.findOne({ 
      _id: requestId, 
      artist: artist._id 
    })
    .populate('concert')
    .populate({
      path: 'concert',
      populate: { path: 'venue' }
    })
    .populate('artist')
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name email' }
    });

    if (!editRequest) {
      return res.json({ success: false, message: 'Edit request not found' });
    }

    // Get requested venue info if venue was changed
    let requestedVenue = null;
    if (editRequest.requestedChanges.venue) {
      const Venue = require('../models/Venue');
      requestedVenue = await Venue.findById(editRequest.requestedChanges.venue);
    }

    res.json({ 
      success: true, 
      request: editRequest,
      requestedVenue 
    });
  } catch (error) {
    console.error('Error fetching edit request details:', error);
    res.json({ success: false, message: 'Failed to load edit request details' });
  }
});

// View concert details
router.get('/:id', async (req, res) => {
  try {
    // Validate ObjectId
    if (!req.params.id || req.params.id === 'null' || req.params.id === 'undefined' || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid concert ID');
      return res.redirect('/concerts');
    }
    
    let concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      })
      .populate('venue');

    // If artist or user is null, handle it gracefully
    if (concert && (!concert.artist || !concert.artist.user)) {
      console.log('Warning: Concert found but artist or artist.user is null:', concert._id);
    }

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/concerts');
    }

    // Check if concert is approved
    if (concert.status !== 'approved' &&
        (!req.session.user ||
         (req.session.user.role !== 'admin' &&
          (!concert.artist || !concert.artist.user || concert.artist.user._id.toString() !== req.session.user.id)))) {
      req.flash('error', 'This concert is not available');
      return res.redirect('/concerts');
    }

    // Check if user has already booked tickets (only completed payments)
    let userTickets = [];
    if (req.session.user) {
      userTickets = await Ticket.find({
        concert: concert._id,
        user: req.session.user.id,
        paymentStatus: 'completed' // Only show completed tickets
      });
    }

    // Calculate tickets remaining
    const ticketsRemaining = concert.maxTickets > 0
      ? concert.maxTickets - concert.ticketsSold
      : 'Unlimited';

    res.render('concerts/show', {
      concert,
      userTickets,
      ticketsRemaining
    });
  } catch (error) {
    console.error('Concert details error:', error);
    req.flash('error', 'Failed to load concert details');
    res.redirect('/concerts');
  }
});

// Select quantity page
router.get('/:id/select-quantity', isLoggedIn, async (req, res) => {
  try {
    let concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      })
      .populate('venue');

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/concerts');
    }

    // Check if concert is approved
    if (concert.status !== 'approved') {
      req.flash('error', 'This concert is not available for booking');
      return res.redirect('/concerts');
    }

    // Check if concert date has passed
    const concertDate = new Date(concert.date);
    const today = new Date();
    if (concertDate < today) {
      req.flash('error', 'This concert has already taken place');
      return res.redirect(`/concerts/${concert._id}`);
    }

    // Check if tickets are available
    if (concert.maxTickets > 0 && concert.ticketsSold >= concert.maxTickets) {
      req.flash('error', 'Sorry, this concert is sold out');
      return res.redirect(`/concerts/${concert._id}`);
    }

    // Calculate tickets remaining
    const ticketsRemaining = concert.maxTickets > 0
      ? concert.maxTickets - concert.ticketsSold
      : 'Unlimited';

    const maxTicketsPerBooking = concert.maxTickets > 0
      ? Math.min(10, concert.maxTickets - concert.ticketsSold)
      : 10;

    res.render('concerts/select-quantity', {
      concert,
      ticketsRemaining,
      maxTicketsPerBooking
    });
  } catch (error) {
    console.error('Select quantity error:', error);
    req.flash('error', 'Failed to load quantity selection page');
    res.redirect('/concerts');
  }
});

// Book concert page
router.get('/:id/book', isLoggedIn, async (req, res) => {
  try {
    let concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      })
      .populate('venue');

    // If artist or user is null, handle it gracefully
    if (concert && (!concert.artist || !concert.artist.user)) {
      console.log('Warning: Concert found but artist or artist.user is null in booking page:', concert._id);
    }

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/concerts');
    }

    // Check if concert is approved
    if (concert.status !== 'approved') {
      req.flash('error', 'This concert is not available for booking');
      return res.redirect('/concerts');
    }

    // Check if concert date has passed
    const concertDate = new Date(concert.date);
    const today = new Date();
    if (concertDate < today) {
      req.flash('error', 'This concert has already taken place');
      return res.redirect(`/concerts/${concert._id}`);
    }

    // Check if tickets are available
    if (concert.maxTickets > 0 && concert.ticketsSold >= concert.maxTickets) {
      req.flash('error', 'Sorry, this concert is sold out');
      return res.redirect(`/concerts/${concert._id}`);
    }

    // Calculate tickets remaining
    const ticketsRemaining = concert.maxTickets > 0
      ? concert.maxTickets - concert.ticketsSold
      : 'Unlimited';

    // Check if user has an active subscription and apply discount if applicable
    let originalPrice = concert.price;
    let discountedPrice = originalPrice;
    let subscriptionDiscount = 0;

    if (concert.isPaid && res.locals.hasActiveSubscription && res.locals.activeSubscription) {
      // Apply subscription discount
      const subscription = res.locals.activeSubscription;
      if (subscription.plan && subscription.plan.discountPercentage > 0) {
        subscriptionDiscount = subscription.plan.discountPercentage;
        discountedPrice = applyDiscount(originalPrice, subscription);
        console.log(`Applied subscription discount: ${subscriptionDiscount}% - Original: ${originalPrice}, Discounted: ${discountedPrice}`);
      }
    }

    // Get website settings for ticket commission
    const WebsiteSettings = require('../models/WebsiteSettings');
    const settings = await WebsiteSettings.getSettings();
    const ticketCommissionEnabled = settings.ticketCommissionSettings?.enabled || false;
    const ticketCommissionPercentage = settings.ticketCommissionSettings?.percentage || 0;

    // Get selected quantity from query parameter (default to 1)
    const selectedQuantity = parseInt(req.query.quantity) || 1;
    
    // Validate quantity
    const maxAllowedTickets = concert.maxTickets > 0
      ? Math.min(10, concert.maxTickets - concert.ticketsSold)
      : 10;
    
    if (selectedQuantity < 1 || selectedQuantity > maxAllowedTickets) {
      req.flash('error', 'Invalid ticket quantity selected');
      return res.redirect(`/concerts/${concert._id}`);
    }

    // Add Razorpay script to the head section if it's a paid concert
    const extraScripts = concert.isPaid ?
      '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>' : '';

    res.render('concerts/book', {
      concert,
      ticketsRemaining,
      selectedQuantity,
      maxTicketsPerBooking: maxAllowedTickets,
      extraScripts: extraScripts,
      originalPrice,
      discountedPrice,
      subscriptionDiscount,
      ticketCommissionEnabled,
      ticketCommissionPercentage
    });
  } catch (error) {
    console.error('Book concert error:', error);
    req.flash('error', 'Failed to load booking page');
    res.redirect('/concerts');
  }
});

// Edit concert page
router.get('/:id/edit', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const concert = await Concert.findOne({
      _id: req.params.id,
      artist: artist._id
    });

    if (!concert) {
      req.flash('error', 'Concert not found or you do not have permission to edit it');
      return res.redirect('/artists/dashboard');
    }

    // Allow editing if concert is pending, rejected, or an upcoming approved concert
    if (concert.status !== 'pending' && concert.status !== 'rejected' &&
        !(concert.status === 'approved' && new Date(concert.date) >= new Date())) {
      req.flash('error', 'You can only edit pending, rejected, or upcoming approved concerts');
      return res.redirect('/artists/dashboard');
    }

    // Get active venues for the dropdown
    const Venue = require('../models/Venue');
    const venues = await Venue.getActiveVenues();

    // Populate concert with venue data
    const populatedConcert = await Concert.findById(concert._id).populate('venue');

    res.render('concerts/edit-new', {
      layout: false,
      currentPath: '/concerts/edit',
      title: 'Edit Concert',
      artist,
      concert: populatedConcert,
      venues
    });
  } catch (error) {
    console.error('Edit concert error:', error);
    req.flash('error', 'Failed to load edit page');
    res.redirect('/artists/dashboard');
  }
});

// Update concert
router.post('/:id/edit', isLoggedIn, isArtist, (req, res, next) => {
  // Use .any() to accept all fields including optional posterImage file
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      req.flash('error', `Upload error: ${err.message}`);
      return res.redirect(`/concerts/${req.params.id}/edit`);
    }
    if (err) {
      console.error('Upload error:', err);
      req.flash('error', 'An error occurred processing the form');
      return res.redirect(`/concerts/${req.params.id}/edit`);
    }
    next();
  });
}, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const concert = await Concert.findOne({
      _id: req.params.id,
      artist: artist._id
    });

    if (!concert) {
      req.flash('error', 'Concert not found or you do not have permission to edit it');
      return res.redirect('/artists/dashboard');
    }

    // Prevent editing of approved concerts - they need to use edit request system
    if (concert.status === 'approved') {
      req.flash('error', 'Approved concerts cannot be edited directly. Please use the edit request system.');
      return res.redirect(`/concerts/${req.params.id}/edit`);
    }

    // Allow editing only for pending and rejected concerts
    if (concert.status !== 'pending' && concert.status !== 'rejected') {
      req.flash('error', 'You can only edit pending or rejected concerts');
      return res.redirect('/artists/dashboard');
    }

    const {
      title, description, date, time, venue, city,
      isPaid, price, maxTickets
    } = req.body;

    // Validate and get venue information
    const Venue = require('../models/Venue');
    const selectedVenue = await Venue.findById(venue);

    if (!selectedVenue) {
      req.flash('error', 'Selected venue not found');
      return res.redirect(`/concerts/${req.params.id}/edit`);
    }

    if (!selectedVenue.isActive) {
      req.flash('error', 'Selected venue is not available');
      return res.redirect(`/concerts/${req.params.id}/edit`);
    }

    // Log the form data for debugging
    console.log('Updating concert with form data:', {
      title, description, date, time, venue: selectedVenue.name, city: selectedVenue.city,
      isPaid, price, maxTickets
    });

    // Check if this is a paid concert
    const isPaidConcert = isPaid === 'on';
    console.log('Updating concert with price:', price, 'isPaid:', isPaidConcert);

    // Update concert fields
    concert.title = title;
    concert.description = description;
    concert.date = date;
    concert.time = time;
    concert.venue = selectedVenue._id;
    concert.city = selectedVenue.city; // Use venue's city
    concert.isPaid = isPaidConcert;
    concert.price = isPaidConcert ? (price || 0) : 0;
    concert.maxTickets = maxTickets || 0;

    // If concert was rejected, set it back to pending
    if (concert.status === 'rejected') {
      concert.status = 'pending';
    }

    // Update poster image if uploaded to Cloudinary
    if (req.files && req.files.length > 0) {
      const posterFile = req.files.find(f => f.fieldname === 'posterImage');
      if (posterFile) {
        try {
          // Delete old poster from Cloudinary if exists
          if (concert.posterMedia) {
            const oldMedia = await Media.findById(concert.posterMedia);
            if (oldMedia) await deleteMedia(oldMedia);
          }

          // Upload new poster to Cloudinary
          const { media } = await uploadFileToCloudinary(posterFile, {
            module: 'concertPoster',
            ownerType: 'artist',
            ownerId: concert.artist,
            folder: 'rapira/concerts/posters'
          });
          concert.posterImage = media.secure_url;
          concert.posterMedia = media._id;
          console.log(`Updated concert poster image to: ${media.secure_url}`);
        } catch (err) {
          console.error('Error uploading poster:', err);
          req.flash('warning', 'Failed to upload poster image');
        }
      }
    }

    await concert.save();

    // Different success message based on concert status
    if (concert.status === 'approved') {
      req.flash('success', 'Concert updated successfully');
    } else {
      req.flash('success', 'Concert updated successfully and is pending approval');
    }

    res.redirect('/artists/manage-concerts');
  } catch (error) {
    console.error('Update concert error:', error);
    req.flash('error', 'Failed to update concert');
    res.redirect(`/concerts/${req.params.id}/edit`);
  }
});

// Cancel concert
router.post('/:id/cancel', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const concert = await Concert.findOne({
      _id: req.params.id,
      artist: artist._id
    });

    if (!concert) {
      req.flash('error', 'Concert not found or you do not have permission to cancel it');
      return res.redirect('/artists/dashboard');
    }

    // Only allow cancellation if concert is approved and hasn't happened yet
    if (concert.status !== 'approved' || new Date(concert.date) < new Date()) {
      req.flash('error', 'You cannot cancel this concert');
      return res.redirect('/artists/dashboard');
    }

    // Update concert status
    concert.status = 'cancelled';
    await concert.save();

    // TODO: Send cancellation emails to ticket holders

    req.flash('success', 'Concert cancelled successfully');
    res.redirect('/artists/manage-concerts');
  } catch (error) {
    console.error('Cancel concert error:', error);
    req.flash('error', 'Failed to cancel concert');
    res.redirect('/artists/manage-concerts');
  }
});

// Concert Edit Request Routes for Approved Concerts

// Submit edit request for approved concert
router.post('/:id/request-edit', isLoggedIn, isArtist, (req, res, next) => {
  // Use .any() to accept all fields including optional posterImage file
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      req.flash('error', `Upload error: ${err.message}`);
      return res.redirect(`/concerts/${req.params.id}`);
    }
    if (err) {
      console.error('Upload error:', err);
      req.flash('error', 'An error occurred processing the form');
      return res.redirect(`/concerts/${req.params.id}`);
    }
    next();
  });
}, async (req, res) => {
  try {
    const concertId = req.params.id;
    const { title, description, date, time, venue, city, price, maxTickets, reason } = req.body;

    // Find the artist first
    const artist = await Artist.findOne({ user: req.session.user.id });
    
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/artists/dashboard');
    }

    // Find the concert
    const concert = await Concert.findById(concertId).populate('venue');
    
    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/artists/dashboard');
    }

    // Check if user is the artist who created this concert
    if (concert.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You are not authorized to edit this concert');
      return res.redirect('/artists/dashboard');
    }

    // Only allow edit requests for approved concerts
    if (concert.status !== 'approved') {
      req.flash('error', 'Edit requests can only be made for approved concerts');
      return res.redirect(`/concerts/${concertId}/edit`);
    }

    // Check for existing pending edit request
    const existingRequest = await ConcertEditRequest.findOne({
      concert: concertId,
      status: 'pending'
    });

    if (existingRequest) {
      req.flash('error', 'You already have a pending edit request for this concert');
      return res.redirect('/artists/dashboard');
    }

    // Prepare requested changes object (only include changed fields)
    const requestedChanges = {};
    
    if (title && title !== concert.title) requestedChanges.title = title;
    if (description && description !== concert.description) requestedChanges.description = description;
    if (date && date !== concert.date.toISOString().split('T')[0]) requestedChanges.date = new Date(date);
    if (time && time !== concert.time) requestedChanges.time = time;
    if (venue && venue !== concert.venue._id.toString()) {
      requestedChanges.venue = venue;
      // Update city if venue changed
      const Venue = require('../models/Venue');
      const newVenue = await Venue.findById(venue);
      if (newVenue) {
        requestedChanges.city = newVenue.city;
      }
    }
    if (price && parseFloat(price) !== parseFloat(concert.price)) requestedChanges.price = parseFloat(price);
    if (maxTickets && parseInt(maxTickets) !== parseInt(concert.maxTickets)) requestedChanges.maxTickets = parseInt(maxTickets);

    // Handle poster image upload to Cloudinary
    if (req.files && req.files.length > 0) {
      const posterFile = req.files.find(f => f.fieldname === 'posterImage');
      if (posterFile) {
        try {
          const { media: posterMedia } = await uploadFileToCloudinary(posterFile, {
            module: 'concertPoster',
            ownerType: 'artist',
            ownerId: concert.artist,
            folder: 'rapira/concerts/posters'
          });
          requestedChanges.posterImage = posterMedia.secure_url;
          requestedChanges.posterMedia = posterMedia._id;
        } catch (err) {
          console.error('Error uploading poster:', err);
          req.flash('warning', 'Failed to upload poster image');
        }
      }
    }

    // Check if any changes were actually made
    let hasPosterFile = req.files && req.files.length > 0 && req.files.find(f => f.fieldname === 'posterImage');
    if (Object.keys(requestedChanges).length === 0 && !hasPosterFile) {
      req.flash('error', 'No changes detected. Please modify at least one field to submit an edit request.');
      return res.redirect(`/concerts/${concertId}/edit`);
    }

    // Create edit request
    const editRequest = new ConcertEditRequest({
      concert: concertId,
      artist: artist._id,
      requestedChanges,
      reason
    });

    await editRequest.save();

    req.flash('success', 'Edit request submitted successfully. An admin will review your changes.');
    res.redirect('/artists/dashboard');

  } catch (error) {
    console.error('Error submitting concert edit request:', error);
    req.flash('error', 'Failed to submit edit request');
    res.redirect('/artists/dashboard');
  }
});

module.exports = router;