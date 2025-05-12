# Persistent Storage Implementation for Render

This document explains how the persistent storage solution for Render has been implemented in this application.

## Overview

Render's filesystem is ephemeral by default, meaning any files saved to the local filesystem will be lost when the server restarts or redeploys. This implementation uses Render's persistent disk feature to store uploaded files in a way that survives restarts and deployments.

## How It Works

1. **Persistent Disk**: We use Render's persistent disk feature to create a dedicated storage area that persists across deployments.

2. **File Migration**: When the server starts, it automatically migrates any existing files from the ephemeral storage to the persistent storage.

3. **Dual Path Handling**: The application serves files from both the standard path (`/uploads/...`) and the persistent path (`/persistent/uploads/...`), ensuring backward compatibility.

4. **Production vs Development**: In development, files are stored in the local filesystem. In production, files are stored in both the local filesystem and the persistent disk.

## Implementation Details

### 1. Persistent Storage Utility (`utils/persistentStorage.js`)

This utility provides functions for managing file paths in persistent storage:

- `getPersistentStoragePath()`: Gets the persistent storage path from environment variables
- `isPersistentStorageAvailable()`: Checks if persistent storage is available
- `getPersistentPath()`: Converts a relative path to a persistent storage path
- `getPersistentUrl()`: Gets the URL for accessing a file in persistent storage
- `ensurePersistentDirectory()`: Ensures a directory exists in persistent storage

### 2. File Migration Utility (`utils/migrateToPersistentStorage.js`)

This utility migrates files from ephemeral storage to persistent storage:

- `migrateAllUploads()`: Migrates all upload directories to persistent storage
- `migrateDirectory()`: Migrates files from a source directory to persistent storage
- `copyFile()`: Copies a file from source to destination

### 3. Persistent Media Middleware (`middleware/persistentMediaMiddleware.js`)

This middleware serves files from persistent storage with proper headers:

- `createPersistentMediaMiddleware()`: Creates middleware for serving media files from persistent storage

### 4. Updated File Helper (`utils/fileHelper.js`)

The existing file helper has been updated to support persistent storage:

- `getFileUrl()`: Now returns persistent URLs for files in production
- `ensureUploadDirectories()`: Now creates directories in both standard and persistent storage
- `getPhysicalFilePath()`: Gets the physical file path for a given URL path
- `saveFileToPersistentStorage()`: Saves a file to both standard and persistent storage

### 5. Application Configuration (`app.js`)

The application has been configured to use persistent storage:

- Checks if persistent storage is available
- Migrates existing files to persistent storage on startup
- Serves files from both standard and persistent paths

### 6. Render Configuration (`render.yaml`)

The Render configuration file defines a persistent disk for the application:

```yaml
disk:
  name: persistent-storage
  mountPath: /opt/render/project/src/persistent-storage
  sizeGB: 1
```

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

## Verifying the Setup

After deployment, you can verify that persistent storage is working correctly:

1. Upload a file through your application
2. Check the server logs to see that the file was saved to the persistent storage path
3. Restart your service from the Render dashboard
4. Verify that the uploaded file is still accessible

## Troubleshooting

### Files Not Persisting After Restart

1. Check the server logs for any errors related to persistent storage
2. Verify that the `PERSISTENT_STORAGE_PATH` environment variable is set correctly
3. Make sure the persistent disk is mounted correctly in your Render dashboard

### Permission Issues

If you see permission errors in the logs:

1. Check that the disk is mounted with the correct permissions
2. You may need to SSH into your instance and run `chmod -R 755 /opt/render/project/src/persistent-storage`

### Migration Errors

If file migration fails:

1. Check the server logs for specific error messages
2. Verify that both source and destination directories exist
3. Check for disk space issues if you're storing large files
