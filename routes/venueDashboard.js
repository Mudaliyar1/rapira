const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Concert = require('../models/Concert');
const VenueExternalBooking = require('../models/VenueExternalBooking');
const { isLoggedIn } = require('../middleware/auth');

// Middleware to check if user owns the venue
const checkVenueOwnership = async (req, res, next) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      createdBy: req.session.user.id
    });

    if (!venue) {
      req.flash('error', 'Venue not found or you do not have access to it');
      return res.redirect('/users/venues');
    }

    req.venue = venue;
    next();
  } catch (error) {
    console.error('Error checking venue ownership:', error);
    req.flash('error', 'Error accessing venue');
    res.redirect('/users/venues');
  }
};

// GET /venue-dashboard - List all user's venues for dashboard access
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const venues = await Venue.find({
      createdBy: req.session.user.id
    })
      .sort({ name: 1 })
      .lean();

    // Get quick stats for each venue
    const venuesWithStats = await Promise.all(venues.map(async (venue) => {
      const totalWebsiteBookings = await Concert.countDocuments({ venue: venue._id });
      const totalExternalBookings = await VenueExternalBooking.countDocuments({
        venue: venue._id,
        status: 'active'
      });
      const upcomingBookings = await Concert.countDocuments({
        venue: venue._id,
        date: { $gte: new Date() },
        status: { $in: ['approved', 'pending'] }
      });

      return {
        ...venue,
        stats: {
          totalWebsiteBookings,
          totalExternalBookings,
          upcomingBookings,
          totalBookings: totalWebsiteBookings + totalExternalBookings
        }
      };
    }));

    res.render('venues/dashboard-list', {
      layout: 'layouts/venue',
      currentPath: '/venue-dashboard',
      currentUser: req.session.user,
      title: 'My Venue Dashboards',
      venues: venuesWithStats,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue dashboards:', error);
    req.flash('error', 'Failed to load venue dashboards');
    res.redirect('/users/venues');
  }
});

// GET /venue-dashboard/:venueId/dashboard - Main venue dashboard
router.get('/:venueId/dashboard', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { month, year, viewAll } = req.query;

    // Current date for filtering
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();

    // Date filter - either all time or specific month
    let dateFilter = {};
    if (viewAll !== 'true') {
      // Get start and end of the month
      const startOfMonth = new Date(targetYear, targetMonth, 1);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0);
      dateFilter = {
        $gte: startOfMonth,
        $lte: endOfMonth
      };
    }

    // Get website bookings
    const websiteBookingsQuery = {
      venue: venue._id
    };
    if (viewAll !== 'true') {
      websiteBookingsQuery.date = dateFilter;
    }

    const websiteBookings = await Concert.find(websiteBookingsQuery)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ date: 1, time: 1 })
      .lean();

    // Get external bookings
    const externalBookingsQuery = {
      venue: venue._id,
      status: 'active'
    };
    if (viewAll !== 'true') {
      externalBookingsQuery.date = dateFilter;
    }

    const externalBookings = await VenueExternalBooking.find(externalBookingsQuery)
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Combine and format bookings for calendar
    const allBookings = [];

    // Add website bookings
    websiteBookings.forEach(booking => {
      allBookings.push({
        id: booking._id,
        type: 'website',
        title: booking.title,
        artistName: booking.artist?.user?.name || booking.artist?.stageName || 'Unknown Artist',
        date: booking.date,
        startTime: booking.time,
        duration: booking.venueBooking?.bookingHours || 2,
        status: booking.status,
        contactInfo: booking.artist?.user?.email || '',
        color: booking.status === 'approved' ? '#28a745' :
          booking.status === 'pending' ? '#ffc107' : '#6c757d'
      });
    });

    // Add external bookings
    externalBookings.forEach(booking => {
      allBookings.push({
        id: booking._id,
        type: 'external',
        title: booking.title,
        artistName: booking.artistName,
        date: booking.date,
        startTime: booking.startTime,
        duration: booking.durationHours,
        status: booking.status,
        contactInfo: booking.contactInfo || '',
        notes: booking.notes || '',
        color: '#17a2b8' // Blue for external bookings
      });
    });

    // Sort by date and time
    allBookings.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      return a.startTime.localeCompare(b.startTime);
    });

    // Calculate statistics
    const stats = {
      totalWebsiteBookings: websiteBookings.length,
      totalExternalBookings: externalBookings.length,
      totalBookings: allBookings.length,
      upcomingBookings: allBookings.filter(b => new Date(b.date) >= new Date()).length,
      pendingApprovals: websiteBookings.filter(b => b.status === 'pending').length
    };
    res.render('venues/dashboard', {
      layout: 'layouts/venue',
      currentPath: '/venue-dashboard',
      currentUser: req.session.user,
      title: `${venue.name} - Dashboard`,
      venue,
      bookings: allBookings,
      websiteBookings,
      externalBookings,
      stats,
      currentMonth: targetMonth + 1,
      currentYear: targetYear,
      viewAll: viewAll === 'true',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading venue dashboard:', error);
    req.flash('error', 'Failed to load venue dashboard');
    res.redirect('/venue-dashboard');
  }
});

// GET /venue-dashboard/:venueId/add-external-booking - Show add external booking form
router.get('/:venueId/add-external-booking', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;

    // Get conflict details from session if they exist
    const conflictDetails = req.session.conflictDetails || null;

    // Clear conflict details from session after using them
    if (req.session.conflictDetails) {
      delete req.session.conflictDetails;
    }

    res.render('venues/add-external-booking', {
      layout: 'layouts/venue',
      currentPath: '/venue-dashboard',
      currentUser: req.session.user,
      title: `Add External Booking - ${venue.name}`,
      venue,
      user: req.session.user,
      query: req.query,
      conflictDetails,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading add external booking form:', error);
    req.flash('error', 'Failed to load form');
    res.redirect(`/venue-dashboard/${req.params.venueId}/dashboard`);
  }
});

// POST /venue-dashboard/:venueId/add-booking - Add external booking
router.post('/:venueId/add-booking', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { title, artistName, date, startTime, durationHours, contactInfo, notes } = req.body;

    // Validate required fields
    if (!title || !artistName || !date || !startTime || !durationHours) {
      req.flash('error', 'All required fields must be filled');
      return res.redirect(`/venue-dashboard/${venue._id}/add-external-booking`);
    }

    // Check for conflicts
    const conflictCheck = await VenueExternalBooking.checkConflicts(
      venue._id,
      date,
      startTime,
      parseInt(durationHours)
    );

    if (conflictCheck.hasConflicts) {
      // Store conflict details in session for better display
      req.session.conflictDetails = {
        conflicts: conflictCheck.conflicts.map(conflict => ({
          type: conflict.type,
          title: conflict.title,
          artistName: conflict.artistName,
          startTime: conflict.startTime,
          duration: conflict.duration,
          reason: conflict.reason,
          date: conflict.date instanceof Date ? conflict.date.toISOString().split('T')[0] : conflict.date
        })),
        requestedBooking: {
          title: title.trim(),
          artistName: artistName.trim(),
          date: date,
          startTime: startTime.trim(),
          durationHours: parseInt(durationHours)
        }
      };

      req.flash('error', 'Cannot add booking due to conflicts with existing bookings. Please check the details below and choose a different date/time.');
      return res.redirect(`/venue-dashboard/${venue._id}/add-external-booking?conflicts=true`);
    }

    // Create external booking
    const externalBooking = new VenueExternalBooking({
      venue: venue._id,
      title: title.trim(),
      artistName: artistName.trim(),
      date: new Date(date),
      startTime: startTime.trim(),
      durationHours: parseInt(durationHours),
      contactInfo: contactInfo ? contactInfo.trim() : '',
      notes: notes ? notes.trim() : '',
      createdBy: req.session.user.id
    });

    await externalBooking.save();

    req.flash('success', `External booking "${title}" added successfully! It will now appear in your venue dashboard.`);
    res.redirect(`/venue-dashboard/${venue._id}/dashboard`);
  } catch (error) {
    console.error('Error adding external booking:', error);
    req.flash('error', 'Failed to add external booking. Please try again.');
    res.redirect(`/venue-dashboard/${req.params.venueId}/add-external-booking`);
  }
});

// POST /venue-dashboard/:venueId/check-availability - Check availability for external booking
router.post('/:venueId/check-availability', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { date, startTime, durationHours } = req.body;

    if (!date || !startTime || !durationHours) {
      return res.status(400).json({
        success: false,
        message: 'Date, start time, and duration are required'
      });
    }

    // Check for conflicts
    const conflictCheck = await VenueExternalBooking.checkConflicts(
      venue._id,
      date,
      startTime,
      parseInt(durationHours)
    );

    // Format conflicts for response
    const formattedConflicts = conflictCheck.conflicts.map(conflict => ({
      type: conflict.type,
      title: conflict.title,
      artistName: conflict.artistName,
      time: conflict.startTime,
      duration: conflict.duration,
      reason: conflict.reason,
      date: conflict.date.toISOString().split('T')[0]
    }));

    res.json({
      success: true,
      available: !conflictCheck.hasConflicts,
      conflicts: formattedConflicts,
      message: conflictCheck.hasConflicts ?
        'Time slot conflicts found' :
        'Time slot is available',
      venue: {
        name: venue.name,
        city: venue.city
      },
      summary: {
        websiteBookings: conflictCheck.websiteBookings,
        externalBookings: conflictCheck.externalBookings,
        totalConflicts: formattedConflicts.length
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking availability'
    });
  }
});

// GET /venue-dashboard/:venueId/external-bookings - List external bookings
router.get('/:venueId/external-bookings', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { status = 'all', month, year } = req.query;

    // Build query
    const query = { venue: venue._id };

    if (status !== 'all') {
      query.status = status;
    }

    if (month && year) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const externalBookings = await VenueExternalBooking.find(query)
      .sort({ date: -1, startTime: -1 })
      .lean();

    res.render('venues/external-bookings', {
      layout: 'layouts/venue',
      currentPath: '/venue-dashboard',
      currentUser: req.session.user,
      title: `External Bookings - ${venue.name}`,
      venue,
      bookings: externalBookings,
      selectedStatus: status,
      selectedMonth: month,
      selectedYear: year,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading external bookings:', error);
    req.flash('error', 'Failed to load external bookings');
    res.redirect(`/venue-dashboard/${req.params.venueId}/dashboard`);
  }
});

// GET /venue-dashboard/:venueId/external-bookings/:bookingId - View/Edit external booking details
router.get('/:venueId/external-bookings/:bookingId', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { bookingId } = req.params;

    // Get the specific external booking
    const booking = await VenueExternalBooking.findOne({
      _id: bookingId,
      venue: venue._id
    }).lean();

    if (!booking) {
      req.flash('error', 'External booking not found');
      return res.redirect(`/venue-dashboard/${venue._id}/dashboard`);
    }

    res.render('venues/external-booking-details', {
      layout: 'layouts/venue',
      currentPath: '/venue-dashboard',
      currentUser: req.session.user,
      title: `External Booking Details - ${venue.name}`,
      venue,
      booking,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading external booking details:', error);
    req.flash('error', 'Failed to load booking details');
    res.redirect(`/venue-dashboard/${req.params.venueId}/dashboard`);
  }
});

// DELETE /venue-dashboard/:venueId/external-bookings/:bookingId - Delete external booking
router.delete('/:venueId/external-bookings/:bookingId', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { bookingId } = req.params;

    const booking = await VenueExternalBooking.findOne({
      _id: bookingId,
      venue: venue._id,
      createdBy: req.session.user.id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await VenueExternalBooking.findByIdAndDelete(bookingId);

    res.json({
      success: true,
      message: 'External booking deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting external booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking'
    });
  }
});

// PUT /venue-dashboard/:venueId/external-bookings/:bookingId - Update external booking
router.put('/:venueId/external-bookings/:bookingId', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    const { bookingId } = req.params;
    const { title, artistName, date, startTime, durationHours, contactInfo, notes, status } = req.body;

    const booking = await VenueExternalBooking.findOne({
      _id: bookingId,
      venue: venue._id,
      createdBy: req.session.user.id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // If date/time is being changed, check for conflicts
    if (date !== booking.date.toISOString().split('T')[0] ||
      startTime !== booking.startTime ||
      parseInt(durationHours) !== booking.durationHours) {

      const conflictCheck = await VenueExternalBooking.checkConflicts(
        venue._id,
        date,
        startTime,
        parseInt(durationHours),
        bookingId // Exclude current booking from conflict check
      );

      if (conflictCheck.hasConflicts) {
        return res.status(400).json({
          success: false,
          message: `Cannot update booking due to conflicts: ${conflictCheck.conflicts[0].reason}`,
          conflicts: conflictCheck.conflicts
        });
      }
    }

    // Update booking
    booking.title = title.trim();
    booking.artistName = artistName.trim();
    booking.date = new Date(date);
    booking.startTime = startTime.trim();
    booking.durationHours = parseInt(durationHours);
    booking.contactInfo = contactInfo ? contactInfo.trim() : '';
    booking.notes = notes ? notes.trim() : '';
    if (status) booking.status = status;

    await booking.save();

    res.json({
      success: true,
      message: 'External booking updated successfully',
      booking: booking
    });
  } catch (error) {
    console.error('Error updating external booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking'
    });
  }
});

// POST /venue-dashboard/:venueId/toggle-status - Enable/Disable venue
router.post('/:venueId/toggle-status', isLoggedIn, checkVenueOwnership, async (req, res) => {
  try {
    const venue = req.venue;
    venue.isActive = !venue.isActive;
    await venue.save();

    const statusText = venue.isActive ? 'enabled' : 'disabled';
    req.flash('success', `Venue "${venue.name}" has been ${statusText} successfully.`);
    res.redirect(`/venue-dashboard/${venue._id}/dashboard`);
  } catch (error) {
    console.error('Error toggling venue status:', error);
    req.flash('error', 'Failed to update venue status');
    res.redirect(`/venue-dashboard/${req.params.venueId}/dashboard`);
  }
});

module.exports = router;