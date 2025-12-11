const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const ArtistApplication = require('../models/ArtistApplication');
const Media = require('../models/Media');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { sendArtistApplicationEmail, sendArtistApprovalEmail, sendArtistRejectionEmail } = require('../utils/emailService');
const { createArtistApplicationNotification } = require('../utils/notificationService');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image (JPEG, JPG, PNG) and PDF files are allowed'));
    }
  }
});

// Artist level selection page
router.get('/select-level', isLoggedIn, async (req, res) => {
  try {
    // Check if user already has an artist profile
    const existingArtist = await Artist.findOne({ user: req.session.user.id });

    if (existingArtist) {
      // If user has an artist profile but role is not artist, there's a mismatch
      // This can happen if admin changed user role but didn't delete artist profile
      const user = await User.findById(req.session.user.id);

      if (user && user.role !== 'artist') {
        console.log(`Fixing mismatch: User ${user._id} has role ${user.role} but has artist profile ${existingArtist._id}`);

        // Delete the existing artist profile to allow user to apply again
        const Concert = require('../models/Concert');
        const Content = require('../models/Content');

        await Concert.deleteMany({ artist: existingArtist._id });
        await Content.deleteMany({ artist: existingArtist._id });
        await Artist.findByIdAndDelete(existingArtist._id);

        console.log(`Fixed mismatch: Deleted artist profile ${existingArtist._id} for user ${user._id}`);

        // Continue to the application process
      } else {
        req.flash('error', 'You already have an artist profile');
        return res.redirect('/artists/dashboard');
      }
    }

    // Check if user already has a pending application
    const pendingApplication = await ArtistApplication.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (pendingApplication) {
      req.flash('info', 'You already have a pending artist application');
      return res.redirect('/artist-applications/status');
    }

    res.render('artist-applications/select-level', {
      title: 'Select Artist Level'
    });
  } catch (error) {
    console.error('Error in select artist level:', error);
    req.flash('error', 'An error occurred while loading the page');
    res.redirect('/');
  }
});

// Artist application form
router.get('/apply/:level', isLoggedIn, async (req, res) => {
  try {
    const { level } = req.params;

    // Validate level
    if (!['Beginner', 'Intermediate', 'Established'].includes(level)) {
      req.flash('error', 'Invalid artist level');
      return res.redirect('/artist-applications/select-level');
    }

    // Check if user already has an artist profile
    const existingArtist = await Artist.findOne({ user: req.session.user.id });

    if (existingArtist) {
      // If user has an artist profile but role is not artist, there's a mismatch
      // This can happen if admin changed user role but didn't delete artist profile
      const user = await User.findById(req.session.user.id);

      if (user && user.role !== 'artist') {
        console.log(`Fixing mismatch: User ${user._id} has role ${user.role} but has artist profile ${existingArtist._id}`);

        // Delete the existing artist profile to allow user to apply again
        const Concert = require('../models/Concert');
        const Content = require('../models/Content');

        await Concert.deleteMany({ artist: existingArtist._id });
        await Content.deleteMany({ artist: existingArtist._id });
        await Artist.findByIdAndDelete(existingArtist._id);

        console.log(`Fixed mismatch: Deleted artist profile ${existingArtist._id} for user ${user._id}`);

        // Continue to the application process
      } else {
        req.flash('error', 'You already have an artist profile');
        return res.redirect('/artists/dashboard');
      }
    }

    // Check if user already has a pending application
    const pendingApplication = await ArtistApplication.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (pendingApplication) {
      req.flash('info', 'You already have a pending artist application');
      return res.redirect('/artist-applications/status');
    }

    res.render('artist-applications/apply', {
      title: 'Artist Application',
      level
    });
  } catch (error) {
    console.error('Error in artist application form:', error);
    req.flash('error', 'An error occurred while loading the application form');
    res.redirect('/artist-applications/select-level');
  }
});

// Submit artist application
router.post('/apply', isLoggedIn, upload.single('proofPhoto'), async (req, res) => {
  try {
    const { artistLevel, aadharCard, city, state, age, phoneNumber } = req.body;

    // Validate input
    if (!artistLevel || !aadharCard || !city || !state || !age || !phoneNumber) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/artist-applications/apply/${artistLevel}`);
    }

    // Validate Aadhaar card format (exactly 12 digits)
    if (!/^\d{12}$/.test(aadharCard)) {
      req.flash('error', 'Aadhaar card number must be exactly 12 digits');
      return res.redirect(`/artist-applications/apply/${artistLevel}`);
    }

    // Validate phone number format (exactly 10 digits)
    if (!/^\d{10}$/.test(phoneNumber)) {
      req.flash('error', 'Phone number must be exactly 10 digits');
      return res.redirect(`/artist-applications/apply/${artistLevel}`);
    }

    if (!req.file) {
      req.flash('error', 'Please upload a proof photo');
      return res.redirect(`/artist-applications/apply/${artistLevel}`);
    }

    // Validate artist level
    if (!['Beginner', 'Intermediate', 'Established'].includes(artistLevel)) {
      req.flash('error', 'Invalid artist level');
      return res.redirect('/artist-applications/select-level');
    }

    // Check if user already has an artist profile
    const existingArtist = await Artist.findOne({ user: req.session.user.id });

    if (existingArtist) {
      // If user has an artist profile but role is not artist, there's a mismatch
      // This can happen if admin changed user role but didn't delete artist profile
      const user = await User.findById(req.session.user.id);

      if (user && user.role !== 'artist') {
        console.log(`Fixing mismatch: User ${user._id} has role ${user.role} but has artist profile ${existingArtist._id}`);

        // Delete the existing artist profile to allow user to apply again
        const Concert = require('../models/Concert');
        const Content = require('../models/Content');

        await Concert.deleteMany({ artist: existingArtist._id });
        await Content.deleteMany({ artist: existingArtist._id });
        await Artist.findByIdAndDelete(existingArtist._id);

        console.log(`Fixed mismatch: Deleted artist profile ${existingArtist._id} for user ${user._id}`);

        // Continue to the application process
      } else {
        req.flash('error', 'You already have an artist profile');
        return res.redirect('/artists/dashboard');
      }
    }

    // Check if user already has a pending application
    const pendingApplication = await ArtistApplication.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (pendingApplication) {
      req.flash('info', 'You already have a pending artist application');
      return res.redirect('/artist-applications/status');
    }

    // Create new application with proof photo uploaded to Cloudinary
    let proofPhotoUrl = null;
    let proofPhotoMedia = null;
    
    if (req.file) {
      try {
        const { media } = await uploadFileToCloudinary(req.file, {
          module: 'artistApplication',
          ownerType: 'user',
          ownerId: req.session.user.id,
          folder: 'rapira/artist-applications/proofs'
        });
        proofPhotoUrl = media.secure_url;
        proofPhotoMedia = media._id;
      } catch (err) {
        console.error('Proof photo upload error:', err);
        req.flash('warning', 'Application created, but proof photo upload failed. Please upload it later.');
      }
    }

    const newApplication = new ArtistApplication({
      user: req.session.user.id,
      artistLevel,
      aadharCard,
      state,
      city,
      age,
      phoneNumber,
      proofPhoto: proofPhotoUrl,
      proofPhotoData: req.file ? req.file.buffer : null,
      proofPhotoContentType: req.file ? req.file.mimetype : null,
      proofPhotoMedia: proofPhotoMedia,
      status: 'pending'
    });

    await newApplication.save();

    // Send email notification to admin
    try {
      const user = await User.findById(req.session.user.id);

      // Add phone number to user object for email template
      user.phoneNumber = phoneNumber;

      // Send email to all admin users
      const emailResult = await sendArtistApplicationEmail(user, artistLevel);
      console.log(`Artist application email sent to ${emailResult.recipientCount || 0} admin(s)`);

      // Create notification for admin dashboard
      const populatedApplication = await ArtistApplication.findById(newApplication._id).populate('user');
      await createArtistApplicationNotification(populatedApplication);
      console.log(`Notification created for artist application: ${newApplication._id}`);
    } catch (emailError) {
      console.error('Error sending artist application email or creating notification:', emailError);
      // Continue with the process even if email fails
    }

    // Add a success flash message
    req.flash('success', 'Your artist application has been submitted successfully. You will be notified once it is reviewed.');

    // Redirect to status page
    res.redirect('/artist-applications/status');
  } catch (error) {
    console.error('Error in submit artist application:', error);
    req.flash('error', 'An error occurred while submitting your application');
    res.redirect('/artist-applications/select-level');
  }
});

// Application status page
router.get('/status', isLoggedIn, async (req, res) => {
  try {
    // Get user's applications
    const applications = await ArtistApplication.find({ user: req.session.user.id })
      .sort({ createdAt: -1 });

    res.render('artist-applications/status', {
      title: 'Application Status',
      applications
    });
  } catch (error) {
    console.error('Error in application status:', error);
    req.flash('error', 'An error occurred while checking your application status');
    res.redirect('/');
  }
});

// Admin: List all applications
router.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, status, artistLevel, state, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Artist level filter
    if (artistLevel && artistLevel !== 'all') {
      filter.artistLevel = artistLevel;
    }

    // State filter
    if (state && state !== 'all') {
      filter.state = { $regex: state, $options: 'i' };
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get applications with filters
    let applications = await ArtistApplication.find(filter)
      .sort(sortOptions)
      .populate('user', 'name email');

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      applications = applications.filter(app => {
        const userName = (app.user ? app.user.name : '').toLowerCase();
        const userEmail = (app.user ? app.user.email : '').toLowerCase();
        const state = (app.state || '').toLowerCase();
        const city = (app.city || '').toLowerCase();

        return userName.includes(searchTerm) ||
               userEmail.includes(searchTerm) ||
               state.includes(searchTerm) ||
               city.includes(searchTerm);
      });
    }

    // Get statistics
    const totalApplications = await ArtistApplication.countDocuments();
    const pendingApplications = await ArtistApplication.countDocuments({ status: 'pending' });
    const approvedApplications = await ArtistApplication.countDocuments({ status: 'approved' });
    const rejectedApplications = await ArtistApplication.countDocuments({ status: 'rejected' });

    // Get unique states for filter dropdown
    const allStates = await ArtistApplication.find().distinct('state');
    const states = allStates.filter(s => s && s.trim()).sort();

    res.render('admin/artist-applications', {
      layout: 'admin',
      title: 'Artist Applications',
      currentPath: '/artist-applications/admin',
      applications,
      searchParams: {
        search: search || '',
        status: status || 'all',
        artistLevel: artistLevel || 'all',
        state: state || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalApplications,
        pending: pendingApplications,
        approved: approvedApplications,
        rejected: rejectedApplications,
        filtered: applications.length
      },
      states
    });
  } catch (error) {
    console.error('Error in admin applications list:', error);
    req.flash('error', 'An error occurred while loading applications');
    res.redirect('/admin');
  }
});

// Export artist applications to CSV
router.get('/admin/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main admin route)
    const { search, status, artistLevel, state, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (artistLevel && artistLevel !== 'all') {
      filter.artistLevel = artistLevel;
    }

    if (state && state !== 'all') {
      filter.state = { $regex: state, $options: 'i' };
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get applications with filters
    let applications = await ArtistApplication.find(filter)
      .sort(sortOptions)
      .populate('user', 'name email');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      applications = applications.filter(app => {
        const userName = (app.user ? app.user.name : '').toLowerCase();
        const userEmail = (app.user ? app.user.email : '').toLowerCase();
        const state = (app.state || '').toLowerCase();
        const city = (app.city || '').toLowerCase();

        return userName.includes(searchTerm) ||
               userEmail.includes(searchTerm) ||
               state.includes(searchTerm) ||
               city.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Name,Email,Artist Level,State,City,Age,Phone,Status,Applied Date,Reviewed Date\n';
    const csvRows = applications.map(app => {
      const name = `"${(app.user ? app.user.name : '').replace(/"/g, '""')}"`;
      const email = `"${(app.user ? app.user.email : '').replace(/"/g, '""')}"`;
      const artistLevel = app.artistLevel || '';
      const state = `"${(app.state || '').replace(/"/g, '""')}"`;
      const city = `"${(app.city || '').replace(/"/g, '""')}"`;
      const age = app.age || '';
      const phone = app.phoneNumber || '';
      const status = app.status || '';
      const appliedDate = new Date(app.createdAt).toLocaleDateString();
      const reviewedDate = app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : '';

      return `${name},${email},${artistLevel},${state},${city},${age},${phone},${status},${appliedDate},${reviewedDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `artist_applications_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export artist applications error:', error);
    req.flash('error', 'Failed to export artist applications');
    res.redirect('/artist-applications/admin');
  }
});

// Admin: View application details
router.get('/admin/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ArtistApplication.findById(req.params.id)
      .populate('user', 'name email profileImage');

    if (!application) {
      req.flash('error', 'Application not found');
      return res.redirect('/artist-applications/admin');
    }

    res.render('admin/artist-application-details', {
      layout: 'admin',
      title: 'Application Details',
      currentPath: '/artist-applications/admin',
      application
    });
  } catch (error) {
    console.error('Error in admin application details:', error);
    req.flash('error', 'An error occurred while loading application details');
    res.redirect('/artist-applications/admin');
  }
});

// Serve proof photo/PDF directly (admin only)
router.get('/proof/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ArtistApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).send('Proof not found');
    }

    if (application.proofPhotoData && application.proofPhotoContentType) {
      res.setHeader('Content-Type', application.proofPhotoContentType);
      return res.send(application.proofPhotoData);
    }

    if (application.proofPhoto) {
      const proofPath = path.join(__dirname, '../public', application.proofPhoto);
      if (fs.existsSync(proofPath)) {
        return res.sendFile(proofPath);
      }
    }

    return res.status(404).send('Proof not found');
  } catch (error) {
    console.error('Error serving proof photo:', error);
    res.status(500).send('Error serving proof photo');
  }
});

// Admin: Approve application
router.post('/admin/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ArtistApplication.findById(req.params.id)
      .populate('user');

    if (!application) {
      req.flash('error', 'Application not found');
      return res.redirect('/artist-applications/admin');
    }

    // Check if application is already processed
    if (application.status !== 'pending') {
      req.flash('error', 'This application has already been processed');
      return res.redirect(`/artist-applications/admin/${application._id}`);
    }

    // Update application status
    application.status = 'approved';
    application.adminComments = req.body.comments || 'Application approved';
    await application.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('ArtistApplication', application._id, 'approved');

    // Check if user already has an artist profile
    let artist = await Artist.findOne({ user: application.user._id });

    if (!artist) {
      // Create artist profile
      artist = new Artist({
        user: application.user._id,
        stageName: application.user.name, // Default to user name, can be updated later
        genre: 'Hip Hop', // Default genre, can be updated later
        artistLevel: application.artistLevel,
        aadharCard: application.aadharCard,
        state: application.state,
        city: application.city,
        age: application.age,
        phoneNumber: application.phoneNumber,
        proofPhoto: application.proofPhoto
      });

      await artist.save();
    } else {
      // Update existing artist profile
      artist.artistLevel = application.artistLevel;
      artist.aadharCard = application.aadharCard;
      artist.state = application.state;
      artist.city = application.city;
      artist.age = application.age;
      artist.phoneNumber = application.phoneNumber;
      artist.proofPhoto = application.proofPhoto;

      await artist.save();
    }

    // Update user role if not already an artist
    if (application.user.role !== 'artist') {
      application.user.role = 'artist';
      await application.user.save();

      // Update session if this is the current user
      if (req.session.user && req.session.user.id === application.user._id.toString()) {
        req.session.user.role = 'artist';
      }
    }

    // Send email notification if user exists
    if (application.user) {
      try {
        await sendArtistApprovalEmail(application.user, application.artistLevel);
      } catch (emailError) {
        console.error('Error sending artist approval email:', emailError);
        // Continue with the process even if email fails
      }
    } else {
      console.log('Could not send approval email: User not found');
    }

    req.flash('success', 'Application approved successfully');
    res.redirect('/artist-applications/admin');
  } catch (error) {
    console.error('Error in approve application:', error);
    req.flash('error', 'An error occurred while approving the application');
    res.redirect('/artist-applications/admin');
  }
});

// Admin: Reject application
router.post('/admin/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ArtistApplication.findById(req.params.id)
      .populate('user');

    if (!application) {
      req.flash('error', 'Application not found');
      return res.redirect('/artist-applications/admin');
    }

    // Check if application is already processed
    if (application.status !== 'pending') {
      req.flash('error', 'This application has already been processed');
      return res.redirect(`/artist-applications/admin/${application._id}`);
    }

    // Update application status
    application.status = 'rejected';
    application.adminComments = req.body.comments || 'Application rejected';
    await application.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('ArtistApplication', application._id, 'rejected');

    // Send email notification if user exists
    if (application.user) {
      try {
        await sendArtistRejectionEmail(application.user, application.artistLevel, application.adminComments);
      } catch (emailError) {
        console.error('Error sending artist rejection email:', emailError);
        // Continue with the process even if email fails
      }
    } else {
      console.log('Could not send rejection email: User not found');
    }

    req.flash('success', 'Application rejected successfully');
    res.redirect('/artist-applications/admin');
  } catch (error) {
    console.error('Error in reject application:', error);
    req.flash('error', 'An error occurred while rejecting the application');
    res.redirect('/artist-applications/admin');
  }
});

// Admin: Confirm delete application
router.get('/admin/:id/confirm-delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ArtistApplication.findById(req.params.id)
      .populate('user', 'name email profileImage');

    if (!application) {
      req.flash('error', 'Application not found');
      return res.redirect('/artist-applications/admin');
    }

    res.render('admin/confirm-delete-application', {
      layout: 'admin',
      title: 'Confirm Delete Application',
      currentPath: '/artist-applications/admin',
      application
    });
  } catch (error) {
    console.error('Error in confirm delete application:', error);
    req.flash('error', 'An error occurred while loading the confirmation page');
    res.redirect('/artist-applications/admin');
  }
});

// Admin: Delete application
router.post('/admin/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ArtistApplication.findById(req.params.id);

    if (!application) {
      req.flash('error', 'Application not found');
      return res.redirect('/artist-applications/admin');
    }

    // Delete proof photo if it exists
    if (application.proofPhoto) {
      const proofPhotoPath = path.join(__dirname, '../public', application.proofPhoto);
      if (fs.existsSync(proofPhotoPath)) {
        fs.unlinkSync(proofPhotoPath);
        console.log(`Deleted proof photo: ${application.proofPhoto}`);
      }
    }

    // Delete the application
    await ArtistApplication.findByIdAndDelete(req.params.id);
    console.log(`Deleted artist application: ${req.params.id}`);

    req.flash('success', 'Artist application deleted successfully');
    res.redirect('/artist-applications/admin');
  } catch (error) {
    console.error('Error in delete application:', error);
    req.flash('error', 'An error occurred while deleting the application');
    res.redirect('/artist-applications/admin');
  }
});

module.exports = router;