const mongoose = require('mongoose');

const venueEditRequestSchema = new mongoose.Schema({
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Original venue data (for comparison)
  originalData: {
    name: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    contactNumber: String,
    email: String,
    website: String,
    description: String,
    venueType: String,
    capacity: Number,
    priceRange: String,
    facilities: [String],
    pricing: {
      hourlyRates: [{
        hours: Number,
        rate: Number,
        commissionPercentage: Number,
        commissionAmount: Number
      }],
      minimumHours: Number,
      currency: String,
      adminCommission: {
        percentage: Number,
        advanceAmount: Number
      },
      ticketPricing: {
        minimumPrice: Number,
        suggestedPrice: Number
      },
      additionalCharges: mongoose.Schema.Types.Mixed
    }
  },
  
  // Requested changes
  requestedChanges: {
    name: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    contactNumber: String,
    email: String,
    website: String,
    description: String,
    venueType: String,
    capacity: Number,
    priceRange: String,
    facilities: [String],
    pricing: {
      hourlyRates: [{
        hours: Number,
        rate: Number,
        commissionPercentage: Number,
        commissionAmount: Number
      }],
      minimumHours: Number,
      currency: String,
      adminCommission: {
        percentage: Number,
        advanceAmount: Number
      },
      ticketPricing: {
        minimumPrice: Number,
        suggestedPrice: Number
      },
      additionalCharges: mongoose.Schema.Types.Mixed
    }
  },
  
  // Changed fields list
  changedFields: [String],
  
  // Reason for changes
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Request status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Admin response
  adminResponse: {
    message: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date
  },
  
  // New images for the venue (if any)
  newImages: [String],
  imagesToRemove: [String]
  
}, {
  timestamps: true
});

// Index for efficient queries
venueEditRequestSchema.index({ venue: 1, status: 1 });
venueEditRequestSchema.index({ user: 1, status: 1 });
venueEditRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VenueEditRequest', venueEditRequestSchema);
