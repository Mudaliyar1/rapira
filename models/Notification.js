const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  module: {
    type: String,
    required: true,
    enum: [
      'Artist Application',
      'Artist Upgrade',
      'Team Booking',
      'Role Slot',
      'Artist Booking',
      'Concert',
      'Daily Concert',
      'Learning Module',
      'Refund Request'
    ]
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'modelRef'
  },
  modelRef: {
    type: String,
    required: true,
    enum: [
      'ArtistApplication',
      'ArtistUpgradeRequest',
      'TeamBookingRequest',
      'ArtistRoleSlot',
      'ArtistBookingRequest',
      'Concert',
      'DailyConcert',
      'LearningModule',
      'RefundRequest'
    ]
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Reviewed'],
    default: 'Pending'
  },
  link: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Create indexes for better query performance
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);