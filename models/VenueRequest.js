const mongoose = require('mongoose');

const VenueRequestSchema = new mongoose.Schema({
  // User who submitted the request
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Basic venue information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  state: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  pincode: {
    type: String,
    required: false,
    trim: true,
    maxlength: 10,
    default: ''
  },
  capacity: {
    type: Number,
    min: 1,
    default: null
  },
  venueType: {
    type: String,
    enum: ['Indoor Hall', 'Outdoor Venue', 'Auditorium', 'Stadium', 'Club', 'Restaurant', 'Hotel', 'Community Center', 'Other'],
    default: 'Indoor Hall'
  },
  facilities: [{
    type: String,
    enum: ['Parking', 'Sound System', 'Lighting', 'Stage', 'Green Rooms', 'Restrooms', 'Food Court', 'AC', 'Wheelchair Accessible', 'Wheelchair Access', 'Wi-Fi', 'WiFi']
  }],
  contactPerson: {
    name: {
      type: String,
      trim: true,
      maxlength: 100
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 15
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100
    }
  },
  priceRange: {
    type: String,
    enum: ['Budget', 'Mid-Range', 'Premium', 'Luxury'],
    default: 'Mid-Range'
  },
  
  // Pricing information
  pricing: {
    hourlyRates: [{
      hours: {
        type: Number,
        min: 1,
        max: 24,
        required: true
      },
      rate: {
        type: Number,
        min: 0,
        required: true
      },
      commissionPercentage: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
        default: 10
      },
      commissionAmount: {
        type: Number,
        min: 0,
        default: 0
      }
    }],
    minimumHours: {
      type: Number,
      min: 1,
      default: 1
    },
    currency: {
      type: String,
      default: 'INR'
    },
    ticketPricing: {
      minimumPrice: {
        type: Number,
        min: 0,
        default: 0
      },
      suggestedPrice: {
        type: Number,
        min: 0,
        default: 100
      }
    }
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  images: [{
    type: String,
    default: []
  }],
  media: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  }],
  googleMapsLink: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  
  // Request status and admin response
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  
  // Admin review information
  adminNotes: {
    type: String,
    trim: true,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  
  // Rejection reason
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  },

  // Cancellation info (user-initiated)
  cancelReason: {
    type: String,
    trim: true,
    default: ''
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Reference to created venue (if approved)
  createdVenue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue'
  }
}, { 
  timestamps: true 
});

// Index for search and filtering
VenueRequestSchema.index({ user: 1, status: 1 });
VenueRequestSchema.index({ status: 1, createdAt: -1 });
VenueRequestSchema.index({ city: 1, status: 1 });
VenueRequestSchema.index({ reviewedBy: 1 });

// Virtual for full address
VenueRequestSchema.virtual('fullAddress').get(function() {
  let address = this.address;
  if (this.city) {
    address += ', ' + this.city;
  }
  if (this.state) {
    address += ', ' + this.state;
  }
  if (this.pincode) {
    address += ' - ' + this.pincode;
  }
  return address;
});

// Virtual for display name
VenueRequestSchema.virtual('displayName').get(function() {
  return `${this.name} - ${this.city}`;
});

// Static method to get pending requests
VenueRequestSchema.statics.getPendingRequests = function() {
  return this.find({ status: 'pending' })
    .populate('user', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get user's venue requests
VenueRequestSchema.statics.getByUser = function(userId) {
  return this.find({ user: userId })
    .populate('reviewedBy', 'name')
    .populate('createdVenue', 'name isActive')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('VenueRequest', VenueRequestSchema);
