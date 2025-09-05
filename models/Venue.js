const mongoose = require('mongoose');

const VenueSchema = new mongoose.Schema({
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
    enum: ['Parking', 'Sound System', 'Lighting', 'Stage', 'Green Rooms', 'Restrooms', 'Food Court', 'AC', 'Wheelchair Accessible', 'Wheelchair Access', 'Wi-Fi', 'WiFi', 'Dance Floor', 'Bar', 'Kitchen', 'Terrace', 'Garden', 'Pool', 'Gym', 'Spa', 'Conference Room', 'Projector', 'Microphone', 'DJ Setup']
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
        default: 10 // Default commission percentage for this hour
      },
      commissionAmount: {
        type: Number,
        min: 0,
        default: 0 // Calculated commission amount (rate * commissionPercentage / 100)
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
    adminCommission: {
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 10 // 10% commission
      },
      advanceAmount: {
        type: Number,
        min: 0,
        default: 0
      }
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
    },
    additionalCharges: [{
      name: {
        type: String,
        trim: true
      },
      amount: {
        type: Number,
        min: 0
      },
      isPercentage: {
        type: Boolean,
        default: false
      }
    }]
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
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  googleMapsLink: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Index for search and filtering
VenueSchema.index({ name: 'text', address: 'text', city: 'text' });
VenueSchema.index({ city: 1, isActive: 1 });
VenueSchema.index({ state: 1, isActive: 1 });
VenueSchema.index({ venueType: 1, isActive: 1 });
VenueSchema.index({ isActive: 1, isVerified: 1 });
VenueSchema.index({ createdAt: -1 });

// Virtual for full address
VenueSchema.virtual('fullAddress').get(function() {
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

// Virtual for display name (name + city)
VenueSchema.virtual('displayName').get(function() {
  return `${this.name} - ${this.city}`;
});

// Static method to get venues by city
VenueSchema.statics.getByCity = function(city) {
  return this.find({ 
    city: new RegExp(city, 'i'), 
    isActive: true 
  }).sort({ name: 1 });
};

// Static method to get active venues
VenueSchema.statics.getActiveVenues = function() {
  return this.find({ isActive: true }).sort({ city: 1, name: 1 });
};

module.exports = mongoose.model('Venue', VenueSchema);
