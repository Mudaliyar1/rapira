require('dotenv').config();
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const Artist = require('../models/Artist');
const User = require('../models/User');

const TICKET_ID = '6aed6b3721b17fc127765f40';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const ticket = await Ticket.findById(TICKET_ID).populate({
    path: 'concert',
    populate: {
      path: 'artist',
      populate: { path: 'user' }
    }
  });

  console.log('Ticket ID:', ticket._id);
  console.log('Concert ID:', ticket.concert ? ticket.concert._id : null);
  
  if (ticket.concert && ticket.concert.artist) {
    const artist = ticket.concert.artist;
    console.log('Artist StageName:', artist.stageName);
    console.log('Artist Genre:', artist.genre);
    if (artist.user) {
      console.log('Artist User Name:', artist.user.name);
      console.log('Artist User ProfileImage:', artist.user.profileImage);
    }
  }

  // Also let's check all artists in database to see how they look across the site
  const artists = await Artist.find().populate('user').limit(5);
  console.log('\nSample Artists in DB:');
  artists.forEach(a => {
    console.log(`- StageName: "${a.stageName}", User: "${a.user ? a.user.name : 'none'}", ProfileImage: "${a.user ? a.user.profileImage : 'none'}", Genre: "${a.genre}"`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
