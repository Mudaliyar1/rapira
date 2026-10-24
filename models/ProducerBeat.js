const mongoose = require('mongoose');

const producerBeatSchema = new mongoose.Schema({
  producer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  mediaType: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  publicId: {
    type: String // For Cloudinary
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  purchasesCount: {
    type: Number,
    default: 0
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  banReason: {
    type: String
  }
}, { timestamps: true });

// Indexing for quick retrieval
producerBeatSchema.index({ producer: 1, createdAt: -1 });
producerBeatSchema.index({ isActive: 1, isBanned: 1 });

module.exports = mongoose.model('ProducerBeat', producerBeatSchema);
