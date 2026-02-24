
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const LearningModule = require('../models/LearningModule');
const LearningProgress = require('../models/LearningProgress');
const ArtistUpgradeRequest = require('../models/ArtistUpgradeRequest');
const { isLoggedIn, isArtist, isAdmin } = require('../middleware/auth');
const { sendEmail } = require('../utils/emailService');

// Artist: View pending upgrade request
router.get('/artist-upgrade/pending', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/learning');
    }

    // Get the pending request
    const request = await ArtistUpgradeRequest.findOne({
      artist: artist._id,
      status: 'pending'
    });

    if (!request) {
      req.flash('info', 'You do not have any pending upgrade requests');
      return res.redirect('/learning');
    }

    res.render('artists/pending-upgrade-request', {
      title: 'Pending Upgrade Request',
      request
    });
  } catch (error) {
    console.error('Error in view pending upgrade request:', error);
    req.flash('error', 'An error occurred while loading your pending request');
    res.redirect('/learning');
  }
});

// Artist: View upgrade request form
router.get('/artist-upgrade/request', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/learning');
    }

    // Check if artist is eligible for upgrade
    if ((artist.artistLevel === 'Beginner' && !artist.completedLearning) ||
      (artist.artistLevel === 'Intermediate' && !artist.completedLearning) ||
      artist.artistLevel === 'Established') {
      req.flash('error', 'You are not eligible for an artist level upgrade at this time');
      return res.redirect('/learning');
    }

    // Check if there's already a pending request
    const pendingRequest = await ArtistUpgradeRequest.findOne({
      artist: artist._id,
      status: 'pending'
    });

    if (pendingRequest) {
      const requestDate = new Date(pendingRequest.createdAt).toLocaleDateString();
      const requestLevel = pendingRequest.requestedLevel;
      req.flash('info', `You already have a pending request to upgrade to ${requestLevel} level submitted on ${requestDate}. Please wait for an admin to review your request.`);
      return res.redirect('/learning');
    }

    // Get completed modules
    const progress = await LearningProgress.find({
      user: req.session.user.id,
      completed: true
    }).populate('module');

    const completedModules = progress.map(p => ({
      title: p.module.title,
      id: p.module._id,
      progress: p
    }));

    res.render('artists/upgrade-request', {
      title: 'Request Artist Level Upgrade',
      artist,
      completedModules
    });
  } catch (error) {
    console.error('Error in upgrade request form:', error);
    req.flash('error', 'An error occurred while loading the upgrade request form');
    res.redirect('/learning');
  }
});

// Artist: Submit upgrade request
router.post('/artist-upgrade/request', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { currentLevel, requestedLevel, reason } = req.body;

    // Validate input
    if (!currentLevel || !requestedLevel || !reason) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/artist-upgrade/request');
    }

    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/learning');
    }

    // Validate levels
    if (artist.artistLevel !== currentLevel) {
      req.flash('error', 'Invalid current artist level');
      return res.redirect('/artist-upgrade/request');
    }

    if ((currentLevel === 'Beginner' && requestedLevel !== 'Intermediate') ||
      (currentLevel === 'Intermediate' && requestedLevel !== 'Established')) {
      req.flash('error', 'Invalid requested artist level');
      return res.redirect('/artist-upgrade/request');
    }

    // Check if there's already a pending request
    const pendingRequest = await ArtistUpgradeRequest.findOne({
      artist: artist._id,
      status: 'pending'
    });

    if (pendingRequest) {
      const requestDate = new Date(pendingRequest.createdAt).toLocaleDateString();
      const requestLevel = pendingRequest.requestedLevel;
      req.flash('info', `You already have a pending request to upgrade to ${requestLevel} level submitted on ${requestDate}. Please wait for an admin to review your request.`);
      return res.redirect('/learning');
    }

    // Get completed modules
    const progress = await LearningProgress.find({
      user: req.session.user.id,
      completed: true
    });

    const completedModuleIds = progress.map(p => p.module);

    // Create upgrade request
    const newRequest = new ArtistUpgradeRequest({
      artist: artist._id,
      user: req.session.user.id,
      currentLevel,
      requestedLevel,
      reason,
      completedModules: completedModuleIds
    });

    await newRequest.save();

    // Send email notification to admin - Disabled as requested
    /*
    try {
      const admins = await User.find({ role: 'admin' });

      if (admins.length > 0) {
        const adminEmails = admins.map(admin => admin.email);

        await sendEmail({
          to: adminEmails,
          subject: 'New Artist Upgrade Request',
          html: `
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #6366f1; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">New Artist Upgrade Request</h1>
                  </div>
                  <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                    <p>Hello Admin,</p>
                    <p>A new artist upgrade request has been submitted and is pending your review.</p>

                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Request Details:</h3>
                      <p><strong>Artist:</strong> ${artist.user.name}</p>
                      <p><strong>Current Level:</strong> ${currentLevel}</p>
                      <p><strong>Requested Level:</strong> ${requestedLevel}</p>
                      <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL}/admin/artist-upgrade-requests" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Review Request</a>
                    </div>

                    <p>Please review this request at your earliest convenience.</p>
                    <p>Best regards,<br>The Rapira Team</p>
                  </div>
                  <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
                    <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
          text: `New Artist Upgrade Request from ${artist.user.name}. Current Level: ${currentLevel}, Requested Level: ${requestedLevel}. Please review this request at ${process.env.BASE_URL}/admin/artist-upgrade-requests`
        });
      }
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
    }
    */

    req.flash('success', 'Your upgrade request has been submitted and is pending review');
    res.redirect('/artists/dashboard');
  } catch (error) {
    console.error('Error in submit upgrade request:', error);
    req.flash('error', 'An error occurred while submitting your upgrade request');
    res.redirect('/artist-upgrade/request');
  }
});

// Admin: View all upgrade requests
router.get('/admin/artist-upgrade-requests', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, status, currentLevel, requestedLevel, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Current level filter
    if (currentLevel && currentLevel !== 'all') {
      filter.currentLevel = currentLevel;
    }

    // Requested level filter
    if (requestedLevel && requestedLevel !== 'all') {
      filter.requestedLevel = requestedLevel;
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get all artist levels for filter dropdowns
    const artistLevels = ['Beginner', 'Intermediate', 'Established'];

    // Get requests with filters applied
    let requests = await ArtistUpgradeRequest.find(filter)
      .sort(sortOptions)
      .populate('user')
      .populate('artist')
      .populate('reviewedBy');

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      requests = requests.filter(request => {
        const userName = (request.user ? request.user.name : '').toLowerCase();
        const userEmail = (request.user ? request.user.email : '').toLowerCase();
        const currentLevel = (request.currentLevel || '').toLowerCase();
        const requestedLevel = (request.requestedLevel || '').toLowerCase();
        const status = (request.status || '').toLowerCase();

        return userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          currentLevel.includes(searchTerm) ||
          requestedLevel.includes(searchTerm) ||
          status.includes(searchTerm);
      });
    }

    // Get statistics
    const totalRequests = await ArtistUpgradeRequest.countDocuments();
    const pendingRequests = await ArtistUpgradeRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await ArtistUpgradeRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await ArtistUpgradeRequest.countDocuments({ status: 'rejected' });

    res.render('admin/artist-upgrade-requests', {
      layout: 'admin',
      title: 'Artist Upgrade Requests',
      currentPath: '/admin/artist-upgrade-requests',
      requests,
      searchParams: {
        search: search || '',
        status: status || 'all',
        currentLevel: currentLevel || 'all',
        requestedLevel: requestedLevel || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        filtered: requests.length
      },
      filterOptions: {
        statuses: ['pending', 'approved', 'rejected'],
        artistLevels
      }
    });
  } catch (error) {
    console.error('Error in admin upgrade requests:', error);
    req.flash('error', 'An error occurred while loading upgrade requests');
    res.redirect('/admin');
  }
});

// Export artist upgrade requests to CSV
router.get('/admin/artist-upgrade-requests/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main admin route)
    const { search, status, currentLevel, requestedLevel, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (currentLevel && currentLevel !== 'all') {
      filter.currentLevel = currentLevel;
    }

    if (requestedLevel && requestedLevel !== 'all') {
      filter.requestedLevel = requestedLevel;
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get requests with filters applied
    let requests = await ArtistUpgradeRequest.find(filter)
      .sort(sortOptions)
      .populate('user')
      .populate('artist')
      .populate('reviewedBy');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      requests = requests.filter(request => {
        const userName = (request.user ? request.user.name : '').toLowerCase();
        const userEmail = (request.user ? request.user.email : '').toLowerCase();
        const currentLevel = (request.currentLevel || '').toLowerCase();
        const requestedLevel = (request.requestedLevel || '').toLowerCase();
        const status = (request.status || '').toLowerCase();

        return userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          currentLevel.includes(searchTerm) ||
          requestedLevel.includes(searchTerm) ||
          status.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'User Name,Email,Current Level,Requested Level,Status,Submitted Date,Reviewed Date,Reviewed By,Admin Notes\n';
    const csvRows = requests.map(request => {
      const userName = `"${(request.user ? request.user.name : '').replace(/"/g, '""')}"`;
      const userEmail = `"${(request.user ? request.user.email : '').replace(/"/g, '""')}"`;
      const currentLevel = request.currentLevel || '';
      const requestedLevel = request.requestedLevel || '';
      const status = request.status || '';
      const submittedDate = new Date(request.createdAt).toLocaleDateString();
      const reviewedDate = request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString() : '';
      const reviewedBy = `"${(request.reviewedBy ? request.reviewedBy.name : '').replace(/"/g, '""')}"`;
      const adminNotes = `"${(request.adminNotes || '').replace(/"/g, '""')}"`;

      return `${userName},${userEmail},${currentLevel},${requestedLevel},${status},${submittedDate},${reviewedDate},${reviewedBy},${adminNotes}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `artist_upgrade_requests_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export artist upgrade requests error:', error);
    req.flash('error', 'Failed to export artist upgrade requests');
    res.redirect('/admin/artist-upgrade-requests');
  }
});

// Admin: View upgrade request details
router.get('/admin/artist-upgrade-requests/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ArtistUpgradeRequest.findById(req.params.id)
      .populate('user')
      .populate('artist')
      .populate('reviewedBy')
      .populate('completedModules');

    if (!request) {
      req.flash('error', 'Upgrade request not found');
      return res.redirect('/admin/artist-upgrade-requests');
    }

    // Get progress details for completed modules
    const completedModules = [];

    for (const moduleId of request.completedModules) {
      const module = await LearningModule.findById(moduleId);

      if (module) {
        let progress = null;

        // Only try to find progress if user exists
        if (request.user) {
          progress = await LearningProgress.findOne({
            user: request.user._id,
            module: moduleId
          });
        }

        completedModules.push({
          title: module.title,
          id: module._id,
          progress
        });
      }
    }

    res.render('admin/view-upgrade-request', {
      layout: 'admin',
      title: 'View Upgrade Request',
      currentPath: '/admin/artist-upgrade-requests',
      request,
      completedModules
    });
  } catch (error) {
    console.error('Error in view upgrade request:', error);
    req.flash('error', 'An error occurred while loading the upgrade request');
    res.redirect('/admin/artist-upgrade-requests');
  }
});

// Admin: Approve upgrade request
router.post('/admin/artist-upgrade-requests/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const request = await ArtistUpgradeRequest.findById(req.params.id)
      .populate('user')
      .populate('artist');

    if (!request) {
      req.flash('error', 'Upgrade request not found');
      return res.redirect('/admin/artist-upgrade-requests');
    }

    // Check if request is already processed
    if (request.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/artist-upgrade-requests/${req.params.id}`);
    }

    // Update request status
    request.status = 'approved';
    request.adminNotes = adminNotes || '';
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('ArtistUpgradeRequest', request._id, 'approved');

    // Update artist level
    const artist = await Artist.findById(request.artist._id);

    if (artist) {
      artist.artistLevel = request.requestedLevel;
      await artist.save();
    }

    // Send email notification to artist if user exists
    if (request.user && request.user.email) {
      try {
        await sendEmail({
          to: request.user.email,
          subject: 'Your Artist Level Upgrade Request Has Been Approved',
          html: `
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #6366f1; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Congratulations!</h1>
                  </div>
                  <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                    <p>Hello ${request.user.name || 'Artist'},</p>
                    <p>Your request to upgrade from <strong>${request.currentLevel}</strong> to <strong>${request.requestedLevel}</strong> has been approved!</p>

                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Your Artist Details:</h3>
                      <p><strong>Artist Level:</strong> ${request.requestedLevel}</p>
                      <p><strong>Approved On:</strong> ${new Date().toLocaleString()}</p>
                      ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL}/artists/dashboard" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Artist Dashboard</a>
                    </div>

                    <p>You now have access to all features available to ${request.requestedLevel} artists.</p>
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    <p>Thank you for being part of our community!</p>
                    <p>Best regards,<br>The Rapira Team</p>
                  </div>
                  <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
                    <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
          text: `Congratulations! Your request to upgrade from ${request.currentLevel} to ${request.requestedLevel} has been approved. You now have access to all features available to ${request.requestedLevel} artists. ${adminNotes ? `Admin Notes: ${adminNotes}` : ''} Visit your artist dashboard at ${process.env.BASE_URL}/artists/dashboard`
        });
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
      }
    } else {
      console.log('Could not send approval email: User not found or email missing');
    }

    req.flash('success', 'Upgrade request approved successfully');
    res.redirect('/admin/artist-upgrade-requests');
  } catch (error) {
    console.error('Error in approve upgrade request:', error);
    req.flash('error', 'An error occurred while approving the upgrade request');
    res.redirect(`/admin/artist-upgrade-requests/${req.params.id}`);
  }
});

// Admin: Reject upgrade request
router.post('/admin/artist-upgrade-requests/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminNotes } = req.body;

    if (!adminNotes) {
      req.flash('error', 'Please provide a reason for rejection');
      return res.redirect(`/admin/artist-upgrade-requests/${req.params.id}`);
    }

    const request = await ArtistUpgradeRequest.findById(req.params.id)
      .populate('user');

    if (!request) {
      req.flash('error', 'Upgrade request not found');
      return res.redirect('/admin/artist-upgrade-requests');
    }

    // Check if request is already processed
    if (request.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/artist-upgrade-requests/${req.params.id}`);
    }

    // Update request status
    request.status = 'rejected';
    request.adminNotes = adminNotes;
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('ArtistUpgradeRequest', request._id, 'rejected');

    // Send email notification to artist if user exists
    if (request.user && request.user.email) {
      try {
        await sendEmail({
          to: request.user.email,
          subject: 'Your Artist Level Upgrade Request Has Been Rejected',
          html: `
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #6366f1; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Artist Upgrade Request Update</h1>
                  </div>
                  <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                    <p>Hello ${request.user.name || 'Artist'},</p>
                    <p>Your request to upgrade from <strong>${request.currentLevel}</strong> to <strong>${request.requestedLevel}</strong> has been reviewed but could not be approved at this time.</p>

                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Feedback from our team:</h3>
                      <p>${adminNotes}</p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL}/learning" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Continue Learning</a>
                    </div>

                    <p>You can continue to improve your skills and submit another request in the future.</p>
                    <p>If you have any questions or need further clarification, please don't hesitate to contact our support team.</p>
                    <p>Best regards,<br>The Rapira Team</p>
                  </div>
                  <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
                    <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
          text: `Your request to upgrade from ${request.currentLevel} to ${request.requestedLevel} has been reviewed but could not be approved at this time. Reason: ${adminNotes}. You can continue to improve your skills and submit another request in the future.`
        });
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
      }
    } else {
      console.log('Could not send rejection email: User not found or email missing');
    }

    req.flash('success', 'Upgrade request rejected successfully');
    res.redirect('/admin/artist-upgrade-requests');
  } catch (error) {
    console.error('Error in reject upgrade request:', error);
    req.flash('error', 'An error occurred while rejecting the upgrade request');
    res.redirect(`/admin/artist-upgrade-requests/${req.params.id}`);
  }
});

// Admin: Confirm delete upgrade request
router.get('/admin/artist-upgrade-requests/:id/confirm-delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ArtistUpgradeRequest.findById(req.params.id)
      .populate('user')
      .populate('artist')
      .populate('reviewedBy');

    if (!request) {
      req.flash('error', 'Upgrade request not found');
      return res.redirect('/admin/artist-upgrade-requests');
    }

    res.render('admin/confirm-delete-upgrade-request', {
      layout: 'admin',
      title: 'Confirm Delete Upgrade Request',
      currentPath: '/admin/artist-upgrade-requests',
      request
    });
  } catch (error) {
    console.error('Error in confirm delete upgrade request:', error);
    req.flash('error', 'An error occurred while loading the confirmation page');
    res.redirect('/admin/artist-upgrade-requests');
  }
});

// Admin: Delete upgrade request
router.post('/admin/artist-upgrade-requests/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ArtistUpgradeRequest.findById(req.params.id);

    if (!request) {
      req.flash('error', 'Upgrade request not found');
      return res.redirect('/admin/artist-upgrade-requests');
    }

    // Delete the upgrade request
    await ArtistUpgradeRequest.findByIdAndDelete(req.params.id);
    console.log(`Deleted artist upgrade request: ${req.params.id}`);

    req.flash('success', 'Artist upgrade request deleted successfully');
    res.redirect('/admin/artist-upgrade-requests');
  } catch (error) {
    console.error('Error in delete upgrade request:', error);
    req.flash('error', 'An error occurred while deleting the upgrade request');
    res.redirect('/admin/artist-upgrade-requests');
  }
});

module.exports = router;
