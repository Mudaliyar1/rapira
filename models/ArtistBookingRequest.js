const mongoose = require('mongoose');

const ArtistBookingRequestSchema = new mongoose.Schema({
  // Bulk booking fields
  isBulkRequest: {
    type: Boolean,
    default: false
  },
  bulkRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArtistBookingRequest',
    default: null
  },
  selections: [
    {
      bookingType: {
        type: String,
        enum: ['artist', 'role'],
        required: true
      },
      artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artist'
      },
      roleSlot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ArtistRoleSlot'
      }
    }
  ],
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
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
  eventDate: {
    type: Date,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  // Reference to either an Artist or an ArtistRoleSlot or a bulk booking
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
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, { timestamps: true });

// Validate that either artist or roleSlot is provided based on bookingType
ArtistBookingRequestSchema.pre('validate', function(next) {
  // For bulk requests, validate selections array
  if (this.isBulkRequest || this.bookingType === 'bulk') {
    // Ensure bookingType is set to 'bulk' for bulk requests
    this.bookingType = 'bulk';

    if (!this.selections || this.selections.length === 0) {
      this.invalidate('selections', 'At least one selection is required for bulk bookings');
    } else {
      // Validate each selection
      this.selections.forEach((selection, index) => {
        if (selection.bookingType === 'artist' && !selection.artist) {
          this.invalidate(`selections.${index}.artist`, 'Artist ID is required when booking type is artist');
        } else if (selection.bookingType === 'role' && !selection.roleSlot) {
          this.invalidate(`selections.${index}.roleSlot`, 'Role slot ID is required when booking type is role');
        }
      });
    }
  } else {
    // For single bookings, validate artist or roleSlot
    if (this.bookingType === 'artist' && !this.artist) {
      this.invalidate('artist', 'Artist ID is required when booking type is artist');
    } else if (this.bookingType === 'role' && !this.roleSlot) {
      this.invalidate('roleSlot', 'Role slot ID is required when booking type is role');
    }
  }
  next();
});

module.exports = mongoose.model('ArtistBookingRequest', ArtistBookingRequestSchema);
