const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    comment: 'Duration value'
  },
  durationUnit: {
    type: String,
    required: true,
    enum: ['seconds', 'minutes', 'hours', 'days'],
    default: 'days',
    comment: 'Unit of duration (seconds, minutes, hours, days)'
  },
  benefits: {
    type: String,
    required: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    comment: 'Discount percentage for ticket purchases'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
