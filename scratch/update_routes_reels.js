const fs = require('fs');

const p = 'routes/index.js';
let content = fs.readFileSync(p, 'utf8');

const target = `    const formattedReels = homeReels.map(reel => ({
      _id: reel._id,
      media: reel.media,
      artist: {
        stageName: reel.artistData.stageName,
        profileImage: reel.artistUser ? reel.artistUser.profileImage : '/images/default-profile.svg'
      }
    }));`;

const replacement = `    const formattedReels = homeReels.map(reel => ({
      _id: reel._id,
      media: reel.media,
      caption: reel.caption || '',
      likesCount: reel.likesCount || (reel.likes ? reel.likes.length : 0),
      commentsCount: reel.comments ? reel.comments.length : 0,
      artist: {
        _id: reel.artistData ? reel.artistData._id : '',
        stageName: reel.artistData ? reel.artistData.stageName : 'Artist',
        verified: reel.artistData ? (reel.artistData.verified || false) : false,
        profileImage: reel.artistUser ? reel.artistUser.profileImage : '/images/default-profile.svg'
      }
    }));`;

// Normalize both to \n for matching, then write
const normalizedContent = content.replace(/\r\n/g, '\n');
if (normalizedContent.includes(target)) {
  const updated = normalizedContent.replace(target, replacement);
  fs.writeFileSync(p, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated routes/index.js!');
} else {
  console.log('Target not found in routes/index.js');
}

