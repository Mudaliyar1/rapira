/**
 * Render Persistent Storage Middleware
 * Serves files from Render's built-in persistent directory at /mnt/data
 * No YAML configuration or disk setup required
 */

const path = require('path');
const express = require('express');
const fs = require('fs');
const { isPersistentAvailable, getPersistentPath } = require('../utils/renderPersistentStorage');

/**
 * Creates middleware for serving files from Render's persistent storage
 * @returns {Function} Express middleware
 */
function createRenderPersistentMiddleware() {
  // If persistent storage is not available, return a middleware that passes to the next handler
  if (!isPersistentAvailable()) {
    console.log('Persistent storage not available, middleware will pass through');
    return (req, res, next) => next();
  }
  
  // Get the persistent storage path
  const persistentPath = getPersistentPath();
  console.log(`Creating persistent middleware for path: ${persistentPath}`);
  
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
}

/**
 * Fallback middleware that checks persistent storage if file not found in regular storage
 * @param {string} regularUploadsDir - The regular uploads directory
 * @returns {Function} Express middleware
 */
function createPersistentFallbackMiddleware(regularUploadsDir) {
  return (req, res, next) => {
    // Only process if persistent storage is available
    if (!isPersistentAvailable()) {
      return next();
    }
    
    // Get the requested file path relative to the uploads directory
    const urlPath = req.path;
    const persistentPath = path.join(getPersistentPath(), urlPath);
    
    // Check if the file exists in persistent storage
    fs.access(persistentPath, fs.constants.R_OK, (err) => {
      if (err) {
        // File not found in persistent storage, continue to next middleware
        return next();
      }
      
      // File exists in persistent storage, serve it
      res.sendFile(persistentPath, {
        headers: {
          'Content-Type': getContentType(persistentPath),
          'Cache-Control': 'public, max-age=604800, immutable',
          'Content-Disposition': `inline; filename="${path.basename(persistentPath)}"`
        }
      });
    });
  };
}

/**
 * Get content type based on file extension
 * @param {string} filePath - The file path
 * @returns {string} The content type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.mp4':
      return 'video/mp4';
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.wav':
      return 'audio/wav';
    default:
      return 'application/octet-stream';
  }
}

module.exports = {
  createRenderPersistentMiddleware,
  createPersistentFallbackMiddleware
};
