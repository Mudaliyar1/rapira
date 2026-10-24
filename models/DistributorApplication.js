const mongoose = require('mongoose');

const DistributorApplicationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    website: String,
    instagramLink: String,
    experience: {
        type: String,
        required: true
    },
    platforms: {
        type: [String],
        required: true // e.g., Spotify, Apple Music, YouTube
    },
    location: {
        type: String,
        required: true
    },
    idProofType: {
        type: String,
        required: true
    },
    idProofUrl: {
        type: String,
        required: true
    },
    idProofMedia: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNotes: String,
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: Date,
    registrationFee: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'n/a'],
        default: 'pending'
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String
}, {
    timestamps: true
});

module.exports = mongoose.model('DistributorApplication', DistributorApplicationSchema);
