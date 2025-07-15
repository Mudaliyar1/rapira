---
type: "manual"
---

# Zero-Config Persistent Storage for Render

This implementation provides a zero-cost, persistent media upload system for web applications hosted on Render, without using any external storage services or requiring any YAML configuration or disk setup.

## How It Works

This solution uses Render's built-in persistent directory at `/mnt/data` which is available on all Render services without any configuration. The implementation:

1. Automatically creates a persistent storage directory at `/mnt/data/uploads`
2. Saves uploaded files to both the regular location and the persistent location
3. Serves files from both locations, with the persistent location as a fallback
4. Provides a test endpoint to verify that persistent storage is working correctly

## Key Features

- **Zero External Dependencies**: No AWS S3, Firebase, Cloudinary, or any other external service
- **No YAML Configuration**: No render.yaml file or disk configuration required
- **No Manual Setup**: Just push to GitHub and deploy on Render
- **Automatic Directory Creation**: Persistent directories are created automatically
- **Dual Storage**: Files are saved to both regular and persistent storage
- **Test Endpoint**: Easily verify that persistent storage is working correctly

## Implementation Details

### 1. Render Persistent Storage Utility (`utils/renderPersistentStorage.js`)

Manages file paths for Render's built-in persistent storage:

- `getPersistentPath()`: Gets the persistent storage path (`/mnt/data/uploads`)
- `isPersistentAvailable()`: Checks if persistent storage is available
- `getFullPersistentPath()`: Converts a relative path to a persistent storage path
- `ensurePersistentDir()`: Ensures a directory exists in persistent storage
- `saveToPersistent()`: Saves a file to persistent storage
- `getFromPersistent()`: Gets a file from persistent storage
- `existsInPersistent()`: Checks if a file exists in persistent storage

### 2. Render Persistent Middleware (`middleware/renderPersistentMiddleware.js`)

Serves files from Render's built-in persistent storage:

- `createRenderPersistentMiddleware()`: Creates middleware for serving files from persistent storage
- `createPersistentFallbackMiddleware()`: Creates middleware that checks persistent storage if a file is not found in regular storage

### 3. File Upload Helper (`utils/fileUploadHelper.js`)

Handles file uploads with persistent storage support:

- `ensureUploadDirs()`: Creates directories in both regular and persistent storage
- `createPersistentStorage()`: Configures multer storage with persistent backup
- `createPersistentUpload()`: Creates a multer upload middleware with persistent storage

### 4. Test Upload Routes (`routes/test-upload.js`)

Provides endpoints for testing file uploads with persistent storage:

- `/test-upload`: Upload test files and verify they're stored in persistent storage
- `/test-upload/list`: List all test files and see which ones are in persistent storage

## How to Use

### 1. File Uploads

To use persistent storage for file uploads, replace your existing multer setup with the persistent upload middleware:

```javascript
const { createPersistentUpload } = require('../utils/fileUploadHelper');

// Create upload middleware
const upload = createPersistentUpload({
  uploadDir: 'images',
  fileSize: 5 * 1024 * 1024, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Your file filter logic
  }
});

// Use in routes
router.post('/upload', upload.single('image'), (req, res) => {
  // The file is automatically saved to both regular and persistent storage
  // req.file.persistent will be true if the file was saved to persistent storage
});
```

### 2. Ensuring Directories Exist

To ensure upload directories exist in both regular and persistent storage:

```javascript
const { ensureUploadDirs } = require('../utils/fileUploadHelper');

// Create directories
ensureUploadDirs([
  'public/uploads/images',
  'public/uploads/videos',
  'public/uploads/documents'
]);
```

## Testing

After deployment, you can verify that persistent storage is working correctly:

1. Visit the test endpoint at `/test-upload`
2. Upload a test file using the provided form
3. Verify that the file is accessible via the provided link
4. Restart your service from the Render dashboard
5. Return to the test page and verify that the file is still accessible
6. View all test files at `/test-upload/list` to see which ones are stored in persistent storage

## Troubleshooting

### Files Not Persisting After Restart

1. Check the server logs for any errors related to persistent storage
2. Verify that the `/mnt/data` directory exists and is writable
3. Check if the file was successfully saved to persistent storage

### Permission Issues

If you see permission errors in the logs:

1. Check that the `/mnt/data` directory has the correct permissions
2. You may need to SSH into your instance and run `chmod -R 755 /mnt/data/uploads`

## Conclusion

This implementation provides a robust solution for persistent file storage on Render without requiring any external services, YAML configuration, or disk setup. It's easy to deploy, requires no manual configuration, and ensures that uploaded files remain accessible even after server restarts and deployments.
