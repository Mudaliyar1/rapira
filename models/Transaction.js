const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['ticket', 'product', 'subscription', 'beat', 'registration', 'distribution', 'venue_commission'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFee: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  payee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'refunded', 'failed'],
    default: 'success',
    index: true
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'paid', 'not_applicable'],
    default: 'not_applicable',
    index: true
  },
  sourceModel: {
    type: String,
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

// Index for reporting
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
