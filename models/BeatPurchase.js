const mongoose = require('mongoose');

const beatPurchaseSchema = new mongoose.Schema({
    beat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProducerBeat',
        required: true,
        index: true
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    producer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    platformFee: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmountPaid: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String, // e.g., 'wallet', 'razorpay'
        default: 'wallet'
    },
    transactionId: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    isDeletedByArtist: {
        type: Boolean,
        default: false
    },
    isDeletedByProducer: {
        type: Boolean,
        default: false
    },
    backupTitle: String,
    backupMediaType: String,
    backupMediaUrl: String
}, { timestamps: true });

beatPurchaseSchema.index({ artist: 1, beat: 1 });
beatPurchaseSchema.index({ producer: 1, createdAt: -1 });

module.exports = mongoose.model('BeatPurchase', beatPurchaseSchema);
