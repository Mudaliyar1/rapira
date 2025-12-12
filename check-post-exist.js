const mongoose = require('mongoose');
const ArtistPost = require('./models/ArtistPost');

mongoose.connect('mongodb://localhost:27017/rapira');

setTimeout(async () => {
  try {
    const post = await ArtistPost.findById('693c7c8a7450b4d66042c611')
      .populate('artist', 'stageName profileImage genre')
      .populate('likes', 'name');
    
    if (post) {
      console.log('Post found!');
      console.log('isApproved:', post.isApproved);
      console.log('isActive:', post.isActive);
    } else {
      console.log('Post NOT found in database');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit();
}, 1000);
