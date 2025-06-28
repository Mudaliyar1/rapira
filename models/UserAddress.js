const mongoose = require('mongoose');

const UserAddressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    enum: ['Home', 'Work', 'Other']
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v); // Indian mobile number validation
      },
      message: 'Please enter a valid Indian mobile number'
    }
  },
  alternatePhone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[6-9]\d{9}$/.test(v); // Optional alternate phone
      },
      message: 'Please enter a valid Indian mobile number'
    }
  },
  addressLine1: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  addressLine2: {
    type: String,
    trim: true,
    maxlength: 200
  },
  landmark: {
    type: String,
    trim: true,
    maxlength: 100
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  state: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  pincode: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[1-9][0-9]{5}$/.test(v); // Indian pincode validation
      },
      message: 'Please enter a valid Indian pincode'
    }
  },
  country: {
    type: String,
    required: true,
    default: 'India',
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  addressType: {
    type: String,
    enum: ['Residential', 'Commercial'],
    default: 'Residential'
  },
  deliveryInstructions: {
    type: String,
    trim: true,
    maxlength: 300
  }
}, { 
  timestamps: true 
});

// Index for efficient queries
UserAddressSchema.index({ user: 1, isDefault: -1 });
UserAddressSchema.index({ user: 1, createdAt: -1 });

// Ensure only one default address per user
UserAddressSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other addresses of the same user
    await this.constructor.updateMany(
      { 
        user: this.user, 
        _id: { $ne: this._id } 
      },
      { 
        $set: { isDefault: false } 
      }
    );
  }
  next();
});

// Virtual for full address string
UserAddressSchema.virtual('fullAddress').get(function() {
  let address = this.addressLine1;
  
  if (this.addressLine2) {
    address += ', ' + this.addressLine2;
  }
  
  if (this.landmark) {
    address += ', Near ' + this.landmark;
  }
  
  address += ', ' + this.city + ', ' + this.state + ' - ' + this.pincode;
  
  if (this.country && this.country !== 'India') {
    address += ', ' + this.country;
  }
  
  return address;
});

// Virtual for formatted address for shipping labels
UserAddressSchema.virtual('shippingLabel').get(function() {
  return {
    name: this.fullName,
    phone: this.phone,
    address: this.fullAddress,
    pincode: this.pincode,
    city: this.city,
    state: this.state,
    country: this.country
  };
});

// Method to set as default address
UserAddressSchema.methods.setAsDefault = async function() {
  // Remove default flag from other addresses
  await this.constructor.updateMany(
    { 
      user: this.user, 
      _id: { $ne: this._id } 
    },
    { 
      $set: { isDefault: false } 
    }
  );
  
  // Set this address as default
  this.isDefault = true;
  await this.save();
};

// Static method to get user's default address
UserAddressSchema.statics.getDefaultAddress = function(userId) {
  return this.findOne({ user: userId, isDefault: true });
};

// Static method to get all user addresses
UserAddressSchema.statics.getUserAddresses = function(userId) {
  return this.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
};

// Method to validate address completeness
UserAddressSchema.methods.isComplete = function() {
  const requiredFields = [
    'fullName', 'phone', 'addressLine1', 
    'city', 'state', 'pincode', 'country'
  ];
  
  return requiredFields.every(field => {
    const value = this[field];
    return value && value.toString().trim().length > 0;
  });
};

// Method to format for order shipping
UserAddressSchema.methods.toShippingAddress = function() {
  return {
    fullName: this.fullName,
    phone: this.phone,
    email: '', // Will be filled from user data
    addressLine1: this.addressLine1,
    addressLine2: this.addressLine2 || '',
    city: this.city,
    state: this.state,
    pincode: this.pincode,
    country: this.country,
    landmark: this.landmark || '',
    deliveryInstructions: this.deliveryInstructions || ''
  };
};

module.exports = mongoose.model('UserAddress', UserAddressSchema);
