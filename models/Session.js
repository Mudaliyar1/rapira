const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: false });

// MongoDB TTL index — automatically deletes expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', SessionSchema);
