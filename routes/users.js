const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const ArtistApplication = require('../models/ArtistApplication');
const { isLoggedIn } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import upload helper
const { createUpload, getStoragePath, deleteFileIfExists } = require('../utils/uploadHelper');

// Configure multer for profile image uploads
const upload = createUpload({
  uploadType: 'profiles',
  fileSize: 5 * 1024 * 1024, // 5MB limit
  filenameGenerator: (file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    return 'profile-' + uniqueSuffix + ext;
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// User profile page
router.get('/profile', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    // Check if user has an artist profile, regardless of role
    let artist = await Artist.findOne({ user: user._id });

    // Check if there's a mismatch between user role and artist profile and fix it
    if (user.role !== 'artist' && artist) {
      console.log(`Found mismatch: User ${user._id} has role ${user.role} but has an artist profile ${artist._id}`);

      // Fix the mismatch by deleting the artist profile
      const Concert = require('../models/Concert');
      const Content = require('../models/Content');

      await Concert.deleteMany({ artist: artist._id });
      await Content.deleteMany({ artist: artist._id });
      await Artist.findByIdAndDelete(artist._id);

      console.log(`Fixed mismatch: Deleted artist profile ${artist._id} for user ${user._id}`);

      // Set artist to null since we deleted it
      artist = null;
    } else if (user.role === 'artist' && !artist) {
      console.log(`Found mismatch: User ${user._id} has role 'artist' but no artist profile found`);

      // Fix the mismatch by creating an artist profile
      const newArtist = new Artist({
        user: user._id,
        stageName: user.name,
        genre: 'Hip Hop'
      });

      await newArtist.save();

      console.log(`Fixed mismatch: Created artist profile ${newArtist._id} for user ${user._id}`);

      // Set artist to the newly created artist
      artist = newArtist;
    }

    // Check if user has a pending artist application
    const pendingApplication = await ArtistApplication.findOne({
      user: user._id,
      status: 'pending'
    });

    // Get user's tickets for server-side rendering fallback
    const Ticket = require('../models/Ticket');
    const tickets = await Ticket.find({
      user: user._id,
      paymentStatus: 'completed'
    })
      .sort({ createdAt: -1 })
      .populate('concert');

    console.log('Found tickets for server-side rendering:', tickets.length);

    // Get artist's concerts for server-side rendering fallback
    let concerts = [];
    if (artist) {
      const Concert = require('../models/Concert');
      concerts = await Concert.find({
        artist: artist._id,
        $or: [
          { status: 'approved', date: { $gte: new Date() } },
          { status: 'pending' }
        ]
      })
        .sort({ date: 1 });

      console.log('Found concerts for server-side rendering:', concerts.length);
    }

    // Debug information
    console.log('User profile debug:');
    console.log('User role:', user.role);
    console.log('Has artist profile:', artist ? 'Yes' : 'No');
    console.log('Has pending application:', pendingApplication ? 'Yes' : 'No');
    console.log('Can become artist:', (user.role !== 'artist' && !artist && !pendingApplication) ? 'Yes' : 'No');

    res.render('users/profile', {
      user,
      artist,
      pendingApplication,
      canBecomeArtist: (user.role !== 'artist' && !artist && !pendingApplication),
      tickets,
      concerts
    });
  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/');
  }
});

// Edit profile page
router.get('/edit-profile', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    // Check if user is an artist
    let artist = null;
    if (user.role === 'artist') {
      artist = await Artist.findOne({ user: user._id });
    }

    res.render('users/edit-profile', { user, artist });
  } catch (error) {
    console.error('Edit profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/users/profile');
  }
});

// Update profile
router.post('/update-profile', isLoggedIn, upload.single('profileImage'), async (req, res) => {
  try {
    const { name, bio, city, instagram, twitter, youtube, spotify } = req.body;

    // Find user
    const user = await User.findById(req.session.user.id);

    // Update user fields
    user.name = name;
    user.bio = bio || '';
    user.city = city || '';
    user.socialLinks = {
      instagram: instagram || '',
      twitter: twitter || '',
      youtube: youtube || '',
      spotify: spotify || ''
    };

    // Update profile image if uploaded
    if (req.file) {
      // Delete old profile image if it's not the default
      if (user.profileImage && user.profileImage !== '/images/default-profile.png') {
        deleteFileIfExists(user.profileImage);
      }

      // Set new profile image using our helper
      user.profileImage = getStoragePath('profiles', req.file.filename);

      // Update session
      req.session.user.profileImage = user.profileImage;

      console.log(`Updated profile image for user ${user._id} to ${user.profileImage}`);
    }

    await user.save();

    // Update artist info if user is an artist
    if (user.role === 'artist') {
      const { stageName, genre, yearsActive, about } = req.body;

      const artist = await Artist.findOne({ user: user._id });

      if (artist) {
        artist.stageName = stageName || user.name;
        artist.genre = genre || 'Hip Hop';
        artist.yearsActive = yearsActive || 0;
        artist.about = about || '';

        await artist.save();
      }
    }

    // Update session name
    req.session.user.name = user.name;

    req.flash('success', 'Profile updated successfully');
    res.redirect('/users/profile');
  } catch (error) {
    console.error('Update profile error:', error);
    req.flash('error', 'Failed to update profile');
    res.redirect('/users/edit-profile');
  }
});

// Change password page
router.get('/change-password', isLoggedIn, (req, res) => {
  res.render('users/change-password');
});

// Change password process
router.post('/change-password', isLoggedIn, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('error', 'Please fill in all fields');
      return res.redirect('/users/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/users/change-password');
    }

    // Find user
    const user = await User.findById(req.session.user.id);

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/users/change-password');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    req.flash('success', 'Password changed successfully');
    res.redirect('/users/profile');
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error', 'Failed to change password');
    res.redirect('/users/change-password');
  }
});

// Confirm delete account page
router.get('/confirm-delete-account', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/users/profile');
    }

    res.render('users/confirm-delete-account', { user });
  } catch (error) {
    console.error('Confirm delete account error:', error);
    req.flash('error', 'Failed to load confirmation page');
    res.redirect('/users/profile');
  }
});

// Delete account
router.post('/delete-account', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/users/profile');
    }

    // Check if user is an artist
    if (user.role === 'artist') {
      // Find artist profile
      const artist = await Artist.findOne({ user: user._id });

      if (artist) {
        // Delete artist's concerts
        const Concert = require('../models/Concert');
        await Concert.deleteMany({ artist: artist._id });
        console.log(`Deleted all concerts for artist ${artist._id}`);

        // Delete artist's content
        const Content = require('../models/Content');
        await Content.deleteMany({ artist: artist._id });
        console.log(`Deleted all content for artist ${artist._id}`);

        // Delete artist profile
        await Artist.findByIdAndDelete(artist._id);
        console.log(`Deleted artist profile ${artist._id}`);
      }
    }

    // Delete user's tickets
    const Ticket = require('../models/Ticket');
    await Ticket.deleteMany({ user: user._id });
    console.log(`Deleted all tickets for user ${user._id}`);

    // Delete profile image if it's not the default
    if (user.profileImage && user.profileImage !== '/images/default-profile.png') {
      const oldImagePath = path.join(__dirname, '../public', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Delete user
    await User.findByIdAndDelete(userId);
    console.log(`User deleted their account: ${userId}`);

    // Clear session
    req.session.destroy();

    res.redirect('/');
  } catch (error) {
    console.error('Delete account error:', error);
    req.flash('error', 'Failed to delete account');
    res.redirect('/users/profile');
  }
});

// View public profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/');
    }

    // Check if user is an artist
    let artist = null;
    if (user.role === 'artist') {
      artist = await Artist.findOne({ user: user._id });
    }

    res.render('users/public-profile', { user, artist });
  } catch (error) {
    console.error('Public profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/');
  }
});

module.exports = router;
