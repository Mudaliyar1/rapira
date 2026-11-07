const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkPosts() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rapira';
  await mongoose.connect(mongoUri);

  const ArtistPost = require('../models/ArtistPost');
  const posts = await ArtistPost.find({
    isActive: true,
    isApproved: true,
    'media.mediaType': { $in: ['video', 'audio'] }
  }).lean();

  console.log(`Found ${posts.length} posts`);
  posts.forEach((p, idx) => {
    console.log(`\n--- Post #${idx + 1} (${p._id}) ---`);
    console.log('MediaType:', p.media ? p.media.mediaType : 'none');
    console.log('MediaUrl:', p.media ? p.media.url : 'none');
    console.log('ThumbnailUrl:', p.media ? p.media.thumbnailUrl : 'none');
    console.log('Caption:', p.caption ? p.caption.substring(0, 50) : '');
  });

  await mongoose.disconnect();
}

checkPosts().catch(console.error);
