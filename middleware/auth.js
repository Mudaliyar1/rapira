// Authentication middleware
const Artist = require('../models/Artist');
const AdminPagePermission = require('../models/AdminPagePermission');
const AdminPage = require('../models/AdminPage');

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

  // Check if admin has permission to access a specific page
  hasPagePermission: (pagePath) => {
    return async (req, res, next) => {
      try {
        // Super admins always have access to all pages
        if (req.session.user && req.session.user.role === 'superAdmin') {
          return next();
        }

        // Regular admins need permission checks
        if (req.session.user && req.session.user.role === 'admin') {
          // Find the page by path
          const page = await AdminPage.findOne({ path: pagePath });

          if (!page) {
            console.error(`Page not found for path: ${pagePath}`);
            req.flash('error', 'Page not found');
            return res.redirect('/admin');
          }

          // If page is marked as always accessible, allow access
          if (page.alwaysAccessible) {
            return next();
          }

          // If page is super admin only, deny access
          if (page.superAdminOnly) {
            req.flash('error', 'This page is only accessible to Super Admins');
            return res.redirect('/admin/permission-denied');
          }

          // Check admin's permissions
          const permissions = await AdminPagePermission.findOne({ admin: req.session.user.id });

          // If no permissions document exists or no specific permission for this page,
          // deny access by default
          if (!permissions || !permissions.pagePermissions.get(page.slug)) {
            req.flash('error', 'You do not have permission to access this page');
            return res.redirect('/admin/permission-denied');
          }

          // Permission granted
          return next();
        }

        // Not an admin or super admin
        req.flash('error', 'You must be an admin to access this page');
        return res.redirect('/');
      } catch (error) {
        console.error('Error in hasPagePermission middleware:', error);
        req.flash('error', 'An error occurred while checking your permissions');
        return res.redirect('/admin');
      }
    };
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
