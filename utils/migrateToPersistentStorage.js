/**
 * File Migration Utility
 * Migrates files from ephemeral storage to persistent storage
 */

const fs = require('fs');
const path = require('path');
const { 
  isPersistentStorageAvailable, 
  getPersistentPath,
  ensurePersistentDirectory 
} = require('./persistentStorage');

/**
 * Copy a file from source to destination
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 * @returns {Promise<boolean>} True if successful
 */
async function copyFile(source, destination) {
  return new Promise((resolve, reject) => {
    // Create the destination directory if it doesn't exist
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Create read and write streams
    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(destination);
    
    // Handle errors
    readStream.on('error', (err) => {
      reject(err);
    });
    
    writeStream.on('error', (err) => {
      reject(err);
    });
    
    // Handle completion
    writeStream.on('finish', () => {
      resolve(true);
    });
    
    // Copy the file
    readStream.pipe(writeStream);
  });
}

/**
 * Migrate files from a source directory to persistent storage
 * @param {string} sourceDir - Source directory
 * @param {string} targetDir - Target directory in persistent storage
 * @returns {Promise<{copied: number, failed: number, skipped: number}>} Migration statistics
 */
async function migrateDirectory(sourceDir, targetDir) {
  // Skip if persistent storage is not available
  if (!isPersistentStorageAvailable()) {
    console.log('Persistent storage not available, skipping migration');
    return { copied: 0, failed: 0, skipped: 0 };
  }
  
  // Ensure the source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.log(`Source directory does not exist: ${sourceDir}`);
    return { copied: 0, failed: 0, skipped: 0 };
  }
  
  // Ensure the target directory exists in persistent storage
  ensurePersistentDirectory(targetDir);
  
  // Get all files in the source directory
  const files = fs.readdirSync(sourceDir);
  
  let stats = { copied: 0, failed: 0, skipped: 0 };
  
  // Process each file
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = getPersistentPath(path.join(targetDir, file));
    
    // Skip directories (we'll handle them recursively)
    if (fs.statSync(sourcePath).isDirectory()) {
      const subStats = await migrateDirectory(
        sourcePath, 
        path.join(targetDir, file)
      );
      
      // Combine stats
      stats.copied += subStats.copied;
      stats.failed += subStats.failed;
      stats.skipped += subStats.skipped;
      continue;
    }
    
    // Skip if the file already exists in persistent storage and has the same size
    if (fs.existsSync(targetPath)) {
      const sourceSize = fs.statSync(sourcePath).size;
      const targetSize = fs.statSync(targetPath).size;
      
      if (sourceSize === targetSize) {
        stats.skipped++;
        continue;
      }
    }
    
    // Copy the file
    try {
      await copyFile(sourcePath, targetPath);
      stats.copied++;
    } catch (error) {
      console.error(`Failed to copy ${sourcePath} to ${targetPath}: ${error.message}`);
      stats.failed++;
    }
  }
  
  return stats;
}

/**
 * Migrate all upload directories to persistent storage
 * @returns {Promise<{copied: number, failed: number, skipped: number}>} Migration statistics
 */
async function migrateAllUploads() {
  // Skip if persistent storage is not available
  if (!isPersistentStorageAvailable()) {
    console.log('Persistent storage not available, skipping migration');
    return { copied: 0, failed: 0, skipped: 0 };
  }
  
  console.log('Starting migration to persistent storage...');
  
  // Migrate all upload directories
  const stats = await migrateDirectory('public/uploads', 'uploads');
  
  console.log(`Migration complete: ${stats.copied} files copied, ${stats.failed} failed, ${stats.skipped} skipped`);
  
  return stats;
}

module.exports = {
  migrateAllUploads
};
