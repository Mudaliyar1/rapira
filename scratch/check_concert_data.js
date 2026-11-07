const mongoose = require('mongoose');
require('dotenv').config();
const Concert = require('../models/Concert');
const Venue = require('../models/Venue');
const Artist = require('../models/Artist');
const User = require('../models/User');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const concerts = await Concert.find({ status: 'approved' })
    .populate({
      path: 'artist',
      populate: { path: 'user', select: 'name profileImage' }
    })
    .populate('venue')
    .sort({ date: 1 })
    .limit(5);

  console.log(`Found ${concerts.length} concerts:`);
  for (const c of concerts) {
    console.log({
      id: c._id.toString(),
      title: c.title,
      posterImage: c.posterImage,
      date: c.date,
      time: c.time,
      isPaid: c.isPaid,
      price: c.price,
      city: c.city,
      venue: c.venue ? {
        id: c.venue._id,
        name: c.venue.name,
        address: c.venue.address,
        city: c.venue.city,
        state: c.venue.state,
        pincode: c.venue.pincode,
        googleMapsLink: c.venue.googleMapsLink
      } : null,
      artist: c.artist ? {
        id: c.artist._id,
        verified: c.artist.verified,
        genre: c.artist.genre,
        user: c.artist.user ? {
          name: c.artist.user.name,
          profileImage: c.artist.user.profileImage
        } : null
      } : null
    });
  }

  await mongoose.disconnect();
}

check().catch(console.error);
