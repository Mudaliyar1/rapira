const mongoose = require('mongoose');

const ConcertEditRequestSchema = new mongoose.Schema({
  concert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Concert',
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  requestedChanges: {
    title: String,
    description: String,
    date: Date,
    time: String,
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue'
    },
    city: String,
    price: Number,
    maxTickets: Number,
    posterImage: String
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminResponse: {
    message: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  requestedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for efficient queries
ConcertEditRequestSchema.index({ concert: 1, status: 1 });
ConcertEditRequestSchema.index({ artist: 1, status: 1 });
ConcertEditRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('ConcertEditRequest', ConcertEditRequestSchema);
