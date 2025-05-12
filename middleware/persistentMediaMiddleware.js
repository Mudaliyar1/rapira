/**
 * Persistent Media Middleware
 * Serves files from persistent storage with proper headers
 */

const path = require('path');
const express = require('express');
const { 
  isPersistentStorageAvailable, 
  getPersistentStoragePath 
} = require('../utils/persistentStorage');

/**
 * Creates middleware for serving media files from persistent storage
 * @returns {Function} Express middleware
 */
const createPersistentMediaMiddleware = () => {
  // If persistent storage is not available, return a middleware that passes to the next handler
  if (!isPersistentStorageAvailable()) {
    return (req, res, next) => next();
  }
  
  // Get the persistent storage path
  const persistentPath = getPersistentStoragePath();
  
  // Create static middleware for the persistent storage
  return express.static(persistentPath, {
    setHeaders: (res, filePath) => {
      // Determine content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      
      // Set appropriate content type
      switch (ext) {
        case '.mp3':
          res.setHeader('Content-Type', 'audio/mpeg');
          break;
        case '.mp4':
          res.setHeader('Content-Type', 'video/mp4');
          break;
        case '.pdf':
          res.setHeader('Content-Type', 'application/pdf');
          break;
        case '.jpg':
        case '.jpeg':
          res.setHeader('Content-Type', 'image/jpeg');
          break;
        case '.png':
          res.setHeader('Content-Type', 'image/png');
          break;
        case '.gif':
          res.setHeader('Content-Type', 'image/gif');
          break;
        case '.wav':
          res.setHeader('Content-Type', 'audio/wav');
          break;
      }
      
      // Add CORS headers for all media files
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      
      // Add Accept-Ranges header for streaming media
      if (['.mp4', '.mp3', '.wav'].includes(ext)) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      
      // Set strong cache control
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
      res.setHeader('Vary', 'Accept-Encoding');
      
      // Set content disposition
      const filename = path.basename(filePath);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      // Add ETag support for cache validation
      res.setHeader('ETag', `"${path.basename(filePath)}-${Date.now()}"`);
    }
  });
};

module.exports = { createPersistentMediaMiddleware };