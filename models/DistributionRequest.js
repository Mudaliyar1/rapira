const mongoose = require('mongoose');

const DistributionRequestSchema = new mongoose.Schema({
    receiptNumber: {
        type: String,
        unique: true
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    distributor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    package: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DistributionPackage',
        required: true
    },
    contentTitle: {
        type: String, // e.g., My New Hit Song
        required: true
    },
    primaryArtist: String,
    featuredArtists: String,
    genre: String,
    releaseDate: Date,
    language: {
        type: String,
        default: 'English'
    },
    explicitContent: {
        type: Boolean,
        default: false
    },
    recordLabel: String,
    copyrightYear: Number,
    copyrightOwner: String,
    contentType: {
        type: String,
        enum: ['audio', 'video', 'mixed'],
        default: 'mixed'
    },
    fileUrl: {
        type: String, // Legacy support
    },
    files: [{
        fileUrl: String,
        title: String,
        fileType: { type: String, enum: ['audio', 'video'] },
        fileMedia: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
        originalName: String
    }],
    fileMedia: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },
    posterUrl: String,
    posterMedia: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'rejected'],
        default: 'pending'
    },
    adminNotes: String, // from distributor
    price: {
        type: Number,
        required: true
    },
    commissionAmount: {
        type: Number,
        default: 0
    },
    totalPaid: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed', 'n/a', 'free'],
        default: 'pending'
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    deletedByArtist: {
        type: Boolean,
        default: false
    },
    deletedByDistributor: {
        type: Boolean,
        default: false
    },
    deletedByAdmin: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DistributionRequest', DistributionRequestSchema);
