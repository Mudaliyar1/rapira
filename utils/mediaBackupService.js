/**
 * Media Backup Service
 * 
 * Centralized utility for backing up and restoring media files
 * across the entire Rapira platform.
 * 
 * Usage:
 * - Call backupMediaToMongo() after every file upload
 * - Call restoreAllMediaOnStartup() on server startup (after DB connection)
 * - Call scanAndBackupUploadsFolder() via admin action to sync disk → MongoDB
 * - Call restoreAllMediaFromMongo() via admin action to sync MongoDB → disk
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const MediaBackup = require('../models/MediaBackup');

const uploadsBasePath = path.join(__dirname, '..', 'public', 'uploads');

/**
 * Backup a single file to MongoDB
 * 
 * @param {Object} file - Multer file object (req.file or from req.files array)
 * @param {Object} options - Additional metadata
 *   - module: 'artistContent', 'venueMedia', 'adminMedia', 'userProfile', etc.
 *   - ownerType: 'artist', 'venue', 'admin', 'user', 'system'
 *   - ownerId: ObjectId or string ID of the owner
 * @returns {Promise<Object>} Saved MediaBackup document or null on error
 */
async function backupMediaToMongo(file, options = {}) {
  try {
    if (!file || !file.filename) {
      console.warn('backupMediaToMongo: No valid file object provided');
      return null;
    }

    // Build the relative file path within /uploads
    // If diskStorage destination is provided, use it; otherwise use filename alone
    let filePath;
    if (file.destination) {
      // destination is absolute path like "/app/public/uploads/artist/123"
      // Extract relative path from uploads onwards
      const relativeDest = path.relative(uploadsBasePath, file.destination);
      filePath = path.join(relativeDest, file.filename).replace(/\\/g, '/'); // Normalize to forward slashes
    } else {
      // Fallback: just use filename
      filePath = file.filename;
    }

    // Read the file from disk
    const absolutePath = path.join(file.destination || uploadsBasePath, file.filename);
    const fileData = await fs.readFile(absolutePath);

    // Determine file type from MIME type
    const fileType = MediaBackup.detectFileType(file.mimetype);

    // Prepare document data
    const backupData = {
      fileName: file.filename,
      filePath: filePath,
      mimeType: file.mimetype,
      fileType: fileType,
      size: file.size || fileData.length,
      data: fileData,
      module: options.module || 'other',
      ownerType: options.ownerType || null,
      ownerId: options.ownerId || null,
      uploadedOn: new Date()
    };

    // Save or update in MongoDB
    // Use filePath as unique identifier (overwrite if exists)
    const savedBackup = await MediaBackup.findOneAndUpdate(
      { filePath: filePath },
      backupData,
      { upsert: true, new: true }
    );

    console.log(`✓ Media backed up to MongoDB: ${filePath} (${fileType}, ${fileData.length} bytes)`);
    return savedBackup;
  } catch (error) {
    console.error(`✗ Error backing up media to MongoDB:`, error.message);
    // Don't crash the upload process; media is still available from /uploads
    return null;
  }
}

/**
 * Restore a single file from MongoDB to /uploads
 * 
 * @param {Object} mediaBackup - MediaBackup document
 * @returns {Promise<boolean>} True if restored successfully
 */
async function restoreMediaFromMongo(mediaBackup) {
  try {
    const absolutePath = path.join(uploadsBasePath, mediaBackup.filePath);
    
    // Ensure directory exists
    const directory = path.dirname(absolutePath);
    await fs.mkdir(directory, { recursive: true });

    // Write file from MongoDB Buffer
    await fs.writeFile(absolutePath, mediaBackup.data);

    // Update last restored timestamp
    await MediaBackup.findByIdAndUpdate(mediaBackup._id, {
      lastRestoredOn: new Date()
    });

    console.log(`✓ Restored: ${mediaBackup.filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error restoring media: ${mediaBackup.filePath}`, error.message);
    return false;
  }
}

/**
 * Restore ALL media from MongoDB to /uploads on server startup
 * 
 * Should be called:
 * - After MongoDB connection is established
 * - Before server starts listening
 * 
 * @returns {Promise<Object>} Summary with counts
 */
async function restoreAllMediaOnStartup() {
  try {
    console.log('\n📁 === MEDIA RESTORE ON STARTUP ===');

    // Ensure base /uploads directory exists
    await fs.mkdir(uploadsBasePath, { recursive: true });
    console.log(`✓ Uploads directory ready: ${uploadsBasePath}`);

    // Get all non-deleted media from MongoDB
    const allMedia = await MediaBackup.find({ isDeleted: false });
    console.log(`Found ${allMedia.length} media items in MongoDB backup`);

    let restored = 0;
    let skipped = 0;
    let errors = 0;

    // Restore each file
    for (const mediaBackup of allMedia) {
      try {
        const absolutePath = path.join(uploadsBasePath, mediaBackup.filePath);

        // Check if file already exists on disk
        let fileExists = false;
        try {
          const stats = await fs.stat(absolutePath);
          fileExists = true;

          // If file exists and has same size, likely already restored
          if (stats.size === mediaBackup.size) {
            skipped++;
            continue;
          }
        } catch (err) {
          // File doesn't exist, proceed with restore
        }

        // Restore the file
        const directory = path.dirname(absolutePath);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(absolutePath, mediaBackup.data);

        // Update restore timestamp
        await MediaBackup.findByIdAndUpdate(mediaBackup._id, {
          lastRestoredOn: new Date()
        });

        restored++;
      } catch (err) {
        console.error(`✗ Failed to restore ${mediaBackup.filePath}:`, err.message);
        errors++;
      }
    }

    console.log(`📊 Restore Complete: ${restored} restored, ${skipped} already present, ${errors} errors`);
    console.log('=== END MEDIA RESTORE === \n');

    return { restored, skipped, errors, total: allMedia.length };
  } catch (error) {
    console.error('✗ Critical error in restoreAllMediaOnStartup:', error.message);
    // Don't crash the server, but log the issue
    return { restored: 0, skipped: 0, errors: 1, total: 0 };
  }
}

/**
 * Scan /uploads folder and backup any files not in MongoDB
 * 
 * This is a safety net: if files exist on disk but not in MongoDB,
 * they will be backed up.
 * 
 * Called via admin action "Scan and Backup Now"
 * 
 * @returns {Promise<Object>} Summary with counts
 */
async function scanAndBackupUploadsFolder() {
  try {
    console.log('\n📁 === SCANNING /uploads FOR BACKUP ===');

    let scanned = 0;
    let backedUp = 0;
    let skipped = 0;
    let errors = 0;

    // Recursively scan all files in /uploads
    async function scanDir(dir, baseRelativePath = '') {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(baseRelativePath, entry.name).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            // Recursively scan subdirectory
            await scanDir(fullPath, relativePath);
          } else {
            // File found
            scanned++;

            // Check if already in MongoDB
            const existing = await MediaBackup.findOne({ filePath: relativePath });

            if (existing) {
              skipped++;
            } else {
              // Back up this file
              try {
                const fileData = await fs.readFile(fullPath);
                const mimeType = getMimeTypeFromPath(fullPath);
                const fileType = MediaBackup.detectFileType(mimeType);

                await MediaBackup.create({
                  fileName: entry.name,
                  filePath: relativePath,
                  mimeType: mimeType,
                  fileType: fileType,
                  size: fileData.length,
                  data: fileData,
                  module: 'other', // Generic categorization for scanned files
                  ownerType: 'system',
                  uploadedOn: new Date()
                });

                backedUp++;
              } catch (err) {
                console.error(`Error backing up ${relativePath}:`, err.message);
                errors++;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning directory ${dir}:`, err.message);
        errors++;
      }
    }

    // Ensure /uploads exists before scanning
    if (!fsSync.existsSync(uploadsBasePath)) {
      console.log('ℹ️  /uploads directory does not exist yet');
      return { scanned: 0, backedUp: 0, skipped: 0, errors: 0 };
    }

    await scanDir(uploadsBasePath);

    console.log(`📊 Scan Complete: ${backedUp} backed up, ${skipped} already in MongoDB, ${scanned} total scanned`);
    console.log('=== END SCAN === \n');

    return { scanned, backedUp, skipped, errors };
  } catch (error) {
    console.error('✗ Critical error in scanAndBackupUploadsFolder:', error.message);
    return { scanned: 0, backedUp: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Restore ALL media from MongoDB to /uploads (admin action)
 * 
 * Similar to startupRestore but can be called on-demand via admin panel
 * 
 * @returns {Promise<Object>} Summary with counts
 */
async function restoreAllMediaFromMongo() {
  try {
    console.log('\n📁 === ADMIN TRIGGERED RESTORE ===');

    await fs.mkdir(uploadsBasePath, { recursive: true });

    const allMedia = await MediaBackup.find({ isDeleted: false });
    let restored = 0;
    let skipped = 0;
    let errors = 0;

    for (const mediaBackup of allMedia) {
      try {
        const success = await restoreMediaFromMongo(mediaBackup);
        if (success) {
          restored++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Failed to restore ${mediaBackup.filePath}:`, err.message);
        errors++;
      }
    }

    console.log(`📊 Admin Restore Complete: ${restored} restored, ${skipped} skipped, ${errors} errors`);
    console.log('=== END ADMIN RESTORE === \n');

    return { restored, skipped, errors, total: allMedia.length };
  } catch (error) {
    console.error('✗ Critical error in restoreAllMediaFromMongo:', error.message);
    return { restored: 0, skipped: 0, errors: 1, total: 0 };
  }
}

/**
 * Get statistics about media stored in MongoDB
 * 
 * Used by admin dashboard
 * 
 * @returns {Promise<Object>} Statistics
 */
async function getMediaStats() {
  try {
    const total = await MediaBackup.countDocuments({ isDeleted: false });
    const byType = await MediaBackup.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$fileType', count: { $sum: 1 } } }
    ]);
    const byModule = await MediaBackup.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$module', count: { $sum: 1 } } }
    ]);
    const byOwnerType = await MediaBackup.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$ownerType', count: { $sum: 1 } } }
    ]);

    const totalSize = await MediaBackup.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalBytes: { $sum: '$size' } } }
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      byModule: byModule.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      byOwnerType: byOwnerType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      totalSizeBytes: totalSize[0]?.totalBytes || 0
    };
  } catch (error) {
    console.error('Error getting media stats:', error.message);
    return { total: 0, byType: {}, byModule: {}, byOwnerType: {}, totalSizeBytes: 0 };
  }
}

/**
 * Helper: Determine MIME type from file path/extension
 */
function getMimeTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  backupMediaToMongo,
  restoreMediaFromMongo,
  restoreAllMediaOnStartup,
  scanAndBackupUploadsFolder,
  restoreAllMediaFromMongo,
  getMediaStats,
  formatBytes
};
