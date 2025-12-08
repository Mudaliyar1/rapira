const mongoose = require('mongoose');

const DeletedAccountSchema = new mongoose.Schema({
  // Original user data
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'artist', 'admin'],
    default: 'user'
  },
  profileImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  socialLinks: {
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    youtube: { type: String, default: '' },
    spotify: { type: String, default: '' }
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  
  // Deletion metadata
  deletedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  deletedBy: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  deletionReason: {
    type: String,
    default: 'User requested account deletion'
  },
  
  // Artist info if applicable
  artistData: {
    stageName: String,
    genre: String,
    yearsActive: Number,
    about: String,
    followers: Number
  },
  
  // Stats
  createdAt: {
    type: Date,
    default: Date.now
  },
  totalTicketsPurchased: Number,
  totalConcerts: Number
}, { timestamps: true });

module.exports = mongoose.model('DeletedAccount', DeletedAccountSchema);
