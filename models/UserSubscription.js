const mongoose = require('mongoose');

const UserSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'cancelled'],
    default: 'pending'
  },
  paymentId: {
    type: String,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Index for faster queries on user and status
UserSubscriptionSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('UserSubscription', UserSubscriptionSchema);
