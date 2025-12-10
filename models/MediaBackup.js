const mongoose = require('mongoose');

/**
 * MediaBackup Schema
 * 
 * Stores binary data of all uploaded media (images, videos, audio, PDFs, etc.)
 * for persistence across server restarts on ephemeral filesystems (e.g., Render).
 * 
 * This is a global backup for:
 * - Artist content (music, images, videos)
 * - Venue media (images, documents)
 * - Admin content (banners, page images)
 * - User profiles (avatar images)
 * - Learning modules (course materials)
 * - Any other file uploaded across the site
 */
const mediaBackupSchema = new mongoose.Schema({
  // Original filename with extension (e.g., "artist_123_song.mp3")
  fileName: {
    type: String,
    required: true,
    trim: true
  },

  // Relative path within /uploads directory structure
  // e.g., "artist/123/song.mp3", "venue/venue-abc/image.jpg", "admin/banners/banner-1.png"
  filePath: {
    type: String,
    required: true,
    trim: true,
    unique: true, // Prevent duplicate file paths
    index: true
  },

  // Module/feature that generated this upload
  // Values: "artistContent", "venueMedia", "adminMedia", "userProfile", "learningModule", "merchandise", etc.
  module: {
    type: String,
    required: true,
    enum: [
      'artistContent',
      'venueMedia',
      'adminMedia',
      'userProfile',
      'learningModule',
      'merchandise',
      'order',
      'productReview',
      'teamUpdate',
      'other'
    ],
    index: true
  },

  // Type of owner/uploader
  // Values: "artist", "venue", "admin", "user", "system"
  ownerType: {
    type: String,
    enum: ['artist', 'venue', 'admin', 'user', 'system'],
    index: true
  },

  // Reference to the owner document (User, Venue, Artist, etc.)
  // Schema depends on ownerType
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },

  // MIME type of the file (e.g., "image/jpeg", "video/mp4", "audio/mpeg")
  mimeType: {
    type: String,
    required: true,
    trim: true
  },

  // File category for easier querying and filtering
  // Values: "image", "video", "audio", "pdf", "document", "other"
  fileType: {
    type: String,
    required: true,
    enum: ['image', 'video', 'audio', 'pdf', 'document', 'other'],
    index: true
  },

  // File size in bytes
  size: {
    type: Number,
    default: 0
  },

  // Binary data buffer of the actual file
  // This is the core backup - stores the complete file content
  data: {
    type: Buffer,
    required: true
  },

  // Timestamp when file was backed up to MongoDB
  uploadedOn: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Soft delete flag for optional retention policies
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  // Metadata for tracking restore status
  lastRestoredOn: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt, updatedAt
});

// Index for common queries
mediaBackupSchema.index({ module: 1, fileType: 1 });
mediaBackupSchema.index({ ownerType: 1, ownerId: 1 });
mediaBackupSchema.index({ uploadedOn: -1 }); // Recent uploads first
mediaBackupSchema.index({ isDeleted: 1, filePath: 1 }); // For cleanup queries

// Virtual for formatted file size (KB/MB)
mediaBackupSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Method to detect file type from MIME type
mediaBackupSchema.statics.detectFileType = function(mimeType) {
  if (!mimeType) return 'other';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('spreadsheet')) {
    return 'document';
  }
  
  return 'other';
};

// Method to get file extension from MIME type
mediaBackupSchema.statics.getExtensionFromMimeType = function(mimeType) {
  const mimeExtMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
  };
  
  return mimeExtMap[mimeType] || 'bin';
};

module.exports = mongoose.model('MediaBackup', mediaBackupSchema);
