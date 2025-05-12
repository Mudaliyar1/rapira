/**
 * Render Persistent Storage Utility
 * Uses Render's built-in persistent directory at /mnt/data
 * No YAML configuration or disk setup required
 */

const path = require('path');
const fs = require('fs');

// Render's built-in persistent directory
const RENDER_PERSISTENT_PATH = '/mnt/data';
const UPLOADS_DIR = 'uploads';

/**
 * Get the persistent storage path
 * @returns {string} The persistent storage path
 */
function getPersistentPath() {
  return path.join(RENDER_PERSISTENT_PATH, UPLOADS_DIR);
}

/**
 * Check if persistent storage is available
 * @returns {boolean} True if persistent storage is available
 */
function isPersistentAvailable() {
  try {
    // Check if /mnt/data exists
    if (!fs.existsSync(RENDER_PERSISTENT_PATH)) {
      console.log(`Persistent path ${RENDER_PERSISTENT_PATH} does not exist`);
      return false;
    }
    
    // Try to create the uploads directory if it doesn't exist
    const uploadsPath = getPersistentPath();
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log(`Created persistent uploads directory at ${uploadsPath}`);
    }
    
    // Check if we can write to the directory
    const testFile = path.join(uploadsPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    console.log(`Persistent storage is available at ${uploadsPath}`);
    return true;
  } catch (error) {
    console.error(`Persistent storage not available: ${error.message}`);
    return false;
  }
}

/**
 * Get the full persistent path for a file
 * @param {string} relativePath - The relative path (e.g., 'images/photo.jpg')
 * @returns {string} The full persistent path
 */
function getFullPersistentPath(relativePath) {
  return path.join(getPersistentPath(), relativePath);
}

/**
 * Ensure a directory exists in persistent storage
 * @param {string} dirPath - The directory path relative to the uploads directory
 */
function ensurePersistentDir(dirPath) {
  const fullPath = getFullPersistentPath(dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created persistent directory: ${fullPath}`);
  }
}

/**
 * Save a file to persistent storage
 * @param {string} sourcePath - The source file path
 * @param {string} targetPath - The target path relative to the uploads directory
 * @returns {boolean} True if successful
 */
function saveToPersistent(sourcePath, targetPath) {
  try {
    if (!isPersistentAvailable()) {
      console.log('Persistent storage not available, skipping save');
      return false;
    }
    
    const fullTargetPath = getFullPersistentPath(targetPath);
    
    // Ensure the directory exists
    const targetDir = path.dirname(fullTargetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, fullTargetPath);
    console.log(`Saved file to persistent storage: ${fullTargetPath}`);
    return true;
  } catch (error) {
    console.error(`Error saving to persistent storage: ${error.message}`);
    return false;
  }
}

/**
 * Get a file from persistent storage
 * @param {string} relativePath - The relative path (e.g., 'images/photo.jpg')
 * @returns {Buffer|null} The file contents or null if not found
 */
function getFromPersistent(relativePath) {
  try {
    if (!isPersistentAvailable()) {
      return null;
    }
    
    const fullPath = getFullPersistentPath(relativePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    return fs.readFileSync(fullPath);
  } catch (error) {
    console.error(`Error reading from persistent storage: ${error.message}`);
    return null;
  }
}

/**
 * Check if a file exists in persistent storage
 * @param {string} relativePath - The relative path (e.g., 'images/photo.jpg')
 * @returns {boolean} True if the file exists
 */
function existsInPersistent(relativePath) {
  try {
    if (!isPersistentAvailable()) {
      return false;
    }
    
    const fullPath = getFullPersistentPath(relativePath);
    return fs.existsSync(fullPath);
  } catch (error) {
    console.error(`Error checking persistent storage: ${error.message}`);
    return false;
  }
}

module.exports = {
  getPersistentPath,
  isPersistentAvailable,
  getFullPersistentPath,
  ensurePersistentDir,
  saveToPersistent,
  getFromPersistent,
  existsInPersistent
};
