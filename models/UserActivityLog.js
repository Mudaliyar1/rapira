const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  activityType: {
    type: String,
    required: true,
    enum: [
      'profile_update',
      'password_change',
      'email_change',
      'name_change',
      'phone_change',
      'city_change',
      'bio_change',
      'profile_image_change',
      'account_created',
      'account_deleted',
      'account_reactivated',
      'role_change',
      'subscription_purchase',
      'subscription_cancel',
      'concert_created',
      'concert_cancelled',
      'ticket_purchased',
      'ticket_refunded',
      'artist_application',
      'venue_request',
      'login',
      'logout',
      'failed_login',
      'other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  oldValue: {
    type: String,
    default: null
  },
  newValue: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null if done by user themselves, otherwise admin who made the change
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for faster queries
userActivityLogSchema.index({ user: 1, createdAt: -1 });
userActivityLogSchema.index({ activityType: 1, createdAt: -1 });

// Static method to log activity
userActivityLogSchema.statics.logActivity = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging user activity:', error);
    return null;
  }
};

// Static method to get user's activity history
userActivityLogSchema.statics.getUserHistory = async function(userId, limit = 50) {
  try {
    return await this.find({ user: userId })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('Error fetching user history:', error);
    return [];
  }
};

// Static method to get activity by type
userActivityLogSchema.statics.getUserActivityByType = async function(userId, activityType, limit = 20) {
  try {
    return await this.find({ user: userId, activityType })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('Error fetching user activity by type:', error);
    return [];
  }
};

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);
