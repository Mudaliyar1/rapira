/**
 * Test Upload Routes
 * Provides endpoints for testing file uploads with persistent storage
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { createPersistentUpload, ensureUploadDirs } = require('../utils/fileUploadHelper');
const { isPersistentAvailable, existsInPersistent, getFullPersistentPath } = require('../utils/renderPersistentStorage');

// Ensure test upload directory exists
ensureUploadDirs(['public/uploads/test']);

// Configure upload middleware
const upload = createPersistentUpload({
  uploadDir: 'test',
  fileSize: 10 * 1024 * 1024, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|mp3|mp4|webm/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, audio, and video files are allowed'));
    }
  }
});

// Test upload page
router.get('/', (req, res) => {
  res.render('test-upload', {
    title: 'Test File Upload with Persistent Storage',
    isPersistentAvailable: isPersistentAvailable()
  });
});

// Handle file upload
router.post('/upload', upload.single('testFile'), (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'No file selected');
      return res.redirect('/test-upload');
    }

    // Get the file path relative to the uploads directory
    const relativePath = path.relative(
      path.join(__dirname, '../public'),
      req.file.path
    ).replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes

    // Check if the file was also saved to persistent storage
    const persistentPath = relativePath.replace(/^uploads\//, '');
    const inPersistentStorage = existsInPersistent(persistentPath);

    // Return success with file info
    req.flash('success', 'File uploaded successfully');
    res.render('test-upload', {
      title: 'Test File Upload with Persistent Storage',
      isPersistentAvailable: isPersistentAvailable(),
      fileInfo: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: `/${relativePath}`,
        size: (req.file.size / 1024).toFixed(2) + ' KB',
        persistentStatus: inPersistentStorage ? 'Saved to persistent storage' : 'Not saved to persistent storage'
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    req.flash('error', `Error uploading file: ${error.message}`);
    res.redirect('/test-upload');
  }
});

// List all test files
router.get('/list', async (req, res) => {
  try {
    const testDir = path.join(__dirname, '../public/uploads/test');
    let files = [];

    // Check if directory exists
    if (fs.existsSync(testDir)) {
      // Get all files in the test directory
      const fileNames = fs.readdirSync(testDir);
      
      // Get file details
      files = fileNames.map(filename => {
        const filePath = path.join(testDir, filename);
        const stats = fs.statSync(filePath);
        const relativePath = path.relative(
          path.join(__dirname, '../public'),
          filePath
        ).replace(/\\/g, '/');

        // Check if file exists in persistent storage
        const persistentPath = relativePath.replace(/^uploads\//, '');
        const inPersistentStorage = existsInPersistent(persistentPath);

        return {
          filename,
          path: `/${relativePath}`,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          created: stats.birthtime.toLocaleString(),
          inPersistentStorage: inPersistentStorage ? 'Yes' : 'No'
        };
      });
    }

    res.render('test-upload-list', {
      title: 'Test Files List',
      files,
      isPersistentAvailable: isPersistentAvailable()
    });
  } catch (error) {
    console.error('Error listing files:', error);
    req.flash('error', `Error listing files: ${error.message}`);
    res.redirect('/test-upload');
  }
});

module.exports = router;
