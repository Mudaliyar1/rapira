/**
 * File Helper Utility
 * Provides functions for handling file paths and URLs in both development and production environments
 */

const path = require('path');
const fs = require('fs');

/**
 * Get the full URL for a file path
 * Ensures files are properly served in both development and production
 *
 * @param {string} filePath - The relative file path (e.g., /uploads/content/file.pdf)
 * @returns {string} The full URL to the file
 */
function getFileUrl(filePath) {
  // If the path is already an absolute URL, return it as is
  if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
    return filePath;
  }

  // If the path is empty or undefined, return a default
  if (!filePath) {
    return '/images/default-thumbnail.jpg';
  }

  // Make sure the path starts with a slash for proper URL resolution
  if (!filePath.startsWith('/')) {
    filePath = '/' + filePath;
  }

  return filePath;
}

/**
 * Ensure upload directories exist
 * Creates all necessary upload directories if they don't exist
 */
function ensureUploadDirectories() {
  const directories = [
    'public/uploads',
    'public/uploads/content',
    'public/uploads/thumbnails',
    'public/uploads/profiles',
    'public/uploads/banners',
    'public/uploads/concerts',
    'public/uploads/proofs',
    'public/uploads/learning',
    'public/uploads/misc'
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Store a file path in the database
 * Ensures consistent format for storing file paths
 *
 * @param {string} uploadDir - The upload directory (e.g., 'content', 'thumbnails')
 * @param {string} filename - The filename
 * @returns {string} The relative path to store in the database
 */
function getStoragePath(uploadDir, filename) {
  return `/uploads/${uploadDir}/${filename}`;
}

module.exports = {
  getFileUrl,
  ensureUploadDirectories,
  getStoragePath
};
