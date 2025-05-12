
const mongoose = require('mongoose');

const ArtistUpgradeRequestSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate'],
    required: true
  },
  requestedLevel: {
    type: String,
    enum: ['Intermediate', 'Established'],
    required: true
  },
  reason: {
    type: String,
    required: true
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
  completedModules: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningModule'
  }],
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('ArtistUpgradeRequest', ArtistUpgradeRequestSchema);
