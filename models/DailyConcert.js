const mongoose = require('mongoose');

const DailyConcertSchema = new mongoose.Schema({
  // Source booking request
  bookingRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArtistBookingRequest',
    required: true
  },
  // Event title (generated from artist + role)
  title: {
    type: String,
    required: true,
    trim: true
  },
  // Event description
  description: {
    type: String,
    default: ''
  },
  // Artist or role information
  bookingType: {
    type: String,
    enum: ['artist', 'role', 'bulk'],
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist'
  },
  roleSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArtistRoleSlot'
  },
  // Event details
  eventDate: {
    type: Date,
    required: true
  },
  eventTime: {
    type: String,
    default: '19:00'
  },
  eventCity: {
    type: String,
    required: true,
    trim: true
  },
  eventState: {
    type: String,
    required: true,
    trim: true
  },
  // Organizer information
  organizerName: {
    type: String,
    required: true,
    trim: true
  },
  // Visibility control
  isVisible: {
    type: Boolean,
    default: true
  },
  // Admin who created/approved this concert
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Validate that either artist or roleSlot is provided based on bookingType
DailyConcertSchema.pre('validate', function(next) {
  if (this.bookingType === 'artist' && !this.artist) {
    this.invalidate('artist', 'Artist ID is required when booking type is artist');
  } else if (this.bookingType === 'role' && !this.roleSlot) {
    this.invalidate('roleSlot', 'Role slot ID is required when booking type is role');
  }
  next();
});

module.exports = mongoose.model('DailyConcert', DailyConcertSchema);
