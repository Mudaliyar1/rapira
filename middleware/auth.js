// Authentication middleware
const Artist = require('../models/Artist');

module.exports = {
  // Check if user is logged in
  isLoggedIn: (req, res, next) => {
    // Check if session exists and has user data
    if (req.session && req.session.user) {
      // Log session info for debugging
      console.log('Session check - User is logged in:', {
        email: req.session.user.email,
        role: req.session.user.role,
        sessionID: req.session.id,
        cookieMaxAge: req.session.cookie.maxAge
      });
      return next();
    }

    // Log failed session check
    console.log('Session check failed - No valid session:', {
      sessionExists: !!req.session,
      hasUser: req.session && !!req.session.user,
      sessionID: req.session ? req.session.id : 'none'
    });

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

  // Clear the login error message from flash (for public auth pages)
  clearLoginError: (req, res, next) => {
    // Get current flash messages
    const flash = req.session.flash || {};
    
    // If there's an error message that matches the login required message, clear it
    if (flash.error && Array.isArray(flash.error)) {
      flash.error = flash.error.filter(msg => msg !== 'You must be logged in to access this page');
    } else if (flash.error === 'You must be logged in to access this page') {
      delete flash.error;
    }
    
    req.session.flash = flash;
    next();
  },

  // Check if user is an admin or super admin
  isAdmin: (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'superAdmin')) {
      return next();
    }
    req.flash('error', 'You must be an admin to access this page');
    res.redirect('/');
  },

  // Check if user is a super admin
  isSuperAdmin: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'superAdmin') {
      return next();
    }
    req.flash('error', 'You must be a super admin to access this page');
    res.redirect('/admin');
  },

  // Check if user is not logged in (for login/register pages)
  isNotLoggedIn: (req, res, next) => {
    // Check if session exists and has user data
    if (!req.session || !req.session.user) {
      // Log session info for debugging
      console.log('Not logged in check - User is not logged in:', {
        sessionExists: !!req.session,
        sessionID: req.session ? req.session.id : 'none'
      });
      return next();
    }

    // Log session info for already logged in users
    console.log('Not logged in check - User is already logged in:', {
      email: req.session.user.email,
      role: req.session.user.role,
      sessionID: req.session.id
    });

    // If user is already logged in, redirect to home
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