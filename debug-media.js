const mongoose = require('mongoose');
require('dotenv').config();

const Media = require('./models/Media');
const User = require('./models/User');
const Artist = require('./models/Artist');

async function debugMedia() {
  try {
    console.log('\n=== DEBUGGING MEDIA SYSTEM ===\n');
    
    // Check total media count
    const totalCount = await Media.countDocuments();
    console.log(`📊 Total Media Records: ${totalCount}`);
    
    // Check media by type
    const imageCount = await Media.countDocuments({ resource_type: 'image' });
    const videoCount = await Media.countDocuments({ resource_type: 'video' });
    const audioCount = await Media.countDocuments({ resource_type: 'video', format: 'mp3' });
    console.log(`🖼️  Images: ${imageCount}`);
    console.log(`🎬 Videos: ${videoCount}`);
    console.log(`🎵 Audio: ${audioCount}`);
    
    // Check media by module
    console.log('\n📁 Media by Module:');
    const mediaByModule = await Media.aggregate([
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    mediaByModule.forEach(m => {
      console.log(`   ${m._id || 'null'}: ${m.count}`);
    });
    
    // Check ownerId distribution
    console.log('\n👤 Media ownerId Status:');
    const withOwnerId = await Media.countDocuments({ ownerId: { $exists: true, $ne: null } });
    const withoutOwnerId = await Media.countDocuments({ $or: [{ ownerId: null }, { ownerId: { $exists: false } }] });
    console.log(`   With ownerId: ${withOwnerId}`);
    console.log(`   Without ownerId: ${withoutOwnerId}`);
    
    // Search for user with email
    console.log('\n🔍 Searching for user with email "vijaymudaliyar@gmail.com":');
    const user = await User.findOne({ email: 'vijaymudaliyar@gmail.com' }).lean();
    if (user) {
      console.log(`   ✅ Found user: ${user.email} (ID: ${user._id})`);
      
      // Find media by this user
      const userMedia = await Media.find({ ownerId: user._id }).select('public_id resource_type module ownerType ownerId').lean();
      console.log(`   📊 Media for this user: ${userMedia.length}`);
      if (userMedia.length > 0) {
        console.log('   Sample media:');
        userMedia.slice(0, 3).forEach(m => {
          console.log(`     - ${m.public_id} (${m.resource_type}/${m.module})`);
        });
      }
    } else {
      console.log(`   ❌ No user found with email "vijaymudaliyar@gmail.com"`);
      
      // Show available users
      const users = await User.find().select('email username _id').lean();
      console.log(`\n   📋 Available users: ${users.length}`);
      users.slice(0, 5).forEach(u => {
        console.log(`     - ${u.email} (${u.username || 'no username'})`);
      });
    }
    
    // Check artists
    console.log('\n🎤 Searching for artist with email "vijaymudaliyar@gmail.com":');
    const artist = await Artist.findOne({ email: 'vijaymudaliyar@gmail.com' }).lean();
    if (artist) {
      console.log(`   ✅ Found artist: ${artist.stageName} (${artist.email}) (ID: ${artist._id})`);
      
      const artistMedia = await Media.find({ ownerId: artist._id }).select('public_id resource_type module ownerType ownerId').lean();
      console.log(`   📊 Media for this artist: ${artistMedia.length}`);
      if (artistMedia.length > 0) {
        console.log('   Sample media:');
        artistMedia.slice(0, 3).forEach(m => {
          console.log(`     - ${m.public_id} (${m.resource_type}/${m.module})`);
        });
      }
    } else {
      console.log(`   ❌ No artist found with email "vijaymudaliyar@gmail.com"`);
      
      // Show available artists
      const artists = await Artist.find().select('email stageName _id').lean();
      console.log(`\n   🎤 Available artists: ${artists.length}`);
      artists.slice(0, 5).forEach(a => {
        console.log(`     - ${a.stageName} (${a.email})`);
      });
    }
    
    // Sample some media records
    console.log('\n📋 Sample Media Records:');
    const samples = await Media.find().select('public_id module ownerType ownerId resource_type bytes').limit(5).lean();
    samples.forEach(m => {
      console.log(`   ${m.public_id}`);
      console.log(`     Module: ${m.module || 'null'}`);
      console.log(`     Owner: ${m.ownerType}/${m.ownerId || 'null'}`);
      console.log(`     Type: ${m.resource_type} (${m.bytes} bytes)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugMedia();
