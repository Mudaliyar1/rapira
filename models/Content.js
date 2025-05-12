
const mongoose = require('mongoose');
const { getFileUrl } = require('../utils/fileHelper');

const ContentSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['song', 'video', 'lyrics'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: '/images/default-thumbnail.jpg'
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  likes: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Virtual properties for full URLs
ContentSchema.virtual('fullFileUrl').get(function() {
  return getFileUrl(this.fileUrl);
});

ContentSchema.virtual('fullThumbnailUrl').get(function() {
  return getFileUrl(this.thumbnailUrl);
});

// Set toJSON and toObject options to include virtuals
ContentSchema.set('toJSON', { virtuals: true });
ContentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Content', ContentSchema);
