
const mongoose = require('mongoose');

const ArtistApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artistLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Established'],
    required: true
  },
  aadharCard: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\d{12}$/.test(v);
      },
      message: props => `${props.value} is not a valid Aadhaar number! Must be exactly 12 digits.`
    }
  },
  state: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number! Must be exactly 10 digits.`
    }
  },
  proofPhoto: {
    type: String,
    required: true
  },
  proofPhotoData: {
    type: Buffer
  },
  proofPhotoContentType: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'n/a'],
    default: 'n/a'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  registrationFee: {
    type: Number,
    default: 0
  },
  adminComments: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Indexes for fast admin queries - WITHOUT these, every query does a full collection scan
ArtistApplicationSchema.index({ status: 1, createdAt: -1 });   // most common admin filter
ArtistApplicationSchema.index({ user: 1 });                     // check user's application
ArtistApplicationSchema.index({ artistLevel: 1 });              // level filter
ArtistApplicationSchema.index({ state: 1 });                    // state filter
ArtistApplicationSchema.index({ createdAt: -1 });               // default sort

module.exports = mongoose.model('ArtistApplication', ArtistApplicationSchema);

