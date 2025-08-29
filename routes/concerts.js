const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const ConcertEditRequest = require('../models/ConcertEditRequest');
const { isLoggedIn, isArtist, canCreateConcert } = require('../middleware/auth');
const { sendConcertSubmissionEmail } = require('../utils/emailService');
const { applySubscriptionDiscount } = require('../middleware/subscription');
const { getActiveSubscription, applyDiscount } = require('../utils/subscriptionService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import payment service
const { createOrder, verifyPayment } = require('../utils/paymentService');

// Import upload helper
const { createUpload, getStoragePath, deleteFileIfExists } = require('../utils/uploadHelper');

// Configure multer for concert image uploads
const upload = createUpload({
  uploadType: 'concerts',
  fileSize: 5 * 1024 * 1024, // 5MB limit
  filenameGenerator: (file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    return 'concert-' + uniqueSuffix + ext;
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

    if (date) {
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
    const now = new Date();
    const totalConcerts = await Concert.countDocuments({ status: 'approved' });
    const upcomingConcerts = await Concert.countDocuments({
      status: 'approved',
      date: { $gte: now }
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

    res.render('concerts/create-new', {
      layout: false,
      currentPath: '/concerts/create',
      title: 'Create Concert',
      artist,
      venues
    });
  } catch (error) {
    console.error('Create concert page error:', error);
    req.flash('error', 'Failed to load create concert page');
    res.redirect('/artists/dashboard');
  }
});

// Create payment order for venue booking
router.post('/create-payment-order', isLoggedIn, canCreateConcert, upload.fields([]), async (req, res) => {
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

    // Use venue city if not provided in form
    const finalCity = city || selectedVenue.city;

    // Calculate venue booking cost
    const hours = parseInt(bookingHours) || 1;
    let totalVenueCost = 0;

    if (selectedVenue.pricing?.hourlyRates && Array.isArray(selectedVenue.pricing.hourlyRates)) {
      if (selectedVenue.pricing.hourlyRates.length > 0 && 
          typeof selectedVenue.pricing.hourlyRates[0] === 'object' && 
          selectedVenue.pricing.hourlyRates[0].hasOwnProperty('hours') &&
          selectedVenue.pricing.hourlyRates[0].hasOwnProperty('rate')) {
        
        for (let i = 0; i < hours; i++) {
          const rateEntry = selectedVenue.pricing.hourlyRates.find(r => r.hours === (i + 1));
          if (rateEntry && rateEntry.rate) {
            totalVenueCost += parseFloat(rateEntry.rate) || 0;
          } else if (selectedVenue.pricing.hourlyRates.length > 0) {
            const lastEntry = selectedVenue.pricing.hourlyRates[selectedVenue.pricing.hourlyRates.length - 1];
            totalVenueCost += parseFloat(lastEntry.rate) || 0;
          }
        }
      } else {
        for (let i = 0; i < hours && i < selectedVenue.pricing.hourlyRates.length; i++) {
          totalVenueCost += parseFloat(selectedVenue.pricing.hourlyRates[i]) || 0;
        }
        
        if (hours > selectedVenue.pricing.hourlyRates.length && selectedVenue.pricing.hourlyRates.length > 0) {
          const lastRate = parseFloat(selectedVenue.pricing.hourlyRates[selectedVenue.pricing.hourlyRates.length - 1]) || 0;
          totalVenueCost += lastRate * (hours - selectedVenue.pricing.hourlyRates.length);
        }
      }
    } else if (selectedVenue.pricing?.hourlyRate) {
      const hourlyRate = parseFloat(selectedVenue.pricing.hourlyRate) || 0;
      totalVenueCost = hourlyRate * hours;
    }

    if (isNaN(totalVenueCost) || totalVenueCost < 0) {
      totalVenueCost = 0;
    }

    // Calculate admin commission (for admin records only - not charged to artist)
    const adminCommissionPercentage = parseFloat(selectedVenue.pricing?.adminCommission?.percentage) || 0;
    const adminAdvanceAmount = parseFloat(selectedVenue.pricing?.adminCommission?.advanceAmount) || 0;
    const validCommissionPercentage = isNaN(adminCommissionPercentage) ? 0 : adminCommissionPercentage;
    const validAdvanceAmount = isNaN(adminAdvanceAmount) ? 0 : adminAdvanceAmount;

    // Artist only pays the advance amount set by admin
    // Commission is for admin records only, venue cost is covered by advance
    const commissionAmount = (totalVenueCost * validCommissionPercentage) / 100; // For records only
    const totalAmountToPay = validAdvanceAmount; // Artist only pays advance amount

    // Ensure minimum payment amount (Razorpay requires at least ₹1)
    const finalAmount = Math.max(totalAmountToPay, 1);

    console.log('Creating payment order for venue booking:', {
      venueName: selectedVenue.name,
      hours,
      totalVenueCost,
      commissionAmount,
      advanceAmount: validAdvanceAmount,
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
        commissionAmount: commissionAmount,
        advanceAmount: validAdvanceAmount,
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
          advanceAmount: validAdvanceAmount
        },
        isPaid: false
      },
      orderId: orderResult.data.id,
      receipt: receipt
    };

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

// Verify payment and create concert
router.post('/verify-payment', isLoggedIn, canCreateConcert, upload.single('posterImage'), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

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
      venueBooking: {
        ...concertData.venueBooking,
        isPaid: true, // Mark venue booking as paid
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paidAt: new Date()
      }
    });

    // Set poster image if uploaded
    if (req.file) {
      newConcert.posterImage = getStoragePath('concerts', req.file.filename);
    }

    await newConcert.save();

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
    res.redirect('/artists/dashboard');

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

    // Check if user has already booked tickets
    let userTickets = [];
    if (req.session.user) {
      userTickets = await Ticket.find({
        concert: concert._id,
        user: req.session.user.id
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

    // Add Razorpay script to the head section if it's a paid concert
    const extraScripts = concert.isPaid ?
      '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>' : '';

    res.render('concerts/book', {
      concert,
      ticketsRemaining,
      maxTicketsPerBooking: concert.maxTickets > 0
        ? Math.min(10, concert.maxTickets - concert.ticketsSold)
        : 10, // Allow up to 10 tickets per booking if unlimited
      extraScripts: extraScripts,
      originalPrice,
      discountedPrice,
      subscriptionDiscount
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
router.post('/:id/edit', isLoggedIn, isArtist, upload.single('posterImage'), async (req, res) => {
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

    // Update poster image if uploaded
    if (req.file) {
      // Delete old poster image if it's not the default
      if (concert.posterImage && concert.posterImage !== '/images/default-concert.jpg') {
        deleteFileIfExists(concert.posterImage);
      }

      // Set new poster image using our helper
      concert.posterImage = getStoragePath('concerts', req.file.filename);
      console.log(`Updated concert poster image to: ${concert.posterImage}`);
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
router.post('/:id/request-edit', isLoggedIn, isArtist, upload.single('posterImage'), async (req, res) => {
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

    // Handle poster image upload
    if (req.file) {
      requestedChanges.posterImage = '/uploads/concerts/' + req.file.filename;
    }

    // Check if any changes were actually made
    if (Object.keys(requestedChanges).length === 0 && !req.file) {
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