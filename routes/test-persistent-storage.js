/**
 * Test Persistent Storage Routes
 * Provides endpoints for testing persistent storage functionality
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { isPersistentStorageAvailable, getPersistentPath } = require('../utils/persistentStorage');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/test');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'test-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
  res.render('test-persistent-storage', {
    title: 'Test Persistent Storage',
    isPersistentStorageAvailable: isPersistentStorageAvailable()
  });
});

// Handle file upload
router.post('/upload', upload.single('testFile'), (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'No file selected');
      return res.redirect('/test-persistent-storage');
    }

    // Get the file path relative to the uploads directory
    const relativePath = path.relative(
      path.join(__dirname, '../public'),
      req.file.path
    ).replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes

    // Check if the file was also saved to persistent storage
    let persistentStatus = 'Not available';
    if (isPersistentStorageAvailable()) {
      const persistentPath = getPersistentPath(relativePath);
      persistentStatus = fs.existsSync(persistentPath) ? 'Saved to persistent storage' : 'Failed to save to persistent storage';
    }

    // Return success with file info
    req.flash('success', 'File uploaded successfully');
    res.render('test-persistent-storage', {
      title: 'Test Persistent Storage',
      isPersistentStorageAvailable: isPersistentStorageAvailable(),
      fileInfo: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: `/${relativePath}`,
        size: (req.file.size / 1024).toFixed(2) + ' KB',
        persistentStatus
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    req.flash('error', `Error uploading file: ${error.message}`);
    res.redirect('/test-persistent-storage');
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
        let persistentStatus = 'Not available';
        if (isPersistentStorageAvailable()) {
          const persistentPath = getPersistentPath(relativePath);
          persistentStatus = fs.existsSync(persistentPath) ? 'Yes' : 'No';
        }

        return {
          filename,
          path: `/${relativePath}`,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          created: stats.birthtime.toLocaleString(),
          inPersistentStorage: persistentStatus
        };
      });
    }

    res.render('test-persistent-storage-list', {
      title: 'Test Files List',
      files,
      isPersistentStorageAvailable: isPersistentStorageAvailable()
    });
  } catch (error) {
    console.error('Error listing files:', error);
    req.flash('error', `Error listing files: ${error.message}`);
    res.redirect('/test-persistent-storage');
  }
});

module.exports = router;
