const mongoose = require('mongoose');

const DistributionPackageSchema = new mongoose.Schema({
    distributor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true // e.g., Basic Spotify Distribution
    },
    platforms: {
        type: [String],
        required: true // e.g., Spotify, Apple Music
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    features: [String],
    description: String,
    packageType: {
        type: String,
        enum: ['audio', 'video', 'mixed'],
        default: 'mixed'
    },
    maxAudioFiles: {
        type: Number,
        default: 1,
        min: 0
    },
    maxVideoFiles: {
        type: Number,
        default: 1,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DistributionPackage', DistributionPackageSchema);
