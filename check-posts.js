const mongoose = require('mongoose');
const ArtistPost = require('./models/ArtistPost');

mongoose.connect('mongodb://localhost:27017/rapira');

setTimeout(async () => {
  try {
    const posts = await ArtistPost.find().populate('artist', 'stageName');
    console.log('Total posts:', posts.length);
    posts.forEach(p => {
      console.log(`- ${p._id}:`);
      console.log(`  isApproved: ${p.isApproved}`);
      console.log(`  isActive: ${p.isActive}`);
      console.log(`  artist: ${p.artist?.stageName || 'N/A'}`);
      console.log(`  rejectionReason: ${p.rejectionReason || 'none'}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit();
}, 1000);
