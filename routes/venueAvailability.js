const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const VenueExternalBooking = require('../models/VenueExternalBooking');
const Venue = require('../models/Venue');
const { isLoggedIn, isArtist } = require('../middleware/auth');

// Check venue availability for specific date and time
router.post('/check-availability', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { venueId, date, startTime, duration, concertId } = req.body;

    if (!venueId || !date || !startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Venue ID, date, start time, and duration are required'
      });
    }

    // Use the VenueExternalBooking conflict checking method which includes both website and external bookings
    // Pass concertId to exclude the current concert from conflict checks (prevents self-conflict on edit)
    const conflictCheck = await VenueExternalBooking.checkConflicts(
      venueId,
      date,
      startTime,
      parseInt(duration),
      null,         // excludeId (external booking)
      concertId     // excludeConcertId (website concert)
    );

    // Format conflicts for response
    const formattedConflicts = conflictCheck.conflicts.map(conflict => ({
      concertId: conflict.id,
      title: conflict.title,
      artistName: conflict.artistName,
      startTime: conflict.startTime,
      endTime: conflict.endTime || `${parseInt(conflict.startTime.split(':')[0]) + conflict.duration}:${conflict.startTime.split(':')[1]}`,
      duration: conflict.duration,
      status: conflict.status || 'active',
      reason: conflict.reason,
      type: conflict.type,
      conflictDate: conflict.date.toISOString().split('T')[0]
    }));

    // Generate time suggestions if there's a conflict
    const suggestions = [];
    if (conflictCheck.hasConflicts) {
      // Find available time slots with 12-hour gaps
      const venue = await Venue.findById(venueId);
      const currentDate = new Date(date);

      // Check multiple days for available slots
      for (let i = 0; i <= 7; i++) { // Check current day and next 7 days
        const checkDate = new Date(currentDate);
        checkDate.setDate(currentDate.getDate() + i);

        // Check if we can fit the requested duration at various times
        for (let hour = 6; hour <= 22; hour++) {
          const testStartTime = `${hour.toString().padStart(2, '0')}:00`;

          const testConflictCheck = await VenueExternalBooking.checkConflicts(
            venueId,
            checkDate.toISOString().split('T')[0],
            testStartTime,
            parseInt(duration),
            null,
            concertId
          );

          if (!testConflictCheck.hasConflicts) {
            const testStart = new Date(checkDate);
            testStart.setHours(hour, 0, 0, 0);

            const testEnd = new Date(testStart);
            testEnd.setTime(testStart.getTime() + (parseInt(duration) * 60 * 60 * 1000));

            suggestions.push({
              date: checkDate.toISOString().split('T')[0],
              startTime: testStartTime,
              endTime: testEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              available: true,
              note: `Available with 12-hour gap`
            });

            // Limit suggestions per day
            if (suggestions.filter(s => s.date === checkDate.toISOString().split('T')[0]).length >= 3) {
              break;
            }
          }
        }

        // Limit total suggestions
        if (suggestions.length >= 10) break;
      }
    } else {
      // If no conflicts, show the requested slot as available
      const requestedStart = new Date(date + 'T' + startTime);
      const requestedEnd = new Date(requestedStart.getTime() + (parseInt(duration) * 60 * 60 * 1000));

      suggestions.push({
        startTime: requestedStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        endTime: requestedEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        available: true,
        note: 'Requested slot is available'
      });
    }

    // Get venue details
    const venue = await Venue.findById(venueId);

    // Get existing bookings for display
    const existingConcerts = await Concert.find({
      venue: venueId,
      date: new Date(date),
      status: { $in: ['pending', 'approved'] }
    }).populate({
      path: 'artist',
      populate: { path: 'user', select: 'name' }
    });

    const existingExternalBookings = await VenueExternalBooking.find({
      venue: venueId,
      date: new Date(date),
      status: 'active'
    });

    const allExistingBookings = [
      ...existingConcerts.map(booking => ({
        title: booking.title,
        artistName: booking.artist?.user?.name || booking.artist?.stageName || 'Unknown',
        startTime: booking.time,
        duration: booking.venueBooking ? booking.venueBooking.bookingHours : 0,
        status: booking.status,
        type: 'website'
      })),
      ...existingExternalBookings.map(booking => ({
        title: booking.title,
        artistName: booking.artistName,
        startTime: booking.startTime,
        duration: booking.durationHours,
        status: booking.status,
        type: 'external'
      }))
    ];

    res.json({
      success: true,
      available: !conflictCheck.hasConflicts,
      requestedSlot: {
        startTime: startTime,
        endTime: `${parseInt(startTime.split(':')[0]) + parseInt(duration)}:${startTime.split(':')[1]}`,
        duration: parseInt(duration)
      },
      venue: {
        name: venue ? venue.name : 'Unknown Venue',
        city: venue ? venue.city : '',
        capacity: venue ? venue.capacity : null
      },
      conflicts: formattedConflicts,
      existingBookings: allExistingBookings,
      suggestions: suggestions,
      totalExistingBookings: allExistingBookings.length,
      summary: {
        websiteBookings: conflictCheck.websiteBookings,
        externalBookings: conflictCheck.externalBookings,
        totalConflicts: formattedConflicts.length
      }
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
