/**
 * Utility functions for MongoDB storage statistics
 */
const mongoose = require('mongoose');

/**
 * Format bytes to human-readable format
 * @param {Number} bytes - Size in bytes
 * @param {Number} decimals - Number of decimal places
 * @returns {String} - Formatted size with unit
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Get stats for a specific collection
 * @param {String} collectionName - Name of the collection
 * @returns {Object} - Collection statistics
 */
async function getCollectionStats(collectionName) {
  try {
    const db = mongoose.connection.db;
    const stats = await db.command({ collStats: collectionName });

    return {
      name: collectionName,
      count: stats.count,
      size: stats.size,
      storageSize: stats.storageSize,
      totalIndexSize: stats.totalIndexSize,
      avgObjSize: stats.avgObjSize,
      formattedSize: formatBytes(stats.size),
      formattedStorageSize: formatBytes(stats.storageSize),
      formattedIndexSize: formatBytes(stats.totalIndexSize)
    };
  } catch (error) {
    console.error(`Error getting stats for collection ${collectionName}:`, error);
    return {
      name: collectionName,
      error: error.message,
      count: 0,
      size: 0,
      storageSize: 0,
      totalIndexSize: 0,
      formattedSize: '0 Bytes',
      formattedStorageSize: '0 Bytes',
      formattedIndexSize: '0 Bytes'
    };
  }
}

/**
 * Get database stats
 * @returns {Object} - Database statistics
 */
async function getDatabaseStats() {
  try {
    const db = mongoose.connection.db;
    const stats = await db.command({ dbStats: 1 });

    // MongoDB Atlas Free Tier has 512MB storage limit
    // You can adjust this based on your actual plan
    const ATLAS_STORAGE_LIMIT = 512 * 1024 * 1024; // 512MB in bytes

    // Calculate total used storage (data + indexes)
    const totalUsedStorage = stats.dataSize + stats.indexSize;

    // Calculate remaining storage
    const remainingStorage = Math.max(0, ATLAS_STORAGE_LIMIT - totalUsedStorage);

    // Calculate usage percentage
    const usagePercentage = (totalUsedStorage / ATLAS_STORAGE_LIMIT) * 100;

    return {
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexSize: stats.indexSize,
      totalSize: totalUsedStorage,
      formattedDataSize: formatBytes(stats.dataSize),
      formattedStorageSize: formatBytes(stats.storageSize),
      formattedIndexSize: formatBytes(stats.indexSize),
      formattedTotalSize: formatBytes(totalUsedStorage),

      // Atlas plan information
      atlasLimit: ATLAS_STORAGE_LIMIT,
      formattedAtlasLimit: formatBytes(ATLAS_STORAGE_LIMIT),
      remainingStorage: remainingStorage,
      formattedRemainingStorage: formatBytes(remainingStorage),
      usagePercentage: usagePercentage.toFixed(2)
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      error: error.message,
      dataSize: 0,
      storageSize: 0,
      indexSize: 0,
      totalSize: 0,
      formattedDataSize: '0 Bytes',
      formattedStorageSize: '0 Bytes',
      formattedIndexSize: '0 Bytes',
      formattedTotalSize: '0 Bytes',

      // Default Atlas plan information
      atlasLimit: 512 * 1024 * 1024,
      formattedAtlasLimit: '512 MB',
      remainingStorage: 512 * 1024 * 1024,
      formattedRemainingStorage: '512 MB',
      usagePercentage: '0.00'
    };
  }
}

/**
 * Get all collections and their stats
 * @returns {Object} - All collections grouped by module
 */
async function getAllCollectionStats() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Get stats for each collection
    const statsPromises = collectionNames.map(name => getCollectionStats(name));
    const allStats = await Promise.all(statsPromises);

    // Group collections by module
    const moduleGroups = {
      'User Management': ['users', 'artists', 'artistapplications', 'artistupgraderequests', 'roles', 'userroles'],
      'Concert Management': ['concerts', 'tickets', 'dailyconcerts'],
      'Content Management': ['contents', 'pages', 'learningmodules', 'learningprogresses'],
      'Booking Management': ['teamrequirementroles', 'teambookingrequests', 'featuredartists', 'artistroleslots', 'artistbookingrequests'],
      'System': ['sessions', 'notifications', 'messages'],
      'Other': []
    };

    // Organize stats by module
    const groupedStats = {};
    let totalSize = 0;
    let totalStorageSize = 0;
    let totalIndexSize = 0;
    let totalDocuments = 0;

    // Initialize groups
    Object.keys(moduleGroups).forEach(group => {
      groupedStats[group] = {
        collections: [],
        totalSize: 0,
        totalStorageSize: 0,
        totalIndexSize: 0,
        totalDocuments: 0
      };
    });

    // Assign collections to groups
    allStats.forEach(stat => {
      let assigned = false;

      // Check which module this collection belongs to
      for (const [module, collections] of Object.entries(moduleGroups)) {
        if (collections.some(c => stat.name.toLowerCase().includes(c.toLowerCase()))) {
          groupedStats[module].collections.push(stat);
          groupedStats[module].totalSize += stat.size;
          groupedStats[module].totalStorageSize += stat.storageSize;
          groupedStats[module].totalIndexSize += stat.totalIndexSize;
          groupedStats[module].totalDocuments += stat.count;
          assigned = true;
          break;
        }
      }

      // If not assigned to any module, put in Other
      if (!assigned) {
        groupedStats['Other'].collections.push(stat);
        groupedStats['Other'].totalSize += stat.size;
        groupedStats['Other'].totalStorageSize += stat.storageSize;
        groupedStats['Other'].totalIndexSize += stat.totalIndexSize;
        groupedStats['Other'].totalDocuments += stat.count;
      }

      // Add to totals
      totalSize += stat.size;
      totalStorageSize += stat.storageSize;
      totalIndexSize += stat.totalIndexSize;
      totalDocuments += stat.count;
    });

    // Format group totals
    Object.keys(groupedStats).forEach(group => {
      groupedStats[group].formattedTotalSize = formatBytes(groupedStats[group].totalSize);
      groupedStats[group].formattedTotalStorageSize = formatBytes(groupedStats[group].totalStorageSize);
      groupedStats[group].formattedTotalIndexSize = formatBytes(groupedStats[group].totalIndexSize);
      groupedStats[group].percentage = ((groupedStats[group].totalSize / totalSize) * 100).toFixed(1);
    });

    // Get database stats
    const dbStats = await getDatabaseStats();

    return {
      groups: groupedStats,
      totals: {
        size: totalSize,
        storageSize: totalStorageSize,
        indexSize: totalIndexSize,
        documents: totalDocuments,
        formattedSize: formatBytes(totalSize),
        formattedStorageSize: formatBytes(totalStorageSize),
        formattedIndexSize: formatBytes(totalIndexSize)
      },
      dbStats
    };
  } catch (error) {
    console.error('Error getting all collection stats:', error);
    return {
      error: error.message,
      groups: {},
      totals: {
        size: 0,
        storageSize: 0,
        indexSize: 0,
        documents: 0,
        formattedSize: '0 Bytes',
        formattedStorageSize: '0 Bytes',
        formattedIndexSize: '0 Bytes'
      }
    };
  }
}

module.exports = {
  formatBytes,
  getCollectionStats,
  getDatabaseStats,
  getAllCollectionStats
};
