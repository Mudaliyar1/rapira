/**
 * Persistent Storage Utility
 * Manages file paths for persistent storage on Render
 */

const path = require('path');
const fs = require('fs');

// Default persistent storage path for Render
const DEFAULT_PERSISTENT_PATH = '/opt/render/project/src/persistent-storage';

/**
 * Get the persistent storage path from environment variables or use default
 * @returns {string} The persistent storage path
 */
function getPersistentStoragePath() {
  return process.env.PERSISTENT_STORAGE_PATH || DEFAULT_PERSISTENT_PATH;
}

/**
 * Check if persistent storage is enabled and available
 * @returns {boolean} True if persistent storage is available
 */
function isPersistentStorageAvailable() {
  const persistentPath = getPersistentStoragePath();
  
  // In development mode, we might not have the persistent storage path
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  
  try {
    // Check if the directory exists
    if (!fs.existsSync(persistentPath)) {
      // Try to create it if it doesn't exist
      fs.mkdirSync(persistentPath, { recursive: true });
    }
    
    // Check if we can write to the directory
    const testFile = path.join(persistentPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return true;
  } catch (error) {
    console.error(`Persistent storage not available: ${error.message}`);
    return false;
  }
}

/**
 * Get the persistent path for a file
 * @param {string} relativePath - The relative path (e.g., /uploads/content/file.mp3)
 * @returns {string} The persistent storage path
 */
function getPersistentPath(relativePath) {
  // Remove leading slash if present
  const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  
  // Join with the persistent storage path
  return path.join(getPersistentStoragePath(), cleanPath);
}

/**
 * Get the persistent URL for a file
 * @param {string} relativePath - The relative path (e.g., /uploads/content/file.mp3)
 * @returns {string} The URL to access the file
 */
function getPersistentUrl(relativePath) {
  // Make sure the path starts with a slash
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }
  
  // For persistent storage, we'll use a special prefix
  return `/persistent${relativePath}`;
}

/**
 * Ensure a directory exists in persistent storage
 * @param {string} directory - The directory path relative to the persistent storage root
 */
function ensurePersistentDirectory(directory) {
  if (!isPersistentStorageAvailable()) {
    return;
  }
  
  const dirPath = getPersistentPath(directory);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created persistent directory: ${dirPath}`);
  }
}

module.exports = {
  getPersistentStoragePath,
  isPersistentStorageAvailable,
  getPersistentPath,
  getPersistentUrl,
  ensurePersistentDirectory
};
