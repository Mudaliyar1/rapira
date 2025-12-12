const mongoose = require('mongoose');
const ArtistPost = require('./models/ArtistPost');

mongoose.connect('mongodb://localhost:27017/rapira');

setTimeout(async () => {
  try {
    const post = await ArtistPost.findById('693c76fc9d9482c2399003e0')
      .populate('artist', 'stageName profileImage genre')
      .populate('likes', 'name');
    
    if (post) {
      console.log('Post found!');
      console.log('isApproved:', post.isApproved);
      console.log('isActive:', post.isActive);
      console.log('media:', post.media);
      console.log('artist:', post.artist);
    } else {
      console.log('Post not found');
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit();
}, 1000);
