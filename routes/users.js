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
const fs = require('fs');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmail, sendAccountDeletionNotification } = require('../utils/brevoEmailService');
const DeletedAccount = require('../models/DeletedAccount');
const AccountRecoveryToken = require('../models/AccountRecoveryToken');
const WebsiteSettings = require('../models/WebsiteSettings');
const crypto = require('crypto');
const ActivityLogger = require('../utils/activityLogger');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const ProducerApplication = require('../models/ProducerApplication');

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

    // If user doesn't exist (deleted), this will be caught by the global middleware
    // but add a safety check here too
    if (!user) {
      req.flash('error', 'Your account no longer exists');
      return res.redirect('/auth/login');
    }

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

// Job Portal page - Hub for roles and registrations
router.get('/job-portal', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    // Initial check for Producer role
    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const hasProducerRole = producerRole
      ? await UserRole.exists({ user: user._id, role: producerRole._id })
      : false;

    // Check for pending Producer application
    const pendingProducerApplication = await ProducerApplication.findOne({
      user: user._id,
      status: 'pending'
    });

    // We can also check for Artist application status
    const pendingArtistApplication = await ArtistApplication.findOne({
      user: user._id,
      status: 'pending'
    });

    // Initial check for Distributor role
    const distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
    const hasDistributorRole = distributorRole
      ? await UserRole.exists({ user: user._id, role: distributorRole._id })
      : false;

    // Check for pending Distributor application
    const DistributorApplication = require('../models/DistributorApplication');
    const pendingDistributorApplication = await DistributorApplication.findOne({
      user: user._id,
      status: 'pending'
    });
    // Check for Artist status
    const isArtist = user.role === 'artist';

    res.render('users/job-portal', {
      user,
      isArtist,
      hasProducerRole,
      hasDistributorRole,
      pendingArtistApplication,
      pendingProducerApplication,
      pendingDistributorApplication,
      title: 'Job Portal',
      currentPath: '/users/job-portal'
    });
  } catch (error) {
    console.error('Job Portal error:', error);
    req.flash('error', 'Failed to load Job Portal');
    res.redirect('/users/profile');
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
    const { name, bio, city, instagram, twitter, youtube, spotify, age, heardFrom } = req.body;

    // Find user
    const user = await User.findById(req.session.user.id);

    // Track changes for activity log
    const changes = {};
    const oldValues = {
      name: user.name,
      bio: user.bio,
      city: user.city,
      age: user.age,
      heardFrom: user.heardFrom,
      profileImage: user.profileImage
    };

    // Update user fields
    if (name !== user.name) {
      await ActivityLogger.logNameChange(user._id, user.name, name, req);
      changes.name = { old: user.name, new: name };
    }

    if (city && city !== user.city) {
      await ActivityLogger.logCityChange(user._id, user.city, city, req);
      changes.city = { old: user.city, new: city };
    }

    if (bio !== user.bio) {
      await ActivityLogger.logBioChange(user._id, user.bio, bio, req);
      changes.bio = { old: user.bio?.substring(0, 50), new: bio?.substring(0, 50) };
    }

    user.name = name;
    user.bio = bio || '';
    user.city = city || '';
    user.socialLinks = {
      instagram: instagram || '',
      twitter: twitter || '',
      youtube: youtube || '',
      spotify: spotify || ''
    };

    // Optional demographics
    user.age = age ? Number(age) : null;
    user.heardFrom = heardFrom || '';

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

        // Log profile image change
        await ActivityLogger.logProfileImageChange(user._id, oldValues.profileImage, media.secure_url, req);

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

    // Log password change
    await ActivityLogger.logPasswordChange(user._id, req);

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
    if (req.body.confirmDelete !== 'yes') {
      req.flash('error', 'Please confirm you understand this action is permanent.');
      return res.redirect('/users/confirm-delete-account');
    }

    const userId = req.session.user.id;
    const user = await User.findById(userId);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/users/profile');
    }

    // Verify password before deletion
    const { password } = req.body;
    if (!password) {
      req.flash('error', 'Password is required to delete your account.');
      return res.redirect('/users/confirm-delete-account');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      req.flash('error', 'Incorrect password. Account deletion cancelled.');
      return res.redirect('/users/confirm-delete-account');
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

    const normalizedUserEmail = String(user.email || '').trim().toLowerCase();

    // Remove any stale deleted-account rows for this user/email before creating a fresh one
    await DeletedAccount.deleteMany({
      $or: [
        { userId: user._id },
        { $expr: { $eq: [{ $toLower: '$email' }, normalizedUserEmail] } }
      ]
    });

    // Create deleted account record
    const deletedAccount = new DeletedAccount({
      userId: user._id,
      name: user.name,
      email: normalizedUserEmail,
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

    // Deactivate all producer beats if they had any
    const ProducerBeat = require('../models/ProducerBeat');
    await ProducerBeat.updateMany({ producer: user._id }, { isActive: false });
    console.log(`Deactivated all associated producer beats for deleted user ${userId}`);

    // Delete user
    await User.findByIdAndDelete(userId);
    console.log(`User deleted their account: ${userId}`);

    // Clear session
    req.session.destroy();

    // Generate a recovery token that's valid for 30 days
    const recoveryToken = crypto.randomBytes(32).toString('hex');
    const recoveryTokenDoc = new AccountRecoveryToken({
      user: user._id,
      email: normalizedUserEmail,
      token: recoveryToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    await recoveryTokenDoc.save();
    console.log(`Created recovery token for user: ${user._id}`);

    // Send account deletion notification with recovery link
    try {
      const emailResult = await sendAccountDeletionNotification(user, recoveryToken);
      if (emailResult.success) {
        console.log(`Account deletion notification sent to: ${user.email}`);
      } else {
        console.error('Failed to send account deletion notification:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending account deletion notification:', emailError);
    }

    res.redirect('/');
  } catch (error) {
    console.error('Delete account error:', error);
    req.flash('error', 'Failed to delete account');
    res.redirect('/users/profile');
  }
});

// GET route for account recovery page when accessed directly without token
router.get('/recover-account', async (req, res) => {
  res.render('users/recover-account', {
    error: null,
    success: null,
    showForm: false,
    showSuccess: false
  });
});

// GET route for account recovery page with token
router.get('/recover-account/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find the recovery token
    const recoveryTokenDoc = await AccountRecoveryToken.findOne({
      token,
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!recoveryTokenDoc) {
      return res.render('users/recover-account', {
        error: 'Invalid or expired recovery token. Please contact support if you need assistance.',
        showForm: false
      });
    }

    // Show the recovery form
    res.render('users/recover-account', {
      email: recoveryTokenDoc.email,
      token,
      showForm: true,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Account recovery page error:', error);
    res.render('users/recover-account', {
      error: 'An error occurred while loading the recovery page. Please try again.',
      showForm: false,
      success: null
    });
  }
});

// POST route for account recovery
router.post('/recover-account/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      return res.render('users/recover-account', {
        error: 'Passwords do not match',
        email: req.body.email || '',
        token,
        showForm: true
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.render('users/recover-account', {
        error: 'Password must be at least 6 characters long',
        email: req.body.email || '',
        token,
        showForm: true
      });
    }

    // Find the recovery token
    const recoveryTokenDoc = await AccountRecoveryToken.findOne({
      token,
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!recoveryTokenDoc) {
      return res.render('users/recover-account', {
        error: 'Invalid or expired recovery token. Please contact support if you need assistance.',
        showForm: false
      });
    }

    // Check if user has been permanently deleted
    const deletedAccount = await DeletedAccount.findOne({ email: recoveryTokenDoc.email });
    if (!deletedAccount) {
      return res.render('users/recover-account', {
        error: 'Account information not found. The account may have already been permanently deleted.',
        showForm: false,
        success: null
      });
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: recoveryTokenDoc.email });
    let user;

    if (existingUser) {
      // If user already exists, update their password and log them in
      existingUser.password = password;
      await existingUser.save();
      user = existingUser;
      console.log(`Existing user updated for recovery: ${user._id} with email: ${user.email}`);
    } else {
      // Create a new user with the original data
      user = new User({
        name: deletedAccount.name,
        email: deletedAccount.email,
        password: password,
        role: deletedAccount.role,
        profileImage: deletedAccount.profileImage,
        bio: deletedAccount.bio,
        city: deletedAccount.city,
        socialLinks: deletedAccount.socialLinks,
        walletBalance: deletedAccount.walletBalance,
        isEmailVerified: true
      });

      try {
        await user.save();
        console.log(`New user created for recovery: ${user._id} with email: ${user.email}`);
      } catch (dbError) {
        // Handle the case where the email already exists due to race condition or other issue
        if (dbError.code === 11000) {
          // Try to find and update the existing user
          const raceConditionUser = await User.findOne({ email: recoveryTokenDoc.email });
          if (raceConditionUser) {
            raceConditionUser.password = password;
            await raceConditionUser.save();
            user = raceConditionUser;
            console.log(`Race condition user updated for recovery: ${user._id} with email: ${user.email}`);
          } else {
            return res.render('users/recover-account', {
              error: 'An account with this email already exists. Please contact support.',
              showForm: false,
              success: null
            });
          }
        } else {
          throw dbError; // Re-throw if it's a different error
        }
      }
    }
    console.log(`Account recovered for user: ${user._id} with email: ${user.email}`);

    // Mark the recovery token as used
    recoveryTokenDoc.used = true;
    await recoveryTokenDoc.save();

    // If the user was an artist, restore their artist profile
    if (deletedAccount.artistData) {
      const Artist = require('../models/Artist');
      const artist = new Artist({
        user: user._id,
        stageName: deletedAccount.artistData.stageName,
        genre: deletedAccount.artistData.genre,
        yearsActive: deletedAccount.artistData.yearsActive,
        about: deletedAccount.artistData.about,
        followers: deletedAccount.artistData.followers,
        city: deletedAccount.city
      });

      await artist.save();
      console.log(`Artist profile restored for user: ${user._id}`);
    }

    // Log the user in
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };

    // Delete all stale deleted-account records for this user/email since account is recovered
    const normalizedRecoveredEmail = String(user.email || recoveryTokenDoc.email || '').trim().toLowerCase();
    await DeletedAccount.deleteMany({
      $or: [
        { userId: user._id },
        { $expr: { $eq: [{ $toLower: '$email' }, normalizedRecoveredEmail] } }
      ]
    });

    // Redirect to login with success message
    req.flash('success', 'Account recovered successfully! You are now logged in.');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Account recovery error:', error);
    res.render('users/recover-account', {
      error: 'An error occurred while recovering your account. Please try again.',
      showForm: false,
      success: null
    });
  }
});

// GET route for account reactivation page
router.get('/account-reactivation', async (req, res) => {
  res.render('users/account-reactivation', {
    error: null,
    success: null,
    showOtpForm: false,
    email: null
  });
});

// POST route for account reactivation - initiate the process
router.post('/account-reactivation', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the email exists in Deleted Accounts collection
    const deletedAccount = await DeletedAccount.findOne({ email: email.toLowerCase() });

    if (!deletedAccount) {
      return res.render('users/account-reactivation', {
        error: 'This account is not available for reactivation',
        success: null,
        showOtpForm: false,
        email: email
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Save OTP in AccountRecoveryToken collection
    const recoveryToken = new AccountRecoveryToken({
      user: deletedAccount.userId,
      email: email.toLowerCase(),
      token: otp,
      expiresAt: otpExpiry,
      used: false
    });

    await recoveryToken.save();

    const settings = await WebsiteSettings.getSettings();
    const configuredReactivationUrl =
      settings && settings.emailLinks && settings.emailLinks.accountReactivationUrl
        ? settings.emailLinks.accountReactivationUrl.trim()
        : '';
    const defaultBaseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const accountReactivationUrl = configuredReactivationUrl || `${defaultBaseUrl}/account-reactivation`;

    // Send OTP to user's email
    const emailResult = await sendEmail({
      to: email,
      toName: email.split('@')[0], // Use part before @ as name
      subject: 'Account Reactivation OTP - Rapira',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { background-color: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; }
            .otp { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; letter-spacing: 5px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 16px 0; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Reactivation</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reactivate your account. Please use the following OTP to complete the reactivation process:</p>
              <div class="otp">${otp}</div>
              <p style="text-align:center; margin: 0 0 12px 0;">
                <a href="${accountReactivationUrl}" class="button">Open Account Reactivation Page</a>
              </p>
              <p>Reactivation page: <a href="${accountReactivationUrl}">${accountReactivationUrl}</a></p>
              <p>This OTP is valid for 15 minutes. If you did not request this reactivation, please ignore this email.</p>
              <p>If you don't see this email in your inbox, please check your spam or junk folder.</p>
              <p>Thank you,<br>The Rapira Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `Account Reactivation OTP Request

Hello,

We received a request to reactivate your account. Please use the following OTP to complete the reactivation process:

OTP: ${otp}

Account Reactivation Page: ${accountReactivationUrl}

This OTP is valid for 15 minutes. If you did not request this reactivation, please ignore this email.

If you don't see this email in your inbox, please check your spam or junk folder.

Thank you,
The Rapira Team

This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} Rapira. All rights reserved.`
    });

    res.render('users/account-reactivation', {
      success: 'OTP sent to your email. Please check your inbox and enter the OTP below.',
      error: null,
      showOtpForm: true,
      email: email
    });
  } catch (error) {
    console.error('Account reactivation error:', error);
    res.render('users/account-reactivation', {
      error: 'An error occurred while initiating account reactivation. Please try again.',
      success: null,
      showOtpForm: false,
      email: req.body.email || null
    });
  }
});

// POST route for account reactivation OTP verification
router.post('/account-reactivation/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP token
    const recoveryToken = await AccountRecoveryToken.findOne({
      email: email.toLowerCase(),
      token: otp,
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!recoveryToken) {
      return res.render('users/account-reactivation', {
        error: 'Invalid or expired OTP. Please try again.',
        success: null,
        showOtpForm: true,
        email: email
      });
    }

    // Mark the OTP token as used
    recoveryToken.used = true;
    await recoveryToken.save();

    // Check if the deleted account still exists
    const deletedAccount = await DeletedAccount.findOne({ email: email.toLowerCase() });
    if (!deletedAccount) {
      return res.render('users/account-reactivation', {
        error: 'Account information not found. The account may have already been permanently deleted.',
        success: null,
        showOtpForm: false,
        email: email
      });
    }

    // OTP is valid, now show password form
    res.render('users/account-reactivation', {
      success: 'OTP verified successfully. Please set a new password to complete reactivation.',
      error: null,
      showPasswordForm: true, // Show password form instead of redirecting
      email: email
    });
  } catch (error) {
    console.error('Account reactivation OTP verification error:', error);
    res.render('users/account-reactivation', {
      error: 'An error occurred while verifying OTP. Please try again.',
      success: null,
      showOtpForm: true,
      email: req.body.email || null
    });
  }
});

// POST route for setting password after account reactivation OTP verification
router.post('/account-reactivation/set-password', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      return res.render('users/account-reactivation', {
        error: 'Passwords do not match',
        success: null,
        showPasswordForm: true,
        email: email
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.render('users/account-reactivation', {
        error: 'Password must be at least 6 characters long',
        success: null,
        showPasswordForm: true,
        email: email
      });
    }

    // Check if the user is trying to reactivate an account by checking if there's a valid recovery token
    // Find any unused recovery tokens for this email that haven't expired
    const recoveryToken = await AccountRecoveryToken.findOne({
      email: email.toLowerCase(),
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!recoveryToken) {
      return res.render('users/account-reactivation', {
        error: 'Invalid or expired session. Please restart the reactivation process.',
        success: null,
        showOtpForm: false,
        email: email
      });
    }

    // Check if the deleted account still exists
    const deletedAccount = await DeletedAccount.findOne({ email: email.toLowerCase() });
    if (!deletedAccount) {
      return res.render('users/account-reactivation', {
        error: 'Account information not found. The account may have already been permanently deleted.',
        success: null,
        showPasswordForm: false,
        email: email
      });
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    let user;

    if (existingUser) {
      // If user already exists, update their password and log them in
      existingUser.password = password;
      await existingUser.save();
      user = existingUser;
      console.log(`Existing user updated for reactivation: ${user._id} with email: ${user.email}`);
    } else {
      // Create a new user with the original data and new password
      user = new User({
        name: deletedAccount.name,
        email: deletedAccount.email,
        password: password,
        role: deletedAccount.role,
        profileImage: deletedAccount.profileImage,
        bio: deletedAccount.bio,
        city: deletedAccount.city,
        socialLinks: deletedAccount.socialLinks,
        walletBalance: deletedAccount.walletBalance,
        isEmailVerified: true
      });

      try {
        await user.save();
        console.log(`New user created for reactivation: ${user._id} with email: ${user.email}`);
      } catch (dbError) {
        // Handle the case where the email already exists due to race condition or other issue
        if (dbError.code === 11000) {
          // Try to find and update the existing user
          const raceConditionUser = await User.findOne({ email: email.toLowerCase() });
          if (raceConditionUser) {
            raceConditionUser.password = password;
            await raceConditionUser.save();
            user = raceConditionUser;
            console.log(`Race condition user updated for reactivation: ${user._id} with email: ${user.email}`);
          } else {
            return res.render('users/account-reactivation', {
              error: 'An account with this email already exists. Please contact support.',
              success: null,
              showPasswordForm: false,
              email: email
            });
          }
        } else {
          throw dbError; // Re-throw if it's a different error
        }
      }
    }

    console.log(`Account reactivated for user: ${user._id} with email: ${user.email}`);

    // If the user was an artist, restore their artist profile
    if (deletedAccount.artistData) {
      const Artist = require('../models/Artist');

      // Check if required artist fields exist before creating the artist profile
      if (deletedAccount.artistData.stageName && deletedAccount.artistData.genre) {
        const artist = new Artist({
          user: user._id,
          stageName: deletedAccount.artistData.stageName,
          genre: deletedAccount.artistData.genre,
          yearsActive: deletedAccount.artistData.yearsActive,
          about: deletedAccount.artistData.about,
          followers: deletedAccount.artistData.followers,
          city: deletedAccount.city
        });

        await artist.save();
        console.log(`Artist profile restored for user: ${user._id}`);
      } else {
        console.log(`Incomplete artist data found for user: ${user._id}, skipping artist profile restoration`);
        // Optionally, you could create a basic artist profile with default values
        // or notify the user to update their artist profile after login
      }
    }

    // Mark the recovery token as used
    recoveryToken.used = true;
    await recoveryToken.save();

    // Log the user in
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };

    // Delete all stale deleted-account records for this user/email since account is reactivated
    const normalizedReactivatedEmail = String(email || user.email || '').trim().toLowerCase();
    await DeletedAccount.deleteMany({
      $or: [
        { userId: user._id },
        { $expr: { $eq: [{ $toLower: '$email' }, normalizedReactivatedEmail] } }
      ]
    });

    // Redirect to home page with success message
    req.flash('success', 'Account reactivated successfully! You are now logged in.');
    res.redirect('/');
  } catch (error) {
    console.error('Account reactivation set password error:', error);
    res.render('users/account-reactivation', {
      error: 'An error occurred while setting your password. Please try again.',
      success: null,
      showPasswordForm: true,
      email: req.body.email || null
    });
  }
});

// View public profile (MUST be last route with :id parameter)
router.get('/:id', async (req, res) => {
  try {
    // Validate that :id is a valid MongoDB ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      req.flash('error', 'Invalid user ID format');
      return res.redirect('/');
    }

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
