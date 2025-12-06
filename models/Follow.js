const mongoose = require('mongoose');

const FollowSchema = new mongoose.Schema({
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  followingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roleOfFollower: {
    type: String,
    enum: ['user', 'artist'],
    required: true
  },
  roleOfFollowing: {
    type: String,
    enum: ['artist'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index to prevent duplicate follows
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Add indexes for efficient queries
FollowSchema.index({ followingId: 1, roleOfFollower: 1 });
FollowSchema.index({ followerId: 1, roleOfFollower: 1 });

const Follow = mongoose.model('Follow', FollowSchema);

module.exports = Follow;