const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const ProducerApplication = require('../models/ProducerApplication');
const ProducerUnblockRequest = require('../models/ProducerUnblockRequest');

// GET - List all producers with filters
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status, search, sortBy } = req.query;

    // Get producer role
    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    if (!producerRole) {
      req.flash('error', 'Producer role not found');
      return res.redirect('/admin');
    }

    // Get all user role assignments for producers
    let userRoles = await UserRole.find({ role: producerRole._id })
      .populate('user')
      .sort({ createdAt: -1 });

    // Deduplicate producers in case of multiple role assignments
    const uniqueUserRoles = [];
    const seenUserIds = new Set();
    userRoles.forEach(userRole => {
      if (!userRole.user) return;
      const userId = userRole.user._id.toString();
      if (seenUserIds.has(userId)) return;
      seenUserIds.add(userId);
      uniqueUserRoles.push(userRole);
    });

    // Calculate stats
    let totalProducers = uniqueUserRoles.length;

    // Get approved applications count
    const approvedApps = await ProducerApplication.countDocuments({ status: 'approved' });
    const pendingApps = await ProducerApplication.countDocuments({ status: 'pending' });
    const rejectedApps = await ProducerApplication.countDocuments({ status: 'rejected' });

    // Extract users and apply filters
    let producers = uniqueUserRoles.map(ur => ur.user);

    // Search filter
    if (search) {
      producers = producers.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Status filter - based on application status
    if (status) {
      const applications = await ProducerApplication.find({ status })
        .select('user');
      const appUserIds = applications.map(app => app.user.toString());
      producers = producers.filter(user => appUserIds.includes(user._id.toString()));
    }

    // Sort
    if (sortBy === 'name') {
      producers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      // Already sorted by creation date above
    } else if (sortBy === 'email') {
      producers.sort((a, b) => a.email.localeCompare(b.email));
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(producers.length / limit);
    const paginatedProducers = producers.slice(skip, skip + limit);

    // Get applications for these producers
    const producerIds = paginatedProducers.map(p => p._id);
    const applications = await ProducerApplication.find({ user: { $in: producerIds } })
      .sort({ reviewedAt: -1 });

    const appMap = {};
    applications.forEach(app => {
      appMap[app.user.toString()] = app;
    });

    res.render('admin/producers', {
      layout: 'layouts/admin',
      title: 'Manage Producers',
      producers: paginatedProducers,
      appMap,
      stats: {
        total: totalProducers,
        approved: approvedApps,
        pending: pendingApps,
        rejected: rejectedApps
      },
      currentPage: page,
      totalPages,
      limit,
      filters: { status, search, sortBy },
      currentPath: '/admin/producers'
    });
  } catch (error) {
    console.error('Error loading producers list:', error);
    req.flash('error', 'Failed to load producers list');
    res.redirect('/admin');
  }
});

// ===== BLOCK/UNBLOCK PAGES (must be before /:id routes) =====

// GET - Block producer page
router.get('/:id/block', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    if (user.isBlocked) {
      req.flash('warning', 'This producer is already blocked');
      return res.redirect(`/admin/producers/${user._id}`);
    }

    res.render('admin/producer-block', {
      layout: 'layouts/admin',
      title: `Block Producer - ${user.name}`,
      producer: user,
      currentPath: '/admin/producers'
    });
  } catch (error) {
    console.error('Error loading block page:', error);
    req.flash('error', 'Failed to load block page');
    res.redirect('/admin/producers');
  }
});

// POST - Block producer
router.post('/:id/block', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { blockReason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    const blockDate = new Date();

    user.isBlocked = true;
    user.blockReason = blockReason || 'Violated platform policies';
    user.blockedAt = blockDate;
    user.blockedBy = req.session.user.id;

    await user.save();

    req.flash('success', 'Producer blocked successfully');
    res.redirect('/admin/producers');
  } catch (error) {
    console.error('Block producer error:', error);
    req.flash('error', 'Failed to block producer');
    res.redirect('/admin/producers');
  }
});

// GET - Unblock producer page
router.get('/:id/unblock', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    if (!user.isBlocked) {
      req.flash('warning', 'This producer is not blocked');
      return res.redirect(`/admin/producers/${user._id}`);
    }

    // Get pending unblock requests
    const unblockRequests = await ProducerUnblockRequest.find({ producer: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('admin/producer-unblock', {
      layout: 'layouts/admin',
      title: `Unblock Producer - ${user.name}`,
      producer: user,
      unblockRequests,
      currentPath: '/admin/producers'
    });
  } catch (error) {
    console.error('Error loading unblock page:', error);
    req.flash('error', 'Failed to load unblock page');
    res.redirect('/admin/producers');
  }
});

// POST - Unblock producer
router.post('/:id/unblock', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { unblockReason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    if (!user.isBlocked) {
      req.flash('warning', 'This producer is not blocked');
      return res.redirect('/admin/producers');
    }

    const unblockDate = new Date();

    user.isBlocked = false;
    user.blockReason = '';
    user.unblockReason = unblockReason || '';
    user.unblockedAt = unblockDate;
    user.unblockedBy = req.session.user.id;

    await user.save();

    req.flash('success', 'Producer unblocked successfully');
    res.redirect('/admin/producers');
  } catch (error) {
    console.error('Unblock producer error:', error);
    req.flash('error', 'Failed to unblock producer');
    res.redirect('/admin/producers');
  }
});

// ===== UNBLOCK REQUEST ROUTES (must be before /:id routes) =====

// GET - Unblock requests list
router.get('/unblock-requests', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status, search, sortBy } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (status) query.status = status;

    let requests = await ProducerUnblockRequest.find(query)
      .populate('producer')
      .populate('reviewedBy')
      .sort({ createdAt: -1 });

    // Apply search filter
    if (search) {
      requests = requests.filter(req =>
        req.producer.name.toLowerCase().includes(search.toLowerCase()) ||
        req.producer.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply sort
    if (sortBy === 'name') {
      requests.sort((a, b) => a.producer.name.localeCompare(b.producer.name));
    } else if (sortBy === 'oldest') {
      requests.reverse();
    }

    // Pagination
    const totalPages = Math.ceil(requests.length / limit);
    const paginatedRequests = requests.slice(skip, skip + limit);

    // Get statistics
    const stats = {
      total: await ProducerUnblockRequest.countDocuments(),
      pending: await ProducerUnblockRequest.countDocuments({ status: 'pending' }),
      approved: await ProducerUnblockRequest.countDocuments({ status: 'approved' }),
      rejected: await ProducerUnblockRequest.countDocuments({ status: 'rejected' })
    };

    res.render('admin/producer-unblock-requests', {
      layout: 'layouts/admin',
      title: 'Producer Unblock Requests',
      requests: paginatedRequests,
      stats,
      currentPage: page,
      totalPages,
      limit,
      filters: { status, search, sortBy },
      currentPath: '/admin/producers/unblock-requests'
    });
  } catch (error) {
    console.error('Error loading unblock requests:', error);
    req.flash('error', 'Failed to load unblock requests');
    res.redirect('/admin/producers');
  }
});

router.post('/unblock-requests/delete-all', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const result = await ProducerUnblockRequest.deleteMany({});
    req.flash('success', `Deleted ${result.deletedCount} producer unblock request record(s)`);
    res.redirect('/admin/producers/unblock-requests');
  } catch (error) {
    console.error('Error deleting all unblock request records:', error);
    req.flash('error', 'Failed to delete producer unblock request history');
    res.redirect('/admin/producers/unblock-requests');
  }
});

// GET - Unblock request details
router.get('/unblock-requests/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ProducerUnblockRequest.findById(req.params.id)
      .populate('producer')
      .populate('reviewedBy');

    if (!request) {
      req.flash('error', 'Unblock request not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    res.render('admin/producer-unblock-request-details', {
      layout: 'layouts/admin',
      title: `Unblock Request - ${request.producer.name}`,
      request,
      currentPath: '/admin/producers/unblock-requests'
    });
  } catch (error) {
    console.error('Error loading unblock request details:', error);
    req.flash('error', 'Failed to load unblock request');
    res.redirect('/admin/producers/unblock-requests');
  }
});

// GET - Approve unblock request page
router.get('/unblock-requests/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ProducerUnblockRequest.findById(req.params.id)
      .populate('producer')
      .populate('reviewedBy');

    if (!request) {
      req.flash('error', 'Unblock request not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    if (request.status !== 'pending') {
      req.flash('error', 'This request has already been reviewed');
      return res.redirect(`/admin/producers/unblock-requests/${req.params.id}`);
    }

    res.render('admin/producer-unblock-approve', {
      layout: 'layouts/admin',
      title: `Approve Unblock Request - ${request.producer.name}`,
      request,
      currentPath: '/admin/producers/unblock-requests'
    });
  } catch (error) {
    console.error('Error loading approve page:', error);
    req.flash('error', 'Failed to load approve page');
    res.redirect('/admin/producers/unblock-requests');
  }
});

// GET - Reject unblock request page
router.get('/unblock-requests/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ProducerUnblockRequest.findById(req.params.id)
      .populate('producer')
      .populate('reviewedBy');

    if (!request) {
      req.flash('error', 'Unblock request not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    if (request.status !== 'pending') {
      req.flash('error', 'This request has already been reviewed');
      return res.redirect(`/admin/producers/unblock-requests/${req.params.id}`);
    }

    res.render('admin/producer-unblock-reject', {
      layout: 'layouts/admin',
      title: `Reject Unblock Request - ${request.producer.name}`,
      request,
      currentPath: '/admin/producers/unblock-requests'
    });
  } catch (error) {
    console.error('Error loading reject page:', error);
    req.flash('error', 'Failed to load reject page');
    res.redirect('/admin/producers/unblock-requests');
  }
});

// POST - Approve unblock request
router.post('/unblock-requests/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminResponse } = req.body;
    const request = await ProducerUnblockRequest.findById(req.params.id);
    if (!request) {
      req.flash('error', 'Request not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    const producer = await User.findById(request.producer);
    if (!producer) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    // Unblock the producer
    producer.isBlocked = false;
    producer.blockReason = '';
    await producer.save();

    // Update request
    request.status = 'approved';
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();
    request.adminResponse = adminResponse || 'Your unblock request has been approved';
    await request.save();

    req.flash('success', `${producer.name} has been unblocked successfully`);
    res.redirect(`/admin/producers/unblock-requests/${req.params.id}`);
  } catch (error) {
    console.error('Error approving unblock request:', error);
    req.flash('error', 'Failed to approve unblock request: ' + error.message);
    res.redirect('/admin/producers/unblock-requests');
  }
});

// POST - Reject unblock request
router.post('/unblock-requests/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminResponse } = req.body;

    if (!adminResponse || !adminResponse.trim()) {
      req.flash('error', 'Rejection reason is required');
      return res.redirect(`/admin/producers/unblock-requests/${req.params.id}/reject`);
    }

    const request = await ProducerUnblockRequest.findById(req.params.id);
    if (!request) {
      req.flash('error', 'Request not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    // Update request without unblocking
    request.status = 'rejected';
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();
    request.adminResponse = adminResponse;
    await request.save();

    req.flash('success', 'Unblock request rejected');
    res.redirect(`/admin/producers/unblock-requests/${req.params.id}`);
  } catch (error) {
    console.error('Error rejecting unblock request:', error);
    req.flash('error', 'Failed to reject unblock request: ' + error.message);
    res.redirect('/admin/producers/unblock-requests');
  }
});

router.post('/unblock-requests/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const deletedRequest = await ProducerUnblockRequest.findByIdAndDelete(req.params.id);

    if (!deletedRequest) {
      req.flash('error', 'Unblock request not found');
      return res.redirect('/admin/producers/unblock-requests');
    }

    req.flash('success', 'Producer unblock request record deleted successfully');
    res.redirect('/admin/producers/unblock-requests');
  } catch (error) {
    console.error('Error deleting unblock request record:', error);
    req.flash('error', 'Failed to delete producer unblock request record');
    res.redirect('/admin/producers/unblock-requests');
  }
});

// ===== ADMIN PRODUCER BEATS MANAGEMENT =====

// GET - View all producer beats
router.get('/beats', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const ProducerBeat = require('../models/ProducerBeat');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const totalBeats = await ProducerBeat.countDocuments();
    const totalPages = Math.ceil(totalBeats / limit);

    const beats = await ProducerBeat.find()
      .populate('producer', 'name email profileImage')
      .populate('bannedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/producer-beats', {
      layout: 'layouts/admin',
      title: 'Manage Producer Beats',
      currentPath: '/admin/producers/beats',
      beats,
      currentPage: page,
      totalPages,
      limit,
      totalBeats
    });
  } catch (error) {
    console.error('Error fetching producer beats for admin:', error);
    req.flash('error', 'Failed to load producer beats');
    res.redirect('/admin/producers');
  }
});

// POST - Toggle ban on a beat
router.post('/beats/:id/toggle-ban', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const ProducerBeat = require('../models/ProducerBeat');
    const { banReason } = req.body;
    const beat = await ProducerBeat.findById(req.params.id).populate('producer');

    if (!beat) {
      req.flash('error', 'Beat not found');
      return res.redirect('/admin/producers/beats');
    }

    if (beat.isBanned) {
      beat.isBanned = false;
      beat.bannedBy = null;
      beat.banReason = '';
      req.flash('success', `Beat unbanned successfully!`);
    } else {
      beat.isBanned = true;
      beat.bannedBy = req.session.user.id;
      beat.banReason = banReason || 'Violated platform policies';
      req.flash('success', `Beat banned successfully!`);
    }

    await beat.save();
    res.redirect('/admin/producers/beats');
  } catch (error) {
    console.error('Error toggling beat ban status:', error);
    req.flash('error', 'Failed to toggle ban status');
    res.redirect('/admin/producers/beats');
  }
});

// POST - Delete a beat (Admin)
router.post('/beats/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const ProducerBeat = require('../models/ProducerBeat');
    const beat = await ProducerBeat.findById(req.params.id);

    if (!beat) {
      req.flash('error', 'Beat not found');
      return res.redirect('/admin/producers/beats');
    }

    await ProducerBeat.deleteOne({ _id: beat._id });

    req.flash('success', 'Beat permanently deleted');
    res.redirect('/admin/producers/beats');
  } catch (error) {
    console.error('Error deleting beat (admin):', error);
    req.flash('error', 'Failed to delete beat');
    res.redirect('/admin/producers/beats');
  }
});

// ===== PRODUCER ROLE REVOKE ROUTES (must be before /:id routes) =====

// GET - Confirm revoke producer role
router.get('/:id/revoke', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    if (!producerRole) {
      req.flash('error', 'Producer role not found');
      return res.redirect('/admin/producers');
    }

    const userRole = await UserRole.findOne({ user: user._id, role: producerRole._id });
    if (!userRole) {
      req.flash('warning', 'This user does not currently have the producer role');
      return res.redirect(`/admin/producers/${user._id}`);
    }

    res.render('admin/confirm-revoke-producer-role', {
      layout: 'layouts/admin',
      title: `Revoke Producer Role - ${user.name}`,
      producer: user,
      currentPath: '/admin/producers'
    });
  } catch (error) {
    console.error('Error loading revoke producer role page:', error);
    req.flash('error', 'Failed to load revoke producer role page');
    res.redirect('/admin/producers');
  }
});

// ===== PRODUCER DETAIL ROUTES =====

// GET - Producer details
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    // Get producer role and their assignment
    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const userRole = await UserRole.findOne({ user: user._id, role: producerRole._id })
      .populate('role');

    if (!userRole) {
      req.flash('error', 'This user is not a producer');
      return res.redirect('/admin/producers');
    }

    // Get producer application
    const application = await ProducerApplication.findOne({ user: user._id })
      .populate('reviewedBy')
      .populate('idProofMedia');

    // Get activity stats
    const stats = {
      rolesAssigned: await UserRole.countDocuments({ user: user._id }),
      applicationsReviewed: await ProducerApplication.countDocuments({ reviewedBy: user._id }),
      createdAt: userRole.createdAt
    };

    res.render('admin/producer-details', {
      layout: 'layouts/admin',
      title: `Producer Details - ${user.name}`,
      producer: user,
      application,
      stats,
      currentPath: '/admin/producers'
    });
  } catch (error) {
    console.error('Error loading producer details:', error);
    req.flash('error', 'Failed to load producer details');
    res.redirect('/admin/producers');
  }
});

// POST - Revoke producer role
router.post('/:id/revoke', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      if (req.xhr || (req.headers.accept || '').includes('application/json')) {
        return res.json({ success: false, message: 'Producer not found' });
      }
      req.flash('error', 'Producer not found');
      return res.redirect('/admin/producers');
    }

    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const deleted = await UserRole.findOneAndDelete({ user: user._id, role: producerRole._id });

    if (deleted) {
      req.flash('success', `Producer role revoked from ${user.name}`);
      if (req.xhr || (req.headers.accept || '').includes('application/json')) {
        return res.json({ success: true });
      }
      return res.redirect('/admin/producers');
    }

    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.json({ success: false, message: 'Producer role not found' });
    }
    req.flash('warning', 'Producer role not found');
    return res.redirect('/admin/producers');
  } catch (error) {
    console.error('Error revoking producer role:', error);
    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.json({ success: false, message: error.message });
    }
    req.flash('error', 'Failed to revoke producer role');
    return res.redirect('/admin/producers');
  }
});

// POST - Block/Unblock producer
router.post('/:id/toggle-block', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.json({ success: false, message: 'Producer not found' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    req.flash('success', `Producer ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`);
    res.json({ success: true, isBlocked: user.isBlocked });
  } catch (error) {
    console.error('Error toggling producer block status:', error);
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
