const mongoose = require('mongoose');

const TeamUpdateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'announcement', 
      'meeting_minutes', 
      'policy_update', 
      'project_update', 
      'general_info',
      'urgent',
      'celebration',
      'training',
      'system_update'
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  category: {
    type: String,
    enum: [
      'company_wide',
      'development',
      'marketing',
      'operations',
      'hr',
      'finance',
      'customer_support',
      'management'
    ],
    default: 'company_wide'
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  targetAudience: {
    type: String,
    enum: ['all_admins', 'super_admins_only', 'specific_roles', 'all_team'],
    default: 'all_admins'
  },
  specificRoles: [{
    type: String,
    enum: ['admin', 'superAdmin', 'developer', 'manager', 'support']
  }],
  isPublished: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Meeting specific fields
  meetingDate: {
    type: Date
  },
  meetingAttendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  actionItems: [{
    task: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Engagement tracking
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },
    readTime: Number // in seconds
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'love', 'helpful', 'important', 'concern'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Comments/Discussion
  allowComments: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for read status
TeamUpdateSchema.virtual('readBy').get(function() {
  return this.views.map(view => view.user);
});

// Virtual for reaction counts
TeamUpdateSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  this.reactions.forEach(reaction => {
    counts[reaction.type] = (counts[reaction.type] || 0) + 1;
  });
  return counts;
});

// Index for better performance
TeamUpdateSchema.index({ type: 1, priority: 1, createdAt: -1 });
TeamUpdateSchema.index({ category: 1, isPublished: 1 });
TeamUpdateSchema.index({ isPinned: 1, createdAt: -1 });
TeamUpdateSchema.index({ expiresAt: 1 });
TeamUpdateSchema.index({ 'views.user': 1 });

// Pre-save middleware to handle expiration
TeamUpdateSchema.pre('save', function(next) {
  // Auto-expire urgent announcements after 30 days if no expiry set
  if (this.type === 'urgent' && this.priority === 'urgent' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Static method to get active updates
TeamUpdateSchema.statics.getActiveUpdates = function(filters = {}) {
  const query = {
    isPublished: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ],
    ...filters
  };
  
  return this.find(query)
    .populate('createdBy', 'name email profileImage')
    .populate('updatedBy', 'name email')
    .populate('meetingAttendees', 'name email')
    .populate('actionItems.assignedTo', 'name email')
    .sort({ isPinned: -1, createdAt: -1 });
};

// Instance method to mark as read by user
TeamUpdateSchema.methods.markAsRead = function(userId, readTime = 0) {
  const existingView = this.views.find(view => view.user.toString() === userId.toString());
  
  if (!existingView) {
    this.views.push({
      user: userId,
      viewedAt: new Date(),
      readTime: readTime
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Instance method to add reaction
TeamUpdateSchema.methods.addReaction = function(userId, reactionType) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(reaction => 
    reaction.user.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    type: reactionType
  });
  
  return this.save();
};

module.exports = mongoose.model('TeamUpdate', TeamUpdateSchema);
