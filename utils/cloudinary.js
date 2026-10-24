// NEW Cloudinary helper utilities
const cloudinary = require('cloudinary').v2;

// Configure via environment variables (CLOUDINARY_URL or explicit values)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file buffer to Cloudinary using upload_stream.
 * @param {Buffer} buffer - File buffer from multer memory storage.
 * @param {object} options - Cloudinary upload options (resource_type, folder, transformation, etc.).
 * @returns {Promise<object>} Cloudinary upload result.
 */
function uploadFromBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    const streamOptions = { ...options, timeout: 120000 };

    let uploaderStream;
    if (options.resource_type === 'video') {
      streamOptions.chunk_size = 20000000; // 20MB chunks
      uploaderStream = cloudinary.uploader.upload_chunked_stream(streamOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    } else {
      uploaderStream = cloudinary.uploader.upload_stream(streamOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    }

    // Convert Buffer to Readable Stream to respect backpressure and prevent hanging
    const readableStream = new Readable();
    readableStream._read = () => { };
    readableStream.push(buffer);
    readableStream.push(null);

    readableStream.pipe(uploaderStream);
  });
}

/**
 * Destroy an asset on Cloudinary by public_id.
 * @param {string} publicId - Cloudinary public_id.
 * @param {string} resourceType - image|video|raw
 */
async function destroy(publicId, resourceType = 'image') {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Generate a transformed URL for a Cloudinary asset.
 * @param {string} publicId - Cloudinary public_id.
 * @param {object} options - transformation options.
 */
function generateUrl(publicId, options = {}) {
  if (!publicId) return null;
  return cloudinary.url(publicId, options);
}

module.exports = {
  cloudinary,
  uploadFromBuffer,
  destroy,
  generateUrl
};