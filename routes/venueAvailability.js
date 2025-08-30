const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const Venue = require('../models/Venue');
const { isLoggedIn, isArtist } = require('../middleware/auth');

// Check venue availability for specific date and time
router.post('/check-availability', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { venueId, date, startTime, duration } = req.body;

    if (!venueId || !date || !startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Venue ID, date, start time, and duration are required'
      });
    }

    // Parse the input
    const bookingDate = new Date(date);
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const durationHours = parseInt(duration);

    // Create start and end times for the requested booking
    const requestedStart = new Date(bookingDate);
    requestedStart.setHours(startHours, startMinutes, 0, 0);
    
    const requestedEnd = new Date(requestedStart);
    requestedEnd.setHours(startHours + durationHours, startMinutes, 0, 0);

    // Format times for display
    const formatTime = (date) => {
      return date.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    // Find existing bookings for this venue on this date
    const existingBookings = await Concert.find({
      venue: venueId,
      date: {
        $gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
        $lte: new Date(bookingDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['pending', 'approved'] } // Only check non-cancelled bookings
    })
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name' }
    })
    .sort({ time: 1 });

    // Check for conflicts
    const conflicts = [];
    let hasConflict = false;

    existingBookings.forEach(booking => {
      if (booking.time && booking.venueBooking && booking.venueBooking.bookingHours) {
        const [existingHours, existingMinutes] = booking.time.split(':').map(Number);
        
        const existingStart = new Date(bookingDate);
        existingStart.setHours(existingHours, existingMinutes, 0, 0);
        
        const existingEnd = new Date(existingStart);
        existingEnd.setHours(existingHours + booking.venueBooking.bookingHours, existingMinutes, 0, 0);

        // Check for overlap
        const hasOverlap = (requestedStart < existingEnd && requestedEnd > existingStart);

        if (hasOverlap) {
          hasConflict = true;
          conflicts.push({
            concertId: booking._id,
            title: booking.title,
            artistName: booking.artist.user ? booking.artist.user.name : booking.artist.stageName,
            startTime: formatTime(existingStart),
            endTime: formatTime(existingEnd),
            duration: booking.venueBooking.bookingHours,
            status: booking.status,
            rawStart: existingStart,
            rawEnd: existingEnd
          });
        }
      }
    });

    // Generate time suggestions if there's a conflict
    const suggestions = [];
    if (hasConflict) {
      const allBookings = existingBookings
        .filter(b => b.time && b.venueBooking && b.venueBooking.bookingHours)
        .map(booking => {
          const [existingHours, existingMinutes] = booking.time.split(':').map(Number);
          const existingStart = new Date(bookingDate);
          existingStart.setHours(existingHours, existingMinutes, 0, 0);
          const existingEnd = new Date(existingStart);
          existingEnd.setHours(existingHours + booking.venueBooking.bookingHours, existingMinutes, 0, 0);
          return { start: existingStart, end: existingEnd };
        })
        .sort((a, b) => a.start - b.start);

      // Find available slots
      const dayStart = new Date(bookingDate);
      dayStart.setHours(6, 0, 0, 0); // Start from 6 AM

      const dayEnd = new Date(bookingDate);
      dayEnd.setHours(23, 0, 0, 0); // End at 11 PM

      // Check slots before first booking
      if (allBookings.length > 0) {
        const firstBookingStart = allBookings[0].start;
        const potentialEnd = new Date(dayStart.getTime() + durationHours * 60 * 60 * 1000);
        
        if (potentialEnd <= firstBookingStart) {
          suggestions.push({
            startTime: formatTime(dayStart),
            endTime: formatTime(potentialEnd),
            available: true
          });
        }
      }

      // Check slots between bookings
      for (let i = 0; i < allBookings.length - 1; i++) {
        const currentEnd = allBookings[i].end;
        const nextStart = allBookings[i + 1].start;
        const gapDuration = (nextStart - currentEnd) / (1000 * 60 * 60); // in hours

        if (gapDuration >= durationHours) {
          const potentialEnd = new Date(currentEnd.getTime() + durationHours * 60 * 60 * 1000);
          suggestions.push({
            startTime: formatTime(currentEnd),
            endTime: formatTime(potentialEnd),
            available: true
          });
        }
      }

      // Check slot after last booking
      if (allBookings.length > 0) {
        const lastBookingEnd = allBookings[allBookings.length - 1].end;
        const potentialEnd = new Date(lastBookingEnd.getTime() + durationHours * 60 * 60 * 1000);
        
        if (potentialEnd <= dayEnd) {
          suggestions.push({
            startTime: formatTime(lastBookingEnd),
            endTime: formatTime(potentialEnd),
            available: true
          });
        }
      }

      // If no bookings exist, suggest the requested time or early slots
      if (allBookings.length === 0) {
        suggestions.push({
          startTime: formatTime(requestedStart),
          endTime: formatTime(requestedEnd),
          available: true
        });
      }
    }

    // Get venue details
    const venue = await Venue.findById(venueId);

    res.json({
      success: true,
      available: !hasConflict,
      requestedSlot: {
        startTime: formatTime(requestedStart),
        endTime: formatTime(requestedEnd),
        duration: durationHours
      },
      venue: {
        name: venue ? venue.name : 'Unknown Venue',
        city: venue ? venue.city : '',
        capacity: venue ? venue.capacity : null
      },
      conflicts: conflicts,
      existingBookings: existingBookings.map(booking => ({
        title: booking.title,
        artistName: booking.artist.user ? booking.artist.user.name : booking.artist.stageName,
        startTime: booking.time,
        duration: booking.venueBooking ? booking.venueBooking.bookingHours : 0,
        status: booking.status
      })),
      suggestions: suggestions,
      totalExistingBookings: existingBookings.length
    });

  } catch (error) {
    console.error('Error checking venue availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking venue availability',
      error: error.message
    });
  }
});

module.exports = router;
