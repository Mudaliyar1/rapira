const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    required: true,
    trim: true
  },
  bio: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: '/images/default-profile.jpg'
  },
  socialLinks: {
    linkedin: {
      type: String,
      trim: true
    },
    twitter: {
      type: String,
      trim: true
    },
    instagram: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for ordering
teamMemberSchema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
