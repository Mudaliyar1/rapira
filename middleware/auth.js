// Authentication middleware
const Artist = require('../models/Artist');

module.exports = {
  // Check if user is logged in
  isLoggedIn: (req, res, next) => {
    if (req.session.user) {
      return next();
    }
    req.flash('error', 'You must be logged in to access this page');
    res.redirect('/auth/login');
  },

  // Check if user is an artist
  isArtist: (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'artist' || req.session.user.role === 'admin')) {
      return next();
    }
    req.flash('error', 'You must be an artist to access this page');
    res.redirect('/');
  },

  // Check if user is an admin
  isAdmin: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
      return next();
    }
    req.flash('error', 'You must be an admin to access this page');
    res.redirect('/');
  },

  // Check if user is not logged in (for login/register pages)
  isNotLoggedIn: (req, res, next) => {
    if (!req.session.user) {
      return next();
    }
    res.redirect('/');
  },

  // Check if artist can create concerts (Intermediate or Established level)
  canCreateConcert: async (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
      return next();
    }

    if (req.session.user && req.session.user.role === 'artist') {
      try {
        const artist = await Artist.findOne({ user: req.session.user.id });

        if (artist && (artist.artistLevel === 'Intermediate' || artist.artistLevel === 'Established')) {
          return next();
        }

        req.flash('error', 'You must be an Intermediate or Established artist to create concerts');
        return res.redirect('/learning');
      } catch (error) {
        console.error('Error in canCreateConcert middleware:', error);
        req.flash('error', 'An error occurred while checking your permissions');
        return res.redirect('/');
      }
    }

    req.flash('error', 'You must be an artist to access this page');
    res.redirect('/');
  },

  // Check if artist is at least Intermediate level
  isIntermediateArtist: async (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
      return next();
    }

    if (req.session.user && req.session.user.role === 'artist') {
      try {
        const artist = await Artist.findOne({ user: req.session.user.id });

        if (artist && (artist.artistLevel === 'Intermediate' || artist.artistLevel === 'Established')) {
          return next();
        }

        req.flash('error', 'You must be an Intermediate or Established artist to access this feature');
        return res.redirect('/learning');
      } catch (error) {
        console.error('Error in isIntermediateArtist middleware:', error);
        req.flash('error', 'An error occurred while checking your permissions');
        return res.redirect('/');
      }
    }

    req.flash('error', 'You must be an artist to access this page');
    res.redirect('/');
  },

  // Check if artist is Established level
  isEstablishedArtist: async (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
      return next();
    }

    if (req.session.user && req.session.user.role === 'artist') {
      try {
        const artist = await Artist.findOne({ user: req.session.user.id });

        if (artist && artist.artistLevel === 'Established') {
          return next();
        }

        req.flash('error', 'You must be an Established artist to access this feature');
        return res.redirect('/learning');
      } catch (error) {
        console.error('Error in isEstablishedArtist middleware:', error);
        req.flash('error', 'An error occurred while checking your permissions');
        return res.redirect('/');
      }
    }

    req.flash('error', 'You must be an artist to access this page');
    res.redirect('/');
  }
};
