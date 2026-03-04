const mongoose = require('mongoose');

const VenueExternalBookingSchema = new mongoose.Schema({
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  artistName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format'
    }
  },
  durationHours: {
    type: Number,
    required: true,
    min: 1,
    max: 24
  },
  contactInfo: {
    type: String,
    trim: true,
    maxlength: 200
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
VenueExternalBookingSchema.index({ venue: 1, date: 1, status: 1 });
VenueExternalBookingSchema.index({ createdBy: 1, venue: 1 });
VenueExternalBookingSchema.index({ date: 1, status: 1 });

// Virtual for end time calculation
VenueExternalBookingSchema.virtual('endTime').get(function () {
  const [hours, minutes] = this.startTime.split(':').map(Number);
  const endDate = new Date();
  endDate.setHours(hours + this.durationHours, minutes, 0, 0);
  return endDate.toTimeString().slice(0, 5);
});

// Virtual for full date display
VenueExternalBookingSchema.virtual('displayDate').get(function () {
  return this.date.toLocaleDateString('en-IN');
});

// Virtual for time range display
VenueExternalBookingSchema.virtual('timeRange').get(function () {
  return `${this.startTime} - ${this.endTime}`;
});

// Static method to check conflicts with existing bookings
VenueExternalBookingSchema.statics.checkConflicts = async function (venueId, date, startTime, durationHours, excludeId = null, excludeConcertId = null) {
  const Concert = require('./Concert');

  // Parse the input
  const bookingDate = new Date(date);
  const [startHours, startMinutes] = startTime.split(':').map(Number);

  // Create start and end times for the requested booking
  const requestedStart = new Date(bookingDate);
  requestedStart.setHours(startHours, startMinutes, 0, 0);

  const requestedEnd = new Date(requestedStart);
  requestedEnd.setTime(requestedStart.getTime() + (durationHours * 60 * 60 * 1000));

  const MINIMUM_GAP_HOURS = 12;
  const conflicts = [];

  // Build concert query, excluding the current concert if provided
  const concertQuery = {
    venue: venueId,
    date: {
      $gte: new Date(bookingDate.getTime() - 24 * 60 * 60 * 1000),
      $lte: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
    },
    status: { $in: ['pending', 'approved'] }
  };
  if (excludeConcertId) {
    concertQuery._id = { $ne: excludeConcertId };
  }

  // Check against website bookings (concerts)
  const existingConcerts = await Concert.find(concertQuery).populate({
    path: 'artist',
    populate: { path: 'user', select: 'name' }
  });

  // Check against external bookings
  const query = {
    venue: venueId,
    date: {
      $gte: new Date(bookingDate.getTime() - 24 * 60 * 60 * 1000),
      $lte: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
    },
    status: 'active'
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingExternalBookings = await this.find(query);

  // Helper function to get concert times
  const getConcertTimes = (concertDate, time, duration) => {
    const start = new Date(concertDate);
    const [hours, minutes] = time.split(':').map(Number);
    start.setHours(hours, minutes, 0, 0);

    const end = new Date(start);
    end.setTime(start.getTime() + (duration * 60 * 60 * 1000));

    return { start, end };
  };

  // Check website concerts
  existingConcerts.forEach(concert => {
    if (concert.time && concert.venueBooking && concert.venueBooking.bookingHours) {
      const { start: existingStart, end: existingEnd } = getConcertTimes(
        concert.date,
        concert.time,
        concert.venueBooking.bookingHours
      );

      // Check for overlap
      if (requestedStart < existingEnd && requestedEnd > existingStart) {
        conflicts.push({
          type: 'website',
          id: concert._id,
          title: concert.title,
          artistName: concert.artist?.user?.name || concert.artist?.stageName || 'Unknown',
          date: concert.date,
          startTime: concert.time,
          duration: concert.venueBooking.bookingHours,
          reason: 'Time slots overlap with website booking'
        });
      }

      // Check for 12-hour gap
      const timeBetween1 = Math.abs(requestedStart - existingEnd) / (1000 * 60 * 60);
      const timeBetween2 = Math.abs(existingStart - requestedEnd) / (1000 * 60 * 60);

      if (timeBetween1 < MINIMUM_GAP_HOURS && timeBetween1 >= 0) {
        conflicts.push({
          type: 'website',
          id: concert._id,
          title: concert.title,
          artistName: concert.artist?.user?.name || concert.artist?.stageName || 'Unknown',
          date: concert.date,
          startTime: concert.time,
          duration: concert.venueBooking.bookingHours,
          reason: `Minimum ${MINIMUM_GAP_HOURS}-hour gap required with website booking`
        });
      }

      if (timeBetween2 < MINIMUM_GAP_HOURS && timeBetween2 >= 0) {
        conflicts.push({
          type: 'website',
          id: concert._id,
          title: concert.title,
          artistName: concert.artist?.user?.name || concert.artist?.stageName || 'Unknown',
          date: concert.date,
          startTime: concert.time,
          duration: concert.venueBooking.bookingHours,
          reason: `Minimum ${MINIMUM_GAP_HOURS}-hour gap required with website booking`
        });
      }
    }
  });

  // Check external bookings
  existingExternalBookings.forEach(booking => {
    const { start: existingStart, end: existingEnd } = getConcertTimes(
      booking.date,
      booking.startTime,
      booking.durationHours
    );

    // Check for overlap
    if (requestedStart < existingEnd && requestedEnd > existingStart) {
      conflicts.push({
        type: 'external',
        id: booking._id,
        title: booking.title,
        artistName: booking.artistName,
        date: booking.date,
        startTime: booking.startTime,
        duration: booking.durationHours,
        reason: 'Time slots overlap with external booking'
      });
    }

    // Check for 12-hour gap
    const timeBetween1 = Math.abs(requestedStart - existingEnd) / (1000 * 60 * 60);
    const timeBetween2 = Math.abs(existingStart - requestedEnd) / (1000 * 60 * 60);

    if (timeBetween1 < MINIMUM_GAP_HOURS && timeBetween1 >= 0) {
      conflicts.push({
        type: 'external',
        id: booking._id,
        title: booking.title,
        artistName: booking.artistName,
        date: booking.date,
        startTime: booking.startTime,
        duration: booking.durationHours,
        reason: `Minimum ${MINIMUM_GAP_HOURS}-hour gap required with external booking`
      });
    }

    if (timeBetween2 < MINIMUM_GAP_HOURS && timeBetween2 >= 0) {
      conflicts.push({
        type: 'external',
        id: booking._id,
        title: booking.title,
        artistName: booking.artistName,
        date: booking.date,
        startTime: booking.startTime,
        duration: booking.durationHours,
        reason: `Minimum ${MINIMUM_GAP_HOURS}-hour gap required with external booking`
      });
    }
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    websiteBookings: existingConcerts.length,
    externalBookings: existingExternalBookings.length
  };
};

// Update timestamp on save
VenueExternalBookingSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VenueExternalBooking', VenueExternalBookingSchema);