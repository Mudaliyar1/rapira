/**
 * File Helper Utility
 * Provides functions for handling file paths and URLs in both development and production environments
 * Supports persistent storage on Render
 */

const path = require('path');
const fs = require('fs');
const {
  isPersistentStorageAvailable,
  getPersistentPath,
  getPersistentUrl,
  ensurePersistentDirectory
} = require('./persistentStorage');

/**
 * Get the full URL for a file path
 * Ensures files are properly served in both development and production
 * Supports persistent storage paths in production
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

  // If persistent storage is available and this is an upload path, use the persistent URL
  if (isPersistentStorageAvailable() && filePath.includes('/uploads/')) {
    return getPersistentUrl(filePath);
  }

  return filePath;
}

/**
 * Ensure upload directories exist
 * Creates all necessary upload directories if they don't exist
 * Also creates directories in persistent storage if available
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

  // Create directories in the standard location
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // If persistent storage is available, create directories there too
  if (isPersistentStorageAvailable()) {
    console.log('Creating directories in persistent storage...');

    // Create the same directories in persistent storage
    directories.forEach(dir => {
      // Extract the uploads part of the path
      const uploadPath = dir.replace('public/', '');
      ensurePersistentDirectory(uploadPath);
    });
  }
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

/**
 * Get the physical file path for a given URL path
 * Handles both standard and persistent storage paths
 *
 * @param {string} urlPath - The URL path (e.g., /uploads/content/file.pdf)
 * @returns {string} The physical file path
 */
function getPhysicalFilePath(urlPath) {
  // Clean up the path
  const cleanPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;

  // If persistent storage is available and this is an upload path, check there first
  if (isPersistentStorageAvailable() && cleanPath.startsWith('uploads/')) {
    const persistentPath = getPersistentPath(cleanPath);

    // If the file exists in persistent storage, return that path
    if (fs.existsSync(persistentPath)) {
      return persistentPath;
    }
  }

  // Otherwise, return the standard path
  return path.join(process.cwd(), 'public', cleanPath);
}

/**
 * Save a file to both standard and persistent storage if available
 *
 * @param {string} sourcePath - The source file path
 * @param {string} targetDir - The target directory (e.g., 'uploads/content')
 * @param {string} filename - The filename
 * @returns {string} The relative path to store in the database
 */
function saveFileToPersistentStorage(sourcePath, targetDir, filename) {
  // Save to standard location
  const standardPath = path.join(process.cwd(), 'public', targetDir, filename);

  // Ensure the directory exists
  const standardDir = path.dirname(standardPath);
  if (!fs.existsSync(standardDir)) {
    fs.mkdirSync(standardDir, { recursive: true });
  }

  // Copy the file to the standard location
  fs.copyFileSync(sourcePath, standardPath);

  // If persistent storage is available, save there too
  if (isPersistentStorageAvailable()) {
    const persistentPath = getPersistentPath(path.join(targetDir, filename));

    // Ensure the directory exists
    const persistentDir = path.dirname(persistentPath);
    if (!fs.existsSync(persistentDir)) {
      fs.mkdirSync(persistentDir, { recursive: true });
    }

    // Copy the file to persistent storage
    fs.copyFileSync(sourcePath, persistentPath);
  }

  // Return the relative path to store in the database
  return `/${targetDir}/${filename}`;
}

module.exports = {
  getFileUrl,
  ensureUploadDirectories,
  getStoragePath,
  getPhysicalFilePath,
  saveFileToPersistentStorage
};
