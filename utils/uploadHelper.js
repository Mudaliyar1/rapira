/**
 * Upload Helper Utility
 * Provides functions for handling file uploads with persistent storage
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Base directory for all uploads
const UPLOADS_BASE_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * Ensure all upload directories exist
 */
function ensureUploadDirectories() {
  const directories = [
    UPLOADS_BASE_DIR,
    path.join(UPLOADS_BASE_DIR, 'profiles'),
    path.join(UPLOADS_BASE_DIR, 'concerts'),
    path.join(UPLOADS_BASE_DIR, 'thumbnails'),
    path.join(UPLOADS_BASE_DIR, 'content'),
    path.join(UPLOADS_BASE_DIR, 'banners'),
    path.join(UPLOADS_BASE_DIR, 'proofs'),
    path.join(UPLOADS_BASE_DIR, 'learning'),
    path.join(UPLOADS_BASE_DIR, 'misc'),
    path.join(UPLOADS_BASE_DIR, 'test')
  ];

  // Create directories if they don't exist
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Create a multer storage configuration for a specific upload type
 * @param {string} uploadType - The type of upload (e.g., 'profiles', 'concerts')
 * @param {Function} filenameGenerator - Optional function to generate filenames
 * @returns {multer.StorageEngine} Configured multer storage
 */
function createStorage(uploadType, filenameGenerator = null) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(UPLOADS_BASE_DIR, uploadType);

      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      if (filenameGenerator) {
        cb(null, filenameGenerator(file));
      } else {
        // Default filename generator
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${uploadType}-${uniqueSuffix}${ext}`);
      }
    }
  });
}

/**
 * Create a multer upload middleware for a specific upload type
 * @param {Object} options - Upload options
 * @param {string} options.uploadType - The type of upload (e.g., 'profiles', 'concerts')
 * @param {Function} options.filenameGenerator - Optional function to generate filenames
 * @param {number} options.fileSize - Max file size in bytes
 * @param {Function} options.fileFilter - Function to filter files
 * @returns {multer.Multer} Configured multer middleware
 */
function createUpload(options) {
  const {
    uploadType = 'misc',
    filenameGenerator = null,
    fileSize = 5 * 1024 * 1024, // 5MB default
    fileFilter = null
  } = options;

  const storage = createStorage(uploadType, filenameGenerator);

  const uploadConfig = {
    storage,
    limits: { fileSize }
  };

  if (fileFilter) {
    uploadConfig.fileFilter = fileFilter;
  }

  return multer(uploadConfig);
}

/**
 * Get the relative path for storing in the database
 * @param {string} uploadType - The type of upload (e.g., 'profiles', 'concerts')
 * @param {string} filename - The filename
 * @returns {string} The relative path to store in the database
 */
function getStoragePath(uploadType, filename) {
  return `/uploads/${uploadType}/${filename}`;
}

/**
 * Get the URL for an image, with fallback to production URL if file doesn't exist locally
 * @param {string} imagePath - The image path (e.g., /uploads/profiles/profile-123.jpg)
 * @param {string} defaultImage - The default image to use if the file doesn't exist
 * @param {string} productionUrl - The production URL (optional)
 * @returns {string} The URL to use for the image
 */
function getImageUrl(imagePath, defaultImage, productionUrl = process.env.PRODUCTION_URL) {
  // If the path is already a full URL or is null/undefined, return it as is
  if (!imagePath || imagePath.startsWith('http')) {
    return imagePath || defaultImage;
  }

  // If it's a YouTube thumbnail, return it as is
  if (imagePath.includes('img.youtube.com')) {
    return imagePath;
  }

  // Check if the file exists locally
  const localPath = path.join(process.cwd(), 'public', imagePath);
  if (fs.existsSync(localPath)) {
    return imagePath;
  }

  // If we're in development and have a production URL, try to use the production URL
  if (process.env.NODE_ENV !== 'production' && productionUrl) {
    // Remove any trailing slash from the production URL
    const baseUrl = productionUrl.endsWith('/') ? productionUrl.slice(0, -1) : productionUrl;
    return `${baseUrl}${imagePath}`;
  }

  // If all else fails, return the default image
  return defaultImage;
}

/**
 * Delete a file if it exists
 * @param {string} filePath - The file path to delete
 * @returns {boolean} True if the file was deleted, false otherwise
 */
function deleteFileIfExists(filePath) {
  try {
    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const fullPath = path.join(process.cwd(), 'public', cleanPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`Deleted file: ${fullPath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
    return false;
  }
}

module.exports = {
  ensureUploadDirectories,
  createUpload,
  getStoragePath,
  deleteFileIfExists,
  getImageUrl
};
