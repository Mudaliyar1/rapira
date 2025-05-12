# Persistent Storage for Render Without External Services

This implementation provides a zero-cost, persistent media upload system for web applications hosted on Render, without using any external storage services like AWS S3, Firebase, or Cloudinary.

## How It Works

This solution uses Render's built-in persistent disk feature to store uploaded files in a way that survives server restarts and deployments. The implementation:

1. Automatically creates a persistent storage directory if it doesn't exist
2. Migrates existing files from ephemeral storage to persistent storage on startup
3. Serves files from both standard and persistent paths for backward compatibility
4. Provides a test endpoint to verify that persistent storage is working correctly

## Key Features

- **Zero External Dependencies**: No AWS S3, Firebase, Cloudinary, or any other external service
- **No Manual Configuration**: Just push to GitHub and deploy on Render
- **Automatic Migration**: Existing files are automatically migrated to persistent storage
- **Dual Path Handling**: Files are accessible via both standard and persistent URLs
- **Test Endpoint**: Easily verify that persistent storage is working correctly

## Implementation Details

### 1. Persistent Storage Utility (`utils/persistentStorage.js`)

Manages file paths for persistent storage:

- `getPersistentStoragePath()`: Gets the persistent storage path
- `isPersistentStorageAvailable()`: Checks if persistent storage is available
- `getPersistentPath()`: Converts a relative path to a persistent storage path
- `getPersistentUrl()`: Gets the URL for accessing a file in persistent storage
- `ensurePersistentDirectory()`: Ensures a directory exists in persistent storage

### 2. File Migration Utility (`utils/migrateToPersistentStorage.js`)

Migrates files from ephemeral storage to persistent storage:

- `migrateAllUploads()`: Migrates all upload directories to persistent storage
- `migrateDirectory()`: Migrates files from a source directory to persistent storage
- `copyFile()`: Copies a file from source to destination

### 3. Persistent Media Middleware (`middleware/persistentMediaMiddleware.js`)

Serves files from persistent storage with proper headers:

- `createPersistentMediaMiddleware()`: Creates middleware for serving media files from persistent storage

### 4. Updated File Helper (`utils/fileHelper.js`)

Handles file operations with persistent storage support:

- `getFileUrl()`: Returns persistent URLs for files in production
- `ensureUploadDirectories()`: Creates directories in both standard and persistent storage
- `getPhysicalFilePath()`: Gets the physical file path for a given URL path
- `saveFileToPersistentStorage()`: Saves a file to both standard and persistent storage

### 5. Test Endpoint (`routes/test-persistent-storage.js`)

Provides endpoints for testing persistent storage:

- `/test-persistent-storage`: Upload test files and verify they're stored in persistent storage
- `/test-persistent-storage/list`: List all test files and see which ones are in persistent storage

## Deployment

### Using render.yaml (Recommended)

1. Push your code to a Git repository
2. In your Render dashboard, click "New" and select "Blueprint"
3. Connect your repository
4. Render will automatically detect the `render.yaml` file and configure your service with a persistent disk

### Manual Setup

If you prefer to set up your service manually:

1. Create a new Web Service in your Render dashboard
2. Configure your build and start commands:
   - Build Command: `npm install`
   - Start Command: `node app.js`
3. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `PERSISTENT_STORAGE_PATH`: `/opt/render/project/src/persistent-storage`
   - (Plus all your other required environment variables)
4. In the "Disks" section:
   - Click "Add Disk"
   - Name: `persistent-storage`
   - Mount Path: `/opt/render/project/src/persistent-storage`
   - Size: 1 GB (or more depending on your needs)

## Testing

After deployment, you can verify that persistent storage is working correctly:

1. Visit the test endpoint at `/test-persistent-storage`
2. Upload a test file using the provided form
3. Verify that the file is accessible via the provided link
4. Restart your service from the Render dashboard
5. Return to the test page and verify that the file is still accessible
6. View all test files at `/test-persistent-storage/list` to see which ones are stored in persistent storage

## Troubleshooting

### Files Not Persisting After Restart

1. Check the server logs for any errors related to persistent storage
2. Verify that the `PERSISTENT_STORAGE_PATH` environment variable is set correctly
3. Make sure the persistent disk is mounted correctly in your Render dashboard

### Permission Issues

If you see permission errors in the logs:

1. Check that the disk is mounted with the correct permissions
2. You may need to SSH into your instance and run `chmod -R 755 /opt/render/project/src/persistent-storage`

## Conclusion

This implementation provides a robust solution for persistent file storage on Render without requiring any external services. It's easy to deploy, requires no manual configuration, and ensures that uploaded files remain accessible even after server restarts and deployments.
