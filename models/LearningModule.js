const mongoose = require('mongoose');

const ContentItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['video', 'text', 'pdf', 'link', 'image'],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false });

const LearningModuleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  contentItems: [ContentItemSchema],
  // Keep contentType for backward compatibility (first item's type)
  contentType: {
    type: String,
    enum: ['video', 'text', 'pdf', 'link', 'image'],
    default: 'text'
  },
  // Keep content for backward compatibility (first item's content)
  content: {
    type: String
  },
  thumbnailImage: {
    type: String,
    default: '/images/default-learning.jpg'
  },
  thumbnailMedia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  },
  forArtistLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Established', 'All'],
    default: 'Beginner'
  },
  order: {
    type: Number,
    default: 0
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('LearningModule', LearningModuleSchema);