const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const ArtistApplication = require('../models/ArtistApplication');
const VenueRequest = require('../models/VenueRequest');
const { isLoggedIn } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const Media = require('../models/Media');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmail } = require('../utils/brevoEmailService');
const DeletedAccount = require('../models/DeletedAccount');

// Configure multer for profile image uploads (memory → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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
      .populate({
        path: 'concert',
        populate: { path: 'venue', select: 'name address city' }
      });

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
        .sort({ date: 1 })
        .populate('venue', 'name address city');

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
      console.log('📸 Profile image upload started:', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      
      try {
        if (user.profileMedia) {
          console.log('🗑️ Deleting previous profile media:', user.profileMedia);
          const previous = await Media.findById(user.profileMedia);
          await deleteMedia(previous);
        }

        console.log('☁️ Uploading to Cloudinary...');
        const { media } = await uploadFileToCloudinary(req.file, {
          module: 'userProfile',
          ownerType: 'user',
          ownerId: user._id,
          folder: `rapira/users/${user._id}`
        });

        console.log('✅ Cloudinary upload successful:', {
          mediaId: media._id,
          url: media.secure_url
        });

        user.profileMedia = media._id;
        user.profileImage = media.secure_url;
        req.session.user.profileImage = user.profileImage;
        
        console.log('💾 Session updated with new profile image');
      } catch (err) {
        console.error('❌ Cloud upload failed (profile):', err);
        console.error('Error details:', err.message);
        req.flash('error', 'Profile image upload failed: ' + err.message);
        return res.redirect('/users/edit-profile');
      }
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

    // Save session to ensure changes persist
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      req.flash('success', 'Profile updated successfully');
      res.redirect('/users/profile');
    });
  } catch (error) {
    console.error('Update profile error:', error);
    req.flash('error', 'Failed to update profile');
    res.redirect('/users/edit-profile');
  }
});

// Request OTP to change email (sends to current email)
router.post('/email-change/request-otp', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP (no new email yet)
    user.pendingEmail = null;
    user.emailChangeOTP = otp;
    user.emailChangeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // Send OTP to current email
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: 'Confirm your email change',
      textContent: `Use this OTP to change your email: ${otp}. It expires in 15 minutes.`,
      htmlContent: `<p>Hi ${user.name || 'there'},</p><p>Your OTP to change your email is <strong>${otp}</strong>.</p><p>This code expires in 15 minutes.</p>`
    });

    req.flash('success', 'OTP sent to your current email. Please check your inbox.');
    res.redirect('/users/email-change/verify');
  } catch (error) {
    console.error('Email change OTP error:', error);
    req.flash('error', 'Failed to send OTP. Please try again.');
    res.redirect('/users/email-change/verify');
  }
});

// Email change verification page
router.get('/email-change/verify', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('users/email-change-verify', { user });
  } catch (error) {
    console.error('Email change verify page error:', error);
    req.flash('error', 'Failed to load email change page');
    res.redirect('/users/edit-profile');
  }
});

// Confirm email change with OTP
router.post('/email-change/confirm', isLoggedIn, async (req, res) => {
  try {
    const { newEmail, otp } = req.body;

    if (!newEmail || !otp) {
      req.flash('error', 'Please enter both email and OTP');
      return res.redirect('/users/email-change/verify');
    }

    const user = await User.findById(req.session.user.id);
    const trimmedNewEmail = newEmail.trim().toLowerCase();

    // Check OTP presence
    if (!user.emailChangeOTP || !user.emailChangeExpires) {
      req.flash('error', 'Please request an OTP first');
      return res.redirect('/users/email-change/verify');
    }

    if (user.emailChangeOTP !== otp.trim()) {
      req.flash('error', 'Invalid OTP');
      return res.redirect('/users/email-change/verify');
    }

    if (user.emailChangeExpires < new Date()) {
      req.flash('error', 'OTP has expired. Please request a new one.');
      return res.redirect('/users/email-change/verify');
    }

    // Ensure email not taken
    const emailExists = await User.findOne({ email: trimmedNewEmail, _id: { $ne: user._id } });
    if (emailExists) {
      req.flash('error', 'This email is already in use');
      return res.redirect('/users/email-change/verify');
    }

    // Update email and clear OTP fields
    const oldEmail = user.email;
    user.email = trimmedNewEmail;
    user.pendingEmail = null;
    user.emailChangeOTP = null;
    user.emailChangeExpires = null;
    await user.save();

    // Update session email if stored
    if (req.session.user) {
      req.session.user.email = user.email;
    }

    // Notify new email about the change
    try {
      await sendEmail({
        to: trimmedNewEmail,
        toName: user.name,
        subject: 'Your email was updated on Rapira',
        textContent: `Hi ${user.name || ''}, your account email was changed from ${oldEmail} to ${trimmedNewEmail}. If this wasn’t you, please contact support immediately.`,
        htmlContent: `<p>Hi ${user.name || 'there'},</p><p>Your account email has been updated.</p><p><strong>Previous email:</strong> ${oldEmail}<br><strong>New email:</strong> ${trimmedNewEmail}</p><p>If you did not make this change, please contact support immediately.</p>`
      });
    } catch (err) {
      console.error('Post-change email notification failed:', err);
    }

    req.flash('success', 'Email updated successfully');
    res.redirect('/users/profile');
  } catch (error) {
    console.error('Email change confirm error:', error);
    req.flash('error', 'Failed to update email. Please try again.');
    res.redirect('/users/email-change/verify');
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

    let artistData = null;

    // Check if user is an artist
    if (user.role === 'artist') {
      // Find artist profile
      const artist = await Artist.findOne({ user: user._id });

      if (artist) {
        // Store artist data before deletion
        artistData = {
          stageName: artist.stageName,
          genre: artist.genre,
          yearsActive: artist.yearsActive,
          about: artist.about,
          followers: artist.followers || 0
        };

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

    // Get ticket count before deletion
    const Ticket = require('../models/Ticket');
    const ticketCount = await Ticket.countDocuments({ user: user._id });

    // Get concert count if artist
    const Concert = require('../models/Concert');
    const concertCount = await Concert.countDocuments({ artist: user._id });

    // Delete user's tickets
    await Ticket.deleteMany({ user: user._id });
    console.log(`Deleted all tickets for user ${user._id}`);

    // Create deleted account record
    const deletedAccount = new DeletedAccount({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      bio: user.bio,
      city: user.city,
      socialLinks: user.socialLinks,
      walletBalance: user.walletBalance,
      deletedBy: 'user',
      deletionReason: 'User requested account deletion',
      artistData: artistData,
      totalTicketsPurchased: ticketCount,
      totalConcerts: concertCount
    });

    await deletedAccount.save();
    console.log(`Created deleted account record: ${deletedAccount._id}`);

    // Delete profile image if it's not the default
    if (user.profileImage && user.profileImage !== '/images/default-profile.png' && user.profileImage !== '/images/default-profile.svg') {
      const oldImagePath = path.join(__dirname, '../public', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
          console.log(`Deleted profile image: ${oldImagePath}`);
        } catch (imgErr) {
          console.error(`Could not delete image ${oldImagePath}:`, imgErr);
        }
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

// View public profile (MUST be last route with :id parameter)
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
