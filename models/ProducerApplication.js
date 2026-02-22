const mongoose = require('mongoose');

const ProducerApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mobileNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(value) {
        return /^\d{10}$/.test(value);
      },
      message: props => `${props.value} is not a valid mobile number`
    }
  },
  yearsOfExperience: {
    type: Number,
    required: true,
    min: 0,
    max: 80
  },
  instagramLink: {
    type: String,
    default: ''
  },
  youtubeLink: {
    type: String,
    default: ''
  },
  skills: {
    type: String,
    required: true
  },
  services: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  idProofType: {
    type: String,
    enum: ['Aadhaar Card', 'PAN Card', 'Driving License', 'Passport', 'Voter ID', 'Other'],
    required: true
  },
  idProofUrl: {
    type: String,
    required: true
  },
  idProofMedia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media',
    default: null
  },
  agreedToTerms: {
    type: Boolean,
    required: true,
    validate: {
      validator: function(value) {
        return value === true;
      },
      message: 'You must agree to terms and conditions'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('ProducerApplication', ProducerApplicationSchema);
