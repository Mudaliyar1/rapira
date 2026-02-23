// NEW Media model for Cloudinary-backed uploads
const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  public_id: { type: String, required: true, unique: true },
  secure_url: { type: String, required: true },
  url: { type: String },
  resource_type: { type: String, enum: ['image', 'video', 'raw'], default: 'image' },
  format: { type: String },
  bytes: { type: Number },
  width: { type: Number },
  height: { type: Number },
  duration: { type: Number },
  folder: { type: String },
  original_filename: { type: String },
  module: { type: String }, // artistContent, venueMedia, adminMedia, userProfile, etc.
  ownerType: { type: String, enum: ['artist', 'venue', 'user', 'admin', 'system', 'producer'], default: 'system' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, refPath: 'ownerType' },
  createdAt: { type: Date, default: Date.now }
});

MediaSchema.index({ module: 1, ownerType: 1, ownerId: 1 });

module.exports = mongoose.model('Media', MediaSchema);