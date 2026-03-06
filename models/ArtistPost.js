const mongoose = require('mongoose');

const artistPostSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true,
    index: true
  },
  media: {
    url: String,
    mediaType: String, // 'image', 'video', or 'audio'
    publicId: String // For Cloudinary deletion
  },
  caption: String,
  hashtags: [String],
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  likesCount: {
    type: Number,
    default: 0
  },
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      createdAt: { type: Date, default: Date.now },
      isHidden: { type: Boolean, default: false },
      isPinned: { type: Boolean, default: false },
      replies: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          text: String,
          createdAt: { type: Date, default: Date.now }
        }
      ]
    }
  ],
  reports: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  shares: {
    type: Number,
    default: 0
  },
  // Add views field
  views: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false // Admin approval required
  },
  approvedBy: mongoose.Schema.Types.ObjectId,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for efficient queries
artistPostSchema.index({ artist: 1, createdAt: -1 });
artistPostSchema.index({ isApproved: 1, isActive: 1 });

module.exports = mongoose.model('ArtistPost', artistPostSchema);