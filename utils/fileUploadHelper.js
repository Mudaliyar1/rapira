/**
 * File Upload Helper
 * Handles file uploads with persistent storage on Render
 * Uses Render's built-in persistent directory at /mnt/data
 * No YAML configuration or disk setup required
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { 
  isPersistentAvailable, 
  saveToPersistent, 
  ensurePersistentDir 
} = require('./renderPersistentStorage');

/**
 * Create upload directories if they don't exist
 * @param {Array<string>} directories - List of directories to create
 */
function ensureUploadDirs(directories) {
  // Create directories in the regular location
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
  
  // Create directories in persistent storage if available
  if (isPersistentAvailable()) {
    directories.forEach(dir => {
      // Extract the uploads part of the path (e.g., 'uploads/images' -> 'images')
      const uploadSubdir = dir.replace(/^(public\/)?uploads\//, '');
      if (uploadSubdir) {
        ensurePersistentDir(uploadSubdir);
      }
    });
  }
}

/**
 * Configure multer storage with persistent backup
 * @param {string} uploadDir - Directory to save uploads (e.g., 'images', 'videos')
 * @param {Function} filenameGenerator - Function to generate filenames
 * @returns {multer.StorageEngine} Configured multer storage
 */
function createPersistentStorage(uploadDir, filenameGenerator) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join('public/uploads', uploadDir);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Use the provided filename generator or a default one
      const filename = filenameGenerator 
        ? filenameGenerator(file)
        : `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      
      cb(null, filename);
    }
  });
}

/**
 * Create a multer upload middleware with persistent storage
 * @param {Object} options - Upload options
 * @param {string} options.uploadDir - Directory to save uploads (e.g., 'images', 'videos')
 * @param {Function} options.filenameGenerator - Function to generate filenames
 * @param {number} options.fileSize - Max file size in bytes
 * @param {Function} options.fileFilter - Function to filter files
 * @returns {Object} Configured multer middleware
 */
function createPersistentUpload(options) {
  const {
    uploadDir = 'misc',
    filenameGenerator = null,
    fileSize = 5 * 1024 * 1024, // 5MB default
    fileFilter = null
  } = options;
  
  // Create storage
  const storage = createPersistentStorage(uploadDir, filenameGenerator);
  
  // Create multer options
  const multerOptions = {
    storage,
    limits: { fileSize }
  };
  
  // Add file filter if provided
  if (fileFilter) {
    multerOptions.fileFilter = fileFilter;
  }
  
  // Create multer middleware
  const upload = multer(multerOptions);
  
  // Add post-processing to save to persistent storage
  const processUpload = (req, res, next) => {
    // Skip if no files were uploaded
    if (!req.file && (!req.files || Object.keys(req.files).length === 0)) {
      return next();
    }
    
    // Process single file upload
    if (req.file) {
      const relativePath = path.relative('public/uploads', req.file.path).replace(/\\/g, '/');
      saveToPersistent(req.file.path, relativePath);
      
      // Add persistent flag to the file object
      req.file.persistent = isPersistentAvailable();
    }
    
    // Process multiple files upload
    if (req.files) {
      // Handle array of files
      if (Array.isArray(req.files)) {
        req.files.forEach(file => {
          const relativePath = path.relative('public/uploads', file.path).replace(/\\/g, '/');
          saveToPersistent(file.path, relativePath);
          
          // Add persistent flag to the file object
          file.persistent = isPersistentAvailable();
        });
      } 
      // Handle fields of files
      else {
        Object.keys(req.files).forEach(fieldname => {
          const files = req.files[fieldname];
          if (Array.isArray(files)) {
            files.forEach(file => {
              const relativePath = path.relative('public/uploads', file.path).replace(/\\/g, '/');
              saveToPersistent(file.path, relativePath);
              
              // Add persistent flag to the file object
              file.persistent = isPersistentAvailable();
            });
          }
        });
      }
    }
    
    next();
  };
  
  // Return the upload middleware with added methods
  return {
    single: (fieldname) => [upload.single(fieldname), processUpload],
    array: (fieldname, maxCount) => [upload.array(fieldname, maxCount), processUpload],
    fields: (fields) => [upload.fields(fields), processUpload],
    none: () => upload.none()
  };
}

module.exports = {
  ensureUploadDirs,
  createPersistentUpload
};
