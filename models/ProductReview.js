const mongoose = require('mongoose');

const ProductReviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  size: {
    type: String,
    required: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size']
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  moderationNotes: {
    type: String,
    trim: true
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  votedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: {
      type: Boolean,
      required: true
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  images: [{
    type: String
  }],
  adminResponse: {
    message: {
      type: String,
      trim: true
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: {
      type: Date
    }
  }
}, { 
  timestamps: true 
});

// Compound index to ensure one review per user per product per order
ProductReviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });

// Index for efficient queries
ProductReviewSchema.index({ product: 1, isApproved: 1, createdAt: -1 });
ProductReviewSchema.index({ user: 1, createdAt: -1 });
ProductReviewSchema.index({ rating: 1 });
ProductReviewSchema.index({ isApproved: 1 });

// Virtual for calculating helpful percentage
ProductReviewSchema.virtual('helpfulPercentage').get(function() {
  const totalVotes = this.votedBy.length;
  if (totalVotes === 0) return 0;
  return Math.round((this.helpfulVotes / totalVotes) * 100);
});

// Method to add helpful vote
ProductReviewSchema.methods.addHelpfulVote = function(userId, isHelpful) {
  // Check if user has already voted
  const existingVoteIndex = this.votedBy.findIndex(vote => 
    vote.user.toString() === userId.toString()
  );
  
  if (existingVoteIndex > -1) {
    // Update existing vote
    const oldVote = this.votedBy[existingVoteIndex];
    if (oldVote.helpful && !isHelpful) {
      this.helpfulVotes -= 1;
    } else if (!oldVote.helpful && isHelpful) {
      this.helpfulVotes += 1;
    }
    
    this.votedBy[existingVoteIndex].helpful = isHelpful;
    this.votedBy[existingVoteIndex].votedAt = new Date();
  } else {
    // Add new vote
    this.votedBy.push({
      user: userId,
      helpful: isHelpful,
      votedAt: new Date()
    });
    
    if (isHelpful) {
      this.helpfulVotes += 1;
    }
  }
};

// Method to approve review
ProductReviewSchema.methods.approve = function(moderatorId, notes = '') {
  this.isApproved = true;
  this.moderationNotes = notes;
};

// Method to reject review
ProductReviewSchema.methods.reject = function(moderatorId, notes = '') {
  this.isApproved = false;
  this.moderationNotes = notes;
};

// Method to add admin response
ProductReviewSchema.methods.addAdminResponse = function(adminId, message) {
  this.adminResponse = {
    message: message,
    respondedBy: adminId,
    respondedAt: new Date()
  };
};

// Static method to calculate average rating for a product
ProductReviewSchema.statics.calculateProductRating = async function(productId) {
  const result = await this.aggregate([
    {
      $match: {
        product: mongoose.Types.ObjectId(productId),
        isApproved: true
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);
  
  if (result.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }
  
  const data = result[0];
  
  // Calculate rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  data.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });
  
  return {
    averageRating: Math.round(data.averageRating * 10) / 10, // Round to 1 decimal
    totalReviews: data.totalReviews,
    ratingDistribution: distribution
  };
};

// Post-save middleware to update product rating
ProductReviewSchema.post('save', async function() {
  if (this.isApproved) {
    const Product = mongoose.model('Product');
    const ratingData = await this.constructor.calculateProductRating(this.product);
    
    await Product.findByIdAndUpdate(this.product, {
      averageRating: ratingData.averageRating,
      totalReviews: ratingData.totalReviews
    });
  }
});

// Post-remove middleware to update product rating
ProductReviewSchema.post('remove', async function() {
  const Product = mongoose.model('Product');
  const ratingData = await this.constructor.calculateProductRating(this.product);
  
  await Product.findByIdAndUpdate(this.product, {
    averageRating: ratingData.averageRating,
    totalReviews: ratingData.totalReviews
  });
});

module.exports = mongoose.model('ProductReview', ProductReviewSchema);
