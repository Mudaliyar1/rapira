
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
      validator: function(v) {
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
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number! Must be exactly 10 digits.`
    }
  },
  proofPhoto: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminComments: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('ArtistApplication', ArtistApplicationSchema);
