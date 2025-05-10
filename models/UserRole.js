const mongoose = require('mongoose');

const UserRoleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  }
}, { timestamps: true });

// Create a compound index to ensure a user can have a specific role only once
UserRoleSchema.index({ user: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('UserRole', UserRoleSchema);
