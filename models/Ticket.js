const mongoose = require('mongoose');

const AttendeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  }
});

const TicketSchema = new mongoose.Schema({
  concert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Concert',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [AttendeeSchema],
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  totalAmount: {
    type: Number,
    required: true
  },
  originalAmount: {
    type: Number
  },
  discountApplied: {
    type: Boolean,
    default: false
  },
  discountPercentage: {
    type: Number,
    default: 0
  },
  discountType: {
    type: String,
    enum: ['none', 'subscription', 'promo', 'other'],
    default: 'none'
  },
  commissionApplied: {
    type: Boolean,
    default: false
  },
  commissionPercentage: {
    type: Number,
    default: 0
  },
  commissionAmount: {
    type: Number,
    default: 0
  },
  paymentId: {
    type: String,
    default: ''
  },
  orderId: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  ticketNumber: {
    type: String,
    unique: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  // Add attended fields for ticket validation
  attended: {
    type: Boolean,
    default: false
  },
  attendedAt: {
    type: Date
  },
  validatedTicketsCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Generate unique ticket number before saving
TicketSchema.pre('save', async function(next) {
  if (!this.ticketNumber) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.ticketNumber = `RPR-${dateStr}-${randomNum}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);