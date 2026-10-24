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
    publicId: String, // For Cloudinary deletion
    thumbnailUrl: String,
    thumbnailPublicId: String
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
  fakeViewsLabel: {
    type: String,
    default: ''
  },
  fakeLikesLabel: {
    type: String,
    default: ''
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

async function removeViewIncreaserMappingForPost(postId) {
  if (!postId) return;

  try {
    const WebsiteSettings = mongoose.model('WebsiteSettings');
    await WebsiteSettings.updateOne(
      {},
      {
        $pull: {
          'viewIncreaser.entries': { postId }
        }
      }
    );
  } catch (error) {
    // Non-blocking cleanup: post deletion should still succeed.
    console.error('Failed to cleanup view increaser mapping for deleted post:', error.message);
  }
}

artistPostSchema.post('findOneAndDelete', async function (doc) {
  if (!doc || !doc._id) return;
  await removeViewIncreaserMappingForPost(doc._id);
});

artistPostSchema.post('findOneAndRemove', async function (doc) {
  if (!doc || !doc._id) return;
  await removeViewIncreaserMappingForPost(doc._id);
});

module.exports = mongoose.model('ArtistPost', artistPostSchema);