const mongoose = require('mongoose');

const ConcertSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  // Keep city for backward compatibility and easier filtering
  city: {
    type: String,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0
  },
  posterImage: {
    type: String,
    default: '/images/default-concert.jpg'
  },
  posterMedia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  maxTickets: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  ticketsSold: {
    type: Number,
    default: 0
  },
  venueBooking: {
    bookingHours: {
      type: Number,
      min: 1,
      default: 1
    },
    // Keep legacy hourlyRate for backward compatibility
    hourlyRate: {
      type: Number,
      min: 0,
      default: 0
    },
    totalVenueCost: {
      type: Number,
      min: 0,
      default: 0
    },
    amountPaidByArtist: {
      type: Number,
      min: 0,
      default: 0
    },
    adminCommission: {
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      advanceAmount: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paymentDate: {
      type: Date
    },
    paymentId: {
      type: String // Razorpay payment ID
    },
    orderId: {
      type: String // Razorpay order ID
    },
    paidAt: {
      type: Date // Timestamp when payment was completed
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Concert', ConcertSchema);