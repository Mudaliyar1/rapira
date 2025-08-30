const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Venue = require('../models/Venue');
const Artist = require('../models/Artist');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Middleware to ensure only admin can access
router.use(isLoggedIn, isAdmin);

// GET: Venue Bookings Management Page
router.get('/', async (req, res) => {
  try {
    const { venue, date, status } = req.query;
    let filter = {};
    
    if (venue) {
      filter.venue = venue;
    }
    
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = {
        $gte: searchDate,
        $lt: nextDay
      };
    }
    
    if (status) {
      filter.status = status;
    }

    // Get all venues for dropdown
    const venues = await Venue.find({ isActive: true })
      .select('name city state')
      .sort({ city: 1, name: 1 });

    // Get concerts with venue and artist details
    const concerts = await Concert.find(filter)
      .populate('venue', 'name city state address capacity')
      .populate('artist', 'stageName')
      .sort({ date: 1, time: 1 });

    // Group concerts by venue
    const venueBookings = {};
    
    concerts.forEach(concert => {
      const venueId = concert.venue._id.toString();
      
      if (!venueBookings[venueId]) {
        venueBookings[venueId] = {
          venue: concert.venue,
          bookings: [],
          totalBookings: 0,
          upcomingBookings: 0,
          completedBookings: 0
        };
      }
      
      venueBookings[venueId].bookings.push(concert);
      venueBookings[venueId].totalBookings++;
      
      if (concert.status === 'completed') {
        venueBookings[venueId].completedBookings++;
      } else if (concert.status === 'approved') {
        venueBookings[venueId].upcomingBookings++;
      }
    });

    res.render('admin/venue-bookings', {
      layout: 'admin',
      currentPath: '/admin/venue-bookings',
      title: 'Venue Bookings Management',
      venueBookings,
      venues,
      selectedVenue: venue,
      selectedDate: date,
      selectedStatus: status
    });

  } catch (error) {
    console.error('Error fetching venue bookings:', error);
    res.status(500).render('error', { 
      message: 'Error loading venue bookings',
      error: error 
    });
  }
});

// GET: Check venue availability for specific date and time
router.get('/check-availability', async (req, res) => {
  try {
    const { venueId, date, time, duration = 2 } = req.query;

    if (!venueId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Venue ID, date, and time are required'
      });
    }

    const bookingDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create start and end times for the requested booking
    const startTime = new Date(bookingDate);
    startTime.setHours(hours, minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(hours + parseInt(duration), minutes, 0, 0);

    // Find existing bookings for this venue on this date
    const existingBookings = await Concert.find({
      venue: venueId,
      date: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      status: { $in: ['approved', 'pending'] }
    })
    .populate('artist', 'stageName')
    .select('title time date artist venueBooking.bookingHours status');

    // Check for time conflicts
    const conflicts = [];
    
    existingBookings.forEach(booking => {
      const [bookingHours, bookingMinutes] = booking.time.split(':').map(Number);
      const bookingStart = new Date(booking.date);
      bookingStart.setHours(bookingHours, bookingMinutes, 0, 0);
      
      const bookingEnd = new Date(bookingStart);
      const bookingDuration = booking.venueBooking?.bookingHours || 2;
      bookingEnd.setHours(bookingHours + bookingDuration, bookingMinutes, 0, 0);

      // Check if times overlap
      if (startTime < bookingEnd && endTime > bookingStart) {
        conflicts.push({
          title: booking.title,
          artist: booking.artist.stageName,
          time: booking.time,
          duration: bookingDuration,
          status: booking.status
        });
      }
    });

    res.json({
      success: true,
      available: conflicts.length === 0,
      conflicts: conflicts,
      existingBookings: existingBookings.map(booking => ({
        title: booking.title,
        artist: booking.artist.stageName,
        time: booking.time,
        duration: booking.venueBooking?.bookingHours || 2,
        status: booking.status
      }))
    });

  } catch (error) {
    console.error('Error checking venue availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking venue availability'
    });
  }
});

// GET: Get detailed bookings for a specific venue
router.get('/venue/:venueId', async (req, res) => {
  try {
    const { venueId } = req.params;
    const { date, status, timeRange } = req.query;

    // Build filter
    let filter = { venue: venueId };
    
    if (date) {
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      filter.date = {
        $gte: targetDate,
        $lt: nextDate
      };
    }
    
    if (status) {
      filter.status = status;
    }

    const venue = await Venue.findById(venueId);
    if (!venue) {
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venue-bookings');
    }

    const bookings = await Concert.find(filter)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ date: 1, time: 1 });

    // Filter by time range if specified
    let filteredBookings = bookings;
    if (timeRange) {
      filteredBookings = bookings.filter(booking => {
        if (!booking.time) return false;
        const [hours] = booking.time.split(':').map(Number);
        if (timeRange === 'morning' && hours >= 6 && hours < 12) return true;
        if (timeRange === 'afternoon' && hours >= 12 && hours < 18) return true;
        if (timeRange === 'evening' && hours >= 18 && hours < 24) return true;
        return false;
      });
    }

    const totalBookings = await Concert.countDocuments({ venue: venueId });
    const upcomingBookings = await Concert.countDocuments({
      venue: venueId,
      date: { $gte: new Date() },
      status: { $in: ['approved', 'pending'] }
    });

    res.render('admin/venue-booking-details', {
      layout: 'admin',
      currentPath: '/admin/venue-bookings',
      title: `Venue Bookings - ${venue.name}`,
      venue,
      bookings: filteredBookings,
      totalBookings,
      upcomingBookings,
      selectedDate: date,
      selectedStatus: status,
      selectedTimeRange: timeRange
    });

  } catch (error) {
    console.error('Error fetching venue details:', error);
    req.flash('error', 'Error fetching venue details');
    res.redirect('/admin/venue-bookings');
  }
});

module.exports = router;
