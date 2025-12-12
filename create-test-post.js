const mongoose = require('mongoose');
const ArtistPost = require('./models/ArtistPost');
const Artist = require('./models/Artist');

mongoose.connect('mongodb://localhost:27017/rapira');

setTimeout(async () => {
  try {
    // Find an artist
    const artist = await Artist.findOne().limit(1);
    
    if (!artist) {
      console.log('No artists found');
      process.exit();
    }

    // Create a test post
    const post = new ArtistPost({
      artist: artist._id,
      media: {
        url: 'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1765570299/rapira/artist-posts/images/test.png',
        mediaType: 'image',
        publicId: 'rapira/artist-posts/images/test'
      },
      caption: 'This is a test post! Love hip-hop music 🎤',
      hashtags: ['hiphop', 'music', 'rapira'],
      likesCount: 5,
      shares: 2,
      isActive: true,
      isApproved: true,
      approvedBy: artist._id
    });

    await post.save();
    console.log('Test post created!');
    console.log('Post ID:', post._id);
    console.log('Artist:', artist.stageName);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit();
}, 1000);
