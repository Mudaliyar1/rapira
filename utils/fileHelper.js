/**
 * File Helper Utility
 * Provides functions for handling file paths and URLs in both development and production environments
 */

const path = require('path');
const fs = require('fs');

/**
 * Get the full URL for a file path
 * In production, this prepends the BASE_URL to ensure absolute URLs
 * In development, it returns the relative path
 * 
 * @param {string} filePath - The relative file path (e.g., /uploads/content/file.pdf)
 * @returns {string} The full URL to the file
 */
function getFileUrl(filePath) {
  // If the path is already an absolute URL, return it as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  // For production environment, prepend the BASE_URL
  if (process.env.NODE_ENV === 'production' && process.env.BASE_URL) {
    // Remove any leading slash to avoid double slashes
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    return `${process.env.BASE_URL}/${cleanPath}`;
  }

  // For development, return the path as is
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
