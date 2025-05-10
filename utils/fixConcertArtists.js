require('dotenv').config();
const mongoose = require('mongoose');
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const User = require('../models/User');

async function fixConcertArtists() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');

    // Find all concerts
    const concerts = await Concert.find().populate({
      path: 'artist',
      populate: { path: 'user' }
    });

    console.log(`Found ${concerts.length} concerts`);
    let fixedCount = 0;

    // Check each concert
    for (const concert of concerts) {
      if (!concert.artist) {
        console.log(`Concert ${concert._id} has no artist reference`);
        // Find an admin user to assign as the artist
        const adminUser = await User.findOne({ role: 'admin' });
        
        if (adminUser) {
          // Check if admin already has an artist profile
          let adminArtist = await Artist.findOne({ user: adminUser._id });
          
          if (!adminArtist) {
            // Create an artist profile for the admin
            adminArtist = new Artist({
              user: adminUser._id,
              stageName: 'Rapira Admin',
              genre: 'Various',
              verified: true,
              about: 'This is a system-generated artist profile for concerts with missing artist references.'
            });
            await adminArtist.save();
            console.log(`Created new artist profile for admin: ${adminArtist._id}`);
          }
          
          // Update the concert with the admin artist
          concert.artist = adminArtist._id;
          await concert.save();
          console.log(`Fixed concert ${concert._id} by assigning admin artist ${adminArtist._id}`);
          fixedCount++;
        } else {
          console.log(`No admin user found to fix concert ${concert._id}`);
        }
      } else if (!concert.artist.user) {
        console.log(`Concert ${concert._id} has artist ${concert.artist._id} but no user reference`);
        // Find an admin user to assign as the artist's user
        const adminUser = await User.findOne({ role: 'admin' });
        
        if (adminUser) {
          // Update the artist with the admin user
          await Artist.findByIdAndUpdate(concert.artist._id, { user: adminUser._id });
          console.log(`Fixed artist ${concert.artist._id} by assigning admin user ${adminUser._id}`);
          fixedCount++;
        } else {
          console.log(`No admin user found to fix artist ${concert.artist._id}`);
        }
      }
    }

    console.log(`Fixed ${fixedCount} concerts/artists`);
    console.log('Done!');
  } catch (error) {
    console.error('Error fixing concert artists:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
fixConcertArtists();
