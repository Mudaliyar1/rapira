const mongoose = require('mongoose');

const TeamCommentSchema = new mongoose.Schema({
  update: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamUpdate',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamComment',
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'helpful', 'agree', 'disagree'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reply count
TeamCommentSchema.virtual('replyCount', {
  ref: 'TeamComment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true,
  match: { isDeleted: false }
});

// Virtual for reaction counts
TeamCommentSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  this.reactions.forEach(reaction => {
    counts[reaction.type] = (counts[reaction.type] || 0) + 1;
  });
  return counts;
});

// Index for better performance
TeamCommentSchema.index({ update: 1, createdAt: 1 });
TeamCommentSchema.index({ parentComment: 1, createdAt: 1 });
TeamCommentSchema.index({ author: 1, createdAt: -1 });
TeamCommentSchema.index({ isDeleted: 1 });

// Static method to get comments for an update
TeamCommentSchema.statics.getCommentsForUpdate = function(updateId, includeReplies = true) {
  const query = includeReplies 
    ? { update: updateId, isDeleted: false }
    : { update: updateId, parentComment: null, isDeleted: false };
    
  return this.find(query)
    .populate('author', 'name email profileImage role')
    .populate('mentions', 'name email')
    .populate({
      path: 'parentComment',
      populate: {
        path: 'author',
        select: 'name email profileImage'
      }
    })
    .sort({ createdAt: 1 });
};

// Instance method to add reaction
TeamCommentSchema.methods.addReaction = function(userId, reactionType) {
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

// Instance method to soft delete
TeamCommentSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Pre-save middleware to handle mentions and edits
TeamCommentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  
  // Extract mentions from content (@username)
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(this.content)) !== null) {
    mentions.push(match[1]);
  }
  
  // You would need to resolve usernames to user IDs here
  // For now, we'll leave mentions empty and handle it in the route
  
  next();
});

module.exports = mongoose.model('TeamComment', TeamCommentSchema);
