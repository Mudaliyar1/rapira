const mongoose = require('mongoose');

const AdminPageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  path: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'bi-file'
  },
  category: {
    type: String,
    enum: ['dashboard', 'user_management', 'content_management', 'booking_management', 'system'],
    default: 'system'
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Some pages should always be accessible to all admins (like dashboard)
  alwaysAccessible: {
    type: Boolean,
    default: false
  },
  // Some pages should only be accessible to super admins
  superAdminOnly: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminPage', AdminPageSchema);
