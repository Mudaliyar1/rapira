const mongoose = require('mongoose');

const ArtistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stageName: {
    type: String,
    required: true
  },
  genre: {
    type: String,
    required: true
  },
  artistLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Established'],
    default: 'Beginner'
  },
  yearsActive: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  featuredArtist: {
    type: Boolean,
    default: false
  },
  about: {
    type: String,
    default: ''
  },
  achievements: [String],
  bannerImage: {
    type: String,
    default: '/images/default-banner.jpg'
  },
  aadharCard: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  age: {
    type: Number,
    default: 0
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  proofPhoto: {
    type: String,
    default: ''
  },
  completedLearning: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Artist', ArtistSchema);