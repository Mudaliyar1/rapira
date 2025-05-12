const mongoose = require('mongoose');

const AdminPagePermissionSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Store page permissions as an object with page slugs as keys and boolean values
  pagePermissions: {
    type: Map,
    of: Boolean,
    default: {}
  },
  // Store the last user who modified these permissions
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Create a unique index on admin to ensure one permission document per admin
AdminPagePermissionSchema.index({ admin: 1 }, { unique: true });

module.exports = mongoose.model('AdminPagePermission', AdminPagePermissionSchema);