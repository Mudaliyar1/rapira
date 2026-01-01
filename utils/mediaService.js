// NEW Central media service to manage Cloudinary uploads and Media documents
const path = require('path');
const { uploadFromBuffer, destroy: destroyCloud } = require('./cloudinary');
const Media = require('../models/Media');

const RESOURCE_IMAGE = 'image';
const RESOURCE_VIDEO = 'video';
const RESOURCE_RAW = 'raw';

function detectResourceType(mimetype = '') {
  if (mimetype.startsWith('image/')) return RESOURCE_IMAGE;
  if (mimetype.startsWith('video/')) return RESOURCE_VIDEO;
  if (mimetype.startsWith('audio/')) return RESOURCE_VIDEO; // audio treated as video for streaming
  return RESOURCE_RAW;
}

/**
 * Upload a single multer file (memory storage) to Cloudinary and persist Media doc.
 * @param {Object} file - Multer file with buffer
 * @param {Object} options - { module, ownerType, ownerId, folder, transformations }
 */
async function uploadFileToCloudinary(file, options = {}) {
  if (!file || !file.buffer) throw new Error('uploadFileToCloudinary: file buffer is required');

  const resource_type = detectResourceType(file.mimetype);
  const folder = options.folder || `rapira/${options.module || 'misc'}/${options.ownerId || 'anonymous'}`;

  const uploadOptions = {
    folder,
    resource_type,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    transformation: options.transformation || buildDefaultTransformation(resource_type)
  };

  const result = await uploadFromBuffer(file.buffer, uploadOptions);

  const media = await Media.create({
    public_id: result.public_id,
    secure_url: result.secure_url,
    url: result.url,
    resource_type: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration,
    folder: result.folder,
    original_filename: result.original_filename || file.originalname,
    module: options.module,
    ownerType: options.ownerType,
    ownerId: options.ownerId
  });

  return { media, result };
}

function buildDefaultTransformation(resourceType) {
  if (resourceType === RESOURCE_IMAGE) {
    return [{ width: 1280, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }];
  }
  if (resourceType === RESOURCE_VIDEO) {
    return [{ width: 1280, crop: 'limit', quality: 'auto', fetch_format: 'auto' }];
  }
  return undefined;
}

async function deleteMedia(mediaDoc) {
  if (!mediaDoc) return;
  await destroyCloud(mediaDoc.public_id, mediaDoc.resource_type);
  await Media.deleteOne({ _id: mediaDoc._id });
}

/**
 * Resolve a usable URL with local fallback for legacy paths.
 */
function resolveMediaUrl(mediaDoc, legacyPath) {
  if (mediaDoc && mediaDoc.secure_url) return mediaDoc.secure_url;
  if (legacyPath && legacyPath.startsWith('http')) return legacyPath;
  if (legacyPath) return legacyPath; // Serve existing /uploads path as fallback
  return null;
}

module.exports = {
  uploadFileToCloudinary,
  deleteMedia,
  resolveMediaUrl,
  detectResourceType,
  buildDefaultTransformation
};