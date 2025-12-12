require('dotenv').config();
const mongoose = require('mongoose');
const ArtistStory = require('../models/ArtistStory');
const Media = require('../models/Media');
const { deleteMedia } = require('../utils/mediaService');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const now = new Date();

    const expired = await ArtistStory.find({ isActive: true, expiresAt: { $lte: now } });
    console.log(`Found ${expired.length} expired stories`);

    for (const s of expired) {
      s.isActive = false;
      await s.save();

      if (s.mediaPublicId) {
        const mediaDoc = await Media.findOne({ public_id: s.mediaPublicId });
        await deleteMedia(mediaDoc);
        console.log('Deleted Cloudinary media for story', s._id.toString());
      }
    }
  } catch (err) {
    console.error('Cleanup stories error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
