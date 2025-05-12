
const mongoose = require('mongoose');

const FeaturedArtistSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  customDescription: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Create a unique index on artist to prevent duplicates
FeaturedArtistSchema.index({ artist: 1 }, { unique: true });

module.exports = mongoose.model('FeaturedArtist', FeaturedArtistSchema);
