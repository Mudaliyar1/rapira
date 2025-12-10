# RAPIRA Media Backup & Restore System Documentation

## Overview

This document explains Rapira's MongoDB-backed **global media persistence system**. It ensures that ALL uploaded files (images, videos, audio, PDFs, documents) survive server restarts on ephemeral filesystems (like Render) by automatically backing them up to MongoDB and restoring them on startup.

---

## Architecture

### Components

1. **MediaBackup Model** (`models/MediaBackup.js`)
   - Mongoose schema for storing file metadata and binary data in MongoDB
   - Supports all file types (image, video, audio, pdf, document, other)
   - Tracks ownership (artist, venue, admin, user, system)
   - Indexes for fast queries

2. **Media Backup Service** (`utils/mediaBackupService.js`)
   - Core utility functions for backup and restore operations
   - Functions:
     - `backupMediaToMongo(file, options)` - Backup a single file after upload
     - `restoreAllMediaOnStartup()` - Restore all files on server boot
     - `scanAndBackupUploadsFolder()` - Scan disk and backup missing files (admin action)
     - `restoreAllMediaFromMongo()` - Restore all files from MongoDB (admin action)
     - `getMediaStats()` - Get media statistics for dashboard

3. **Admin Media Routes** (`routes/adminMedia.js`)
   - Express routes for admin media management
   - Endpoints:
     - `GET /admin/media` - Dashboard
     - `POST /admin/media/backup-now` - Trigger scan & backup
     - `POST /admin/media/restore-all` - Trigger restore from MongoDB
     - `POST /admin/media/:id/delete` - Soft delete a media backup
     - `GET /admin/media/download-info` - Export metadata as JSON

4. **Admin Media Controller** (`controllers/adminMediaController.js`)
   - Handles media management dashboard and operations
   - Renders statistics and media list with pagination
   - Supports filtering by module, fileType, ownerType

5. **Admin Media View** (`views/admin/media-management.ejs`)
   - Dashboard UI with statistics cards
   - Media list table with pagination
   - Filter controls
   - Action buttons for scan, backup, restore

### How It Works

#### On Upload (Artist, Venue, Admin)

1. File is uploaded via Multer and saved to `/uploads/{module}/{filename}`
2. Upload handler calls `backupMediaToMongo(file, options)`
3. Media Backup Service:
   - Reads file from disk into a Buffer
   - Creates/updates MediaBackup document in MongoDB
   - Stores binary data, path, metadata
4. File remains available in `/uploads` for immediate use
5. If backup fails, upload still succeeds (graceful degradation)

#### On Server Startup

1. Server connects to MongoDB
2. `restoreAllMediaOnStartup()` is called automatically
3. Service iterates all MediaBackup documents
4. For each file:
   - Check if file exists on disk
   - If missing or wrong size, restore from MongoDB Buffer
   - Create directory structure as needed
   - Write file to `/uploads/{filePath}`
5. Server continues with normal startup

#### Admin Actions

**Scan & Backup Now:**
- Admin triggers via dashboard
- Scans entire `/uploads` folder recursively
- For each file not in MediaBackup, backs it up
- Useful after manual file additions

**Restore All Media:**
- Admin triggers via dashboard
- Restores all non-deleted MediaBackup documents to `/uploads`
- Overwrites any existing files
- Useful if `/uploads` gets wiped

---

## File Structure

```
models/
  └── MediaBackup.js                    ✅ NEW

utils/
  └── mediaBackupService.js              ✅ NEW

routes/
  └── adminMedia.js                      ✅ NEW
  └── adminVenues.js                     ✅ MODIFIED (added backup calls)
  └── [others can also be modified to add backup calls]

controllers/
  └── adminMediaController.js            ✅ NEW

views/
  └── admin/
      └── media-management.ejs           ✅ NEW

app.js                                   ✅ MODIFIED
  - Import mediaBackupService
  - Call restoreAllMediaOnStartup() on startup
  - Mount adminMediaRoutes at /admin/media
```

---

## Database Schema (MediaBackup)

```javascript
{
  _id: ObjectId,
  
  // File info
  fileName: String,                    // "artist-xyz.jpg"
  filePath: String,                    // "artist/123/artist-xyz.jpg"
  mimeType: String,                    // "image/jpeg"
  fileType: String,                    // "image" | "video" | "audio" | "pdf" | "document" | "other"
  size: Number,                        // bytes
  
  // Organization
  module: String,                      // "artistContent" | "venueMedia" | "adminMedia" | ...
  ownerType: String,                   // "artist" | "venue" | "admin" | "user" | "system"
  ownerId: ObjectId,                   // Reference to User/Venue/Artist (optional)
  
  // Binary data
  data: Buffer,                        // Raw file content
  
  // Metadata
  uploadedOn: Date,
  lastRestoredOn: Date,
  isDeleted: Boolean,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `filePath` (unique)
- `(module, fileType)`
- `(ownerType, ownerId)`
- `uploadedOn`
- `(isDeleted, filePath)`

---

## Integration Examples

### Adding Backup to an Upload Route

In any upload route file (e.g., `routes/artists.js`):

```javascript
// 1. Import the service at the top
const { backupMediaToMongo } = require('../utils/mediaBackupService');

// 2. In the POST upload handler, after the file is saved:
router.post('/upload-content', isLoggedIn, isArtist, contentUpload.fields([...]), async (req, res) => {
  try {
    // ... existing upload logic ...
    
    // NEW: Backup uploaded files to MongoDB
    if (req.files && req.files.thumbnailImage) {
      req.files.thumbnailImage.forEach(file => {
        backupMediaToMongo(file, {
          module: 'artistContent',
          ownerType: 'artist',
          ownerId: artist._id
        }).catch(err => {
          console.error('Error backing up media:', err.message);
          // Continue without blocking upload
        });
      });
    }
    
    res.redirect('/artists/dashboard');
  } catch (error) {
    // ... error handling ...
  }
});
```

**Parameters for `backupMediaToMongo()`:**
- `file` - Multer file object (req.file or from req.files array)
- `options.module` - Where the file comes from (required)
  - Values: `'artistContent'`, `'venueMedia'`, `'adminMedia'`, `'userProfile'`, `'learningModule'`, etc.
- `options.ownerType` - Who owns it (required)
  - Values: `'artist'`, `'venue'`, `'admin'`, `'user'`, `'system'`
- `options.ownerId` - ID of the owner (optional, but recommended)

---

## Local Development Setup

### Prerequisites

- Node.js >= 14
- MongoDB Atlas (or local MongoDB)
- Existing Rapira project

### Installation

1. **Create the model file:**
   ```bash
   touch models/MediaBackup.js
   # [Copy content from implementation]
   ```

2. **Create the service file:**
   ```bash
   touch utils/mediaBackupService.js
   # [Copy content from implementation]
   ```

3. **Create routes and controller:**
   ```bash
   touch routes/adminMedia.js controllers/adminMediaController.js views/admin/media-management.ejs
   # [Copy content from implementation]
   ```

4. **Update app.js:**
   - Import mediaBackupService and adminMediaRoutes
   - Add startup restore call
   - Register /admin/media route

5. **Update existing upload routes** (optional but recommended):
   - Add `backupMediaToMongo()` calls in artist, venue, and admin upload handlers
   - See Integration Examples above

6. **Test locally:**
   ```bash
   npm start
   
   # Watch console for:
   # ✓ === MEDIA RESTORE ON STARTUP ===
   # ✓ Media restore summary: X restored, Y skipped, Z errors
   # ✓ === END MEDIA RESTORE ===
   ```

7. **Visit admin dashboard:**
   ```
   http://localhost:3000/admin/media
   ```

### Testing Scenarios

**Scenario 1: Upload + Restore**
1. Upload a venue image in admin panel
2. Check browser console - should see "Media backed up to MongoDB: ..."
3. Delete `/public/uploads` folder
4. Restart server with `npm start`
5. Check `/admin/media` dashboard - images should be listed
6. Verify files are restored to `/public/uploads` on disk

**Scenario 2: Admin Backup Scan**
1. Manually add files to `/public/uploads` (copy files directly)
2. Go to `/admin/media` dashboard
3. Click "Scan & Backup Now"
4. Should see success message with count of backed up files
5. Refresh dashboard - files should now be listed

**Scenario 3: Admin Restore**
1. Go to `/admin/media` dashboard
2. Delete `/public/uploads` folder
3. Click "Restore All Media"
4. Should see success message with count of restored files
5. Verify files are restored to `/public/uploads`

---

## Render Deployment

### Key Changes for Render

1. **No code changes needed** - system works as-is!

2. **Environment Variables** (in Render dashboard):
   - `MONGODB_URI` - Your MongoDB Atlas connection string (should already exist)
   - `NODE_ENV=production`

3. **How it works on Render:**

   **First Deploy:**
   - `/uploads` folder doesn't exist (Render is ephemeral)
   - Server starts
   - `restoreAllMediaOnStartup()` runs
   - All media from MongoDB is restored to `/uploads`
   - Media is available to users

   **New Upload:**
   - User uploads file
   - Saved to `/uploads/{path}` (ephemeral, will disappear)
   - `backupMediaToMongo()` stores in MongoDB (persistent!)
   - Both local and live environments share same MongoDB

   **After Restart/Redeploy:**
   - `/uploads` is wiped (ephemeral filesystem)
   - Server restarts
   - `restoreAllMediaOnStartup()` runs again
   - All media restored from MongoDB
   - No data loss!

### Deployment Checklist

- [ ] Ensure `MONGODB_URI` points to MongoDB Atlas (not local)
- [ ] Verify all upload routes have backup calls integrated (or at minimum venue uploads)
- [ ] Test locally first with same MongoDB connection
- [ ] Deploy code to Render
- [ ] Check Render logs for startup messages:
  ```
  📁 === MEDIA RESTORE ON STARTUP ===
  ✓ Uploads directory ready: ...
  Found X media items in MongoDB backup
  📊 Restore Complete: Y restored, Z skipped, W errors
  === END MEDIA RESTORE ===
  ```
- [ ] Upload a test file and verify it appears in admin media dashboard
- [ ] Trigger manual restart on Render and verify files are still accessible

---

## Admin Dashboard Usage

### Media Management Page (`/admin/media`)

**Statistics Cards:**
- Total Media Items - Overall count and total size
- Images - Count of image files
- Videos - Count of video files
- Audio - Count of audio files

**Operations:**
- **Scan & Backup Now** - Scan `/uploads` and backup any files not in MongoDB
- **Restore All Media** - Restore all media from MongoDB to `/uploads`
- **Download Info (JSON)** - Export media metadata

**Filters:**
- Module (artistContent, venueMedia, adminMedia, userProfile, etc.)
- File Type (image, video, audio, pdf, document, other)
- Owner Type (artist, venue, admin, user, system)

**Media List:**
- Paginated table with 20 items per page
- Shows: filename, filePath, module, owner, type, size, upload time, last restore time
- Delete button for each item (soft delete)

---

## API Reference

### `mediaBackupService.backupMediaToMongo(file, options)`

Backs up a single uploaded file to MongoDB.

**Parameters:**
- `file` (Object) - Multer file object
  - `file.filename` - Filename
  - `file.destination` - Directory path
  - `file.mimetype` - MIME type
  - `file.size` - File size in bytes
- `options` (Object) - Metadata
  - `options.module` (String, required) - Origin module
  - `options.ownerType` (String, optional) - Owner type
  - `options.ownerId` (ObjectId, optional) - Owner ID

**Returns:** Promise<MediaBackup | null>

**Usage:**
```javascript
await backupMediaToMongo(req.file, {
  module: 'venueMedia',
  ownerType: 'venue',
  ownerId: venue._id
});
```

---

### `mediaBackupService.restoreAllMediaOnStartup()`

Restores all non-deleted media files from MongoDB to `/uploads`.

Called automatically on server startup. Can also be called manually.

**Parameters:** None

**Returns:** Promise<Object>
```javascript
{
  restored: Number,      // Files restored
  skipped: Number,       // Files already on disk
  errors: Number,        // Failed restores
  total: Number          // Total items in MongoDB
}
```

**Usage:**
```javascript
const result = await restoreAllMediaOnStartup();
console.log(`Restored: ${result.restored}, Skipped: ${result.skipped}`);
```

---

### `mediaBackupService.scanAndBackupUploadsFolder()`

Scans `/uploads` folder and backs up any files not in MongoDB.

Useful as a safety net or after manual file additions.

**Parameters:** None

**Returns:** Promise<Object>
```javascript
{
  scanned: Number,      // Total files scanned
  backedUp: Number,     // Newly backed up files
  skipped: Number,      // Already in MongoDB
  errors: Number        // Errors during backup
}
```

**Usage:**
```javascript
const result = await scanAndBackupUploadsFolder();
console.log(`Backed up: ${result.backedUp} new files`);
```

---

### `mediaBackupService.getMediaStats()`

Gets statistics about stored media for dashboard display.

**Parameters:** None

**Returns:** Promise<Object>
```javascript
{
  total: Number,           // Total items
  byType: Object,          // Count by type {image: 5, video: 2, ...}
  byModule: Object,        // Count by module
  byOwnerType: Object,     // Count by owner type
  totalSizeBytes: Number   // Total size in bytes
}
```

---

## Monitoring & Troubleshooting

### Server Logs

Watch for these messages:

**Successful startup restore:**
```
📁 === MEDIA RESTORE ON STARTUP ===
✓ Uploads directory ready: /app/public/uploads
Found 42 media items in MongoDB backup
✓ Restored: xyz/image.jpg
✓ Restored: venue/abc.png
...
📊 Restore Complete: 42 restored, 0 skipped, 0 errors
=== END MEDIA RESTORE ===
```

**Successful backup:**
```
✓ Media backed up to MongoDB: artist/123/image.jpg (image, 2048576 bytes)
```

**Errors:**
```
✗ Error backing up media to MongoDB: ENOENT: no such file or directory
✗ Error restoring media: artist/missing.jpg Error: ...
```

### Common Issues

**Issue: "Media restored but not showing in browser"**
- Check: Are files actually on disk in `/uploads`?
- Check: Are file paths in MediaBackup documents correct?
- Check: Do URLs in EJS views match file paths?
- Solution: Verify MediaBackup.filePath format matches /uploads subdirectory structure

**Issue: "File uploaded but not appearing in MongoDB"**
- Check: Is `backupMediaToMongo()` being called in the upload route?
- Check: Is MongoDB connection working? (Check other models)
- Check: File size limits - is file too large?
- Solution: Check logs for backup errors, add more detailed logging

**Issue: "Restore on startup takes too long"**
- Check: How many files are in MongoDB?
- Check: What's the total size?
- Solution: May need to increase startup timeout in Render settings, or implement progress streaming

**Issue: "Out of memory during restore"**
- Cause: MongoDB buffers too large, many files
- Solution: Implement batched restore instead of all-at-once (see enhancement section)

---

## Performance Considerations

### Database Size

Each MediaBackup document includes the full binary file data in the `data` field.

**Estimate:** 
- 100 venue images (avg 2 MB each) = 200 MB
- 1000 user uploads (avg 1 MB each) = 1 GB
- MongoDB Atlas Free tier = 512 MB storage

**Recommendation:**
- Monitor `db.mediaBackups.stats().size` regularly
- Implement retention policies (soft delete old media)
- Consider tiering: current year in MongoDB, older in archive storage

### Index Strategy

Included indexes:
- `filePath` (unique) - Fast lookups by path
- `(module, fileType)` - Dashboard filtering
- `(ownerType, ownerId)` - Owner-specific queries
- `uploadedOn` - Recent uploads
- `(isDeleted, filePath)` - Active files only

These are optimal for typical usage. Add more if specific queries are slow.

### Backup/Restore Speed

**Optimization:** Restore happens in parallel, but one file at a time (sequential for safety).

Could optimize with:
- Batch database queries (get 10 files per query)
- Parallel writes to disk (careful with race conditions)
- Stream large files instead of buffering

---

## Future Enhancements

1. **Compression:** Gzip files before storing in MongoDB to reduce size
2. **Versioning:** Keep multiple versions of files with auto-delete of old versions
3. **Clean up:** Automatically delete MediaBackup for deleted entities (via cascade)
4. **Archival:** Move old files to S3 or cold storage, keep only recent in MongoDB
5. **Sync status:** Track which files are in both MongoDB and `/uploads`
6. **Batch operations:** Import/export media between environments
7. **CDN integration:** Serve frequently accessed files from CDN
8. **Duplicate detection:** Hash files to avoid storing duplicates

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         RAPIRA                               │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────────┐         ┌──────────────────┐
    │   Artist Upload  │         │  Venue Upload    │
    │  (e.g., music)   │         │  (e.g., images)  │
    └────────┬─────────┘         └────────┬─────────┘
             │                            │
             │  req.file                  │  req.files
             │                            │
             ▼                            ▼
    ┌────────────────────────────────────────────┐
    │      Multer - Save to /uploads/{path}      │
    └────────────┬───────────────────────────────┘
                 │
                 │  [Existing flow continues]
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │  backupMediaToMongo(file, options)         │
    │  [NEW: mediaBackupService]                 │
    └────────────┬───────────────────────────────┘
                 │
                 │  Read file from disk into Buffer
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │   MediaBackup Document                     │
    │   - fileName, filePath                     │
    │   - mimeType, size                         │
    │   - data: Buffer (binary)                  │
    │   - module, ownerType, ownerId             │
    │   - metadata timestamps                    │
    └────────────┬───────────────────────────────┘
                 │
                 │  [Persisted in MongoDB]
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │      On Server Restart:                    │
    │      restoreAllMediaOnStartup()            │
    │                                            │
    │   1. Query all non-deleted MediaBackups    │
    │   2. For each: restore data Buffer to disk │
    │   3. Repopulate /uploads/{path}            │
    │   4. Update lastRestoredOn timestamp       │
    └────────────┬───────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │  /uploads folder fully restored            │
    │  Media available immediately               │
    │  URLs like /uploads/artist/xyz.jpg work    │
    └────────────────────────────────────────────┘

    ┌────────────────────────────────────────────┐
    │  Admin Dashboard: /admin/media             │
    │  - View all media with stats               │
    │  - Trigger Scan & Backup                   │
    │  - Trigger Restore All                     │
    │  - Filter by module/type/owner             │
    │  - Download metadata                       │
    └────────────────────────────────────────────┘
```

---

## Summary

The Media Backup & Restore system provides **enterprise-grade media persistence** for Rapira by:

✅ **Automatic backup** - Every upload backed up to MongoDB simultaneously  
✅ **Automatic restore** - All media restored on server startup  
✅ **Ephemeral-proof** - Works perfectly on Render's ephemeral filesystem  
✅ **Admin-friendly** - Dashboard for monitoring and manual operations  
✅ **Non-breaking** - Integrates with existing upload flows gracefully  
✅ **Scalable** - MongoDB indexes optimized for queries  

No more lost media on server restarts!
