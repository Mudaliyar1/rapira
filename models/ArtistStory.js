const mongoose = require('mongoose');

const ArtistStorySchema = new mongoose.Schema({
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  mediaUrl: { type: String, required: true },
  mediaPublicId: { type: String },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  caption: { type: String, default: '' },
  durationMs: { type: Number, default: 5000 },
  thumbnailUrl: { type: String },
  isActive: { type: Boolean, default: true },
  viewsCount: { type: Number, default: 0 },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

ArtistStorySchema.index({ expiresAt: 1 });
ArtistStorySchema.index({ artist: 1, isActive: 1 });

module.exports = mongoose.model('ArtistStory', ArtistStorySchema);
