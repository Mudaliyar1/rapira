const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { isLoggedIn, isArtist, canCreateConcert } = require('../middleware/auth');
const { sendConcertSubmissionEmail } = require('../utils/emailService');
const { applySubscriptionDiscount } = require('../middleware/subscription');
const { getActiveSubscription, applyDiscount } = require('../utils/subscriptionService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/concerts');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'concert-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
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
    const { city, date, type } = req.query;

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
    // We'll show all concerts, including past ones, and mark them in the UI

    if (type === 'free') {
      filter.isPaid = false;
    } else if (type === 'paid') {
      filter.isPaid = true;
    }

    // Get concerts
    const concerts = await Concert.find(filter)
      .sort({ date: 1 })
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      });

    // Get unique cities for filter
    const cities = await Concert.distinct('city', { status: 'approved' });

    res.render('concerts/index', {
      concerts,
      cities,
      filters: { city, date, type }
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

    res.render('concerts/create-new', {
      layout: false,
      currentPath: '/concerts/create',
      title: 'Create Concert',
      artist
    });
  } catch (error) {
    console.error('Create concert page error:', error);
    req.flash('error', 'Failed to load create concert page');
    res.redirect('/artists/dashboard');
  }
});

// Create concert process
router.post('/create', isLoggedIn, canCreateConcert, upload.single('posterImage'), async (req, res) => {
  try {
    const {
      title, description, date, time, venue, city,
      isPaid, price, maxTickets
    } = req.body;

    // Validate input
    if (!title || !description || !date || !time || !venue || !city) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/concerts/create');
    }

    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Log the form data for debugging
    console.log('Creating concert with form data:', {
      title, description, date, time, venue, city,
      isPaid, price, maxTickets
    });

    // Check if this is a paid concert
    const isPaidConcert = isPaid === 'on';
    console.log('Creating concert with price:', price, 'isPaid:', isPaidConcert);

    // Create concert
    const newConcert = new Concert({
      artist: artist._id,
      title,
      description,
      date,
      time,
      venue,
      city,
      isPaid: isPaidConcert,
      price: isPaidConcert ? (price || 0) : 0,
      maxTickets: maxTickets || 0 // 0 means unlimited
    });

    // Set poster image if uploaded
    if (req.file) {
      newConcert.posterImage = '/uploads/concerts/' + req.file.filename;
    }

    await newConcert.save();

    // Send email notification
    try {
      console.log('Attempting to send concert submission email to artist:', artist.user.email);
      const emailResult = await sendConcertSubmissionEmail(artist.user, newConcert);

      if (emailResult.success) {
        console.log('Concert submission email sent successfully to:', artist.user.email);
        console.log('Email message ID:', emailResult.data?.messageId || 'Not available');
      } else {
        console.error('Failed to send concert submission email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending concert submission email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Concert submitted successfully and is pending approval');
    res.redirect('/artists/dashboard');
  } catch (error) {
    console.error('Create concert error:', error);
    req.flash('error', 'Failed to create concert');
    res.redirect('/concerts/create');
  }
});

// View concert details
router.get('/:id', async (req, res) => {
  try {
    let concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      });

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
      });

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

    res.render('concerts/edit-new', {
      layout: false,
      currentPath: '/concerts/edit',
      title: 'Edit Concert',
      artist,
      concert
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

    // Allow editing if concert is pending, rejected, or an upcoming approved concert
    if (concert.status !== 'pending' && concert.status !== 'rejected' &&
        !(concert.status === 'approved' && new Date(concert.date) >= new Date())) {
      req.flash('error', 'You can only edit pending, rejected, or upcoming approved concerts');
      return res.redirect('/artists/dashboard');
    }

    const {
      title, description, date, time, venue, city,
      isPaid, price, maxTickets
    } = req.body;

    // Log the form data for debugging
    console.log('Updating concert with form data:', {
      title, description, date, time, venue, city,
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
    concert.venue = venue;
    concert.city = city;
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
        const oldImagePath = path.join(__dirname, '../public', concert.posterImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Set new poster image
      concert.posterImage = '/uploads/concerts/' + req.file.filename;
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

module.exports = router;