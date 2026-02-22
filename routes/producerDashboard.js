const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const UserRole = require('../models/UserRole');
const Artist = require('../models/Artist');
const ArtistPost = require('../models/ArtistPost');

const requireProducerRole = async (req, res, next) => {
  try {
    const producerRole = await UserRole.findOne({ user: req.session.user.id }).populate('role');
    const userRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
    const hasProducerRole = userRoles.some((entry) => entry.role && entry.role.name && entry.role.name.toLowerCase() === 'producer');

    if (!producerRole && !hasProducerRole) {
      req.flash('error', 'You do not have producer access yet.');
      return res.redirect('/producer-applications/apply');
    }

    if (!hasProducerRole) {
      req.flash('error', 'You do not have producer access yet.');
      return res.redirect('/producer-applications/apply');
    }

    next();
  } catch (error) {
    console.error('Producer role middleware error:', error);
    req.flash('error', 'Failed to verify producer access');
    res.redirect('/users/profile');
  }
};

router.get('/', isLoggedIn, requireProducerRole, async (req, res) => {
  try {
    const { location } = req.query;

    // Get all artists (not just those with roles)
    let artistQuery = Artist.find();

    // Filter by location if specified
    if (location) {
      artistQuery = artistQuery.where('state', location);
    }

    const artists = await artistQuery
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get unique locations for filter
    const allArtists = await Artist.find().select('state').distinct('state');
    const locations = [...new Set(allArtists)].filter(Boolean).sort();

    res.render('producer/dashboard', {
      layout: false,
      title: 'Producer Dashboard',
      currentPath: '/producer-dashboard',
      artists,
      locations,
      selectedLocation: location || '',
      producerUser: req.session.user
    });
  } catch (error) {
    console.error('Producer dashboard error:', error);
    req.flash('error', 'Failed to load producer dashboard');
    res.redirect('/users/profile');
  }
});

module.exports = router;
