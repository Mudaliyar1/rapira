const mongoose = require('mongoose');
const ArtistPost = require('./models/ArtistPost');

mongoose.connect('mongodb://localhost:27017/rapira');

setTimeout(async () => {
  try {
    const post = await ArtistPost.findById('693c734d33d3831597ae7a9d').populate('artist', 'stageName _id');
    if (post) {
      console.log('Post found!');
      console.log('Artist ID:', post.artist?._id);
      console.log('Artist Stage Name:', post.artist?.stageName);
      console.log('isApproved:', post.isApproved);
      console.log('isActive:', post.isActive);
      console.log('rejectionReason:', post.rejectionReason);
    } else {
      console.log('Post not found');
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit();
}, 1000);
