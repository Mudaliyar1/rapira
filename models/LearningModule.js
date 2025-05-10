const mongoose = require('mongoose');

const LearningModuleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['video', 'text', 'pdf', 'link'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  thumbnailImage: {
    type: String,
    default: '/images/default-learning.jpg'
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
