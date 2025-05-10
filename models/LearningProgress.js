const mongoose = require('mongoose');

const LearningProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningModule',
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  }
}, { timestamps: true });

// Create a compound index to ensure a user can have progress for a specific module only once
LearningProgressSchema.index({ user: 1, module: 1 }, { unique: true });

module.exports = mongoose.model('LearningProgress', LearningProgressSchema);
