const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const ConcertEditRequest = require('../models/ConcertEditRequest');
const Artist = require('../models/Artist');
const Venue = require('../models/Venue');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// List all concert edit requests
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status = 'all', sort = 'newest' } = req.query;
    
    // Build filter
    const filter = {};
    if (status !== 'all') {
      filter.status = status;
    }
    
    // Build sort
    let sortOption = { requestedAt: -1 }; // Default: newest first
    if (sort === 'oldest') sortOption = { requestedAt: 1 };
    
    const editRequests = await ConcertEditRequest.find(filter)
      .populate({
        path: 'concert',
        populate: {
          path: 'venue',
          model: 'Venue'
        }
      })
      .populate({
        path: 'artist',
        populate: {
          path: 'user',
          model: 'User'
        }
      })
      .populate('adminResponse.respondedBy')
      .sort(sortOption);
    
    // Get counts for dashboard stats
    const stats = await ConcertEditRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: editRequests.length
    };
    
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });
    
    res.render('admin/concert-edit-requests/index', {
      title: 'Concert Edit Requests Management',
      editRequests,
      statusCounts,
      currentStatus: status,
      currentSort: sort,
      user: req.session.user,
      layout: 'admin'
    });
    
  } catch (error) {
    console.error('Error fetching concert edit requests:', error);
    req.flash('error', 'Failed to load concert edit requests');
    res.redirect('/admin/dashboard');
  }
});

// View specific edit request details
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await ConcertEditRequest.findById(req.params.id)
      .populate({
        path: 'concert',
        populate: {
          path: 'venue',
          model: 'Venue'
        }
      })
      .populate({
        path: 'artist',
        populate: {
          path: 'user',
          model: 'User'
        }
      })
      .populate('adminResponse.respondedBy')
      .populate({
        path: 'requestedChanges.venue',
        model: 'Venue'
      });
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    // Get venue details if venue is being changed
    let requestedVenue = null;
    if (editRequest.requestedChanges.venue) {
      requestedVenue = await Venue.findById(editRequest.requestedChanges.venue);
    }
    
    res.render('admin/concert-edit-requests/detail', {
      title: 'Concert Edit Request Details',
      editRequest,
      requestedVenue,
      user: req.session.user,
      layout: 'admin'
    });
    
  } catch (error) {
    console.error('Error fetching edit request details:', error);
    req.flash('error', 'Failed to load edit request details');
    res.redirect('/admin/concert-edit-requests');
  }
});

// Show approve edit request page
router.get('/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await ConcertEditRequest.findById(req.params.id)
      .populate({
        path: 'concert',
        populate: {
          path: 'venue',
          model: 'Venue'
        }
      })
      .populate({
        path: 'artist',
        populate: {
          path: 'user',
          model: 'User'
        }
      });

    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/concert-edit-requests');
    }

    if (editRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/concert-edit-requests/${editRequest._id}`);
    }

    // Get requested venue info if venue was changed
    let requestedVenue = null;
    if (editRequest.requestedChanges.venue) {
      const Venue = require('../models/Venue');
      requestedVenue = await Venue.findById(editRequest.requestedChanges.venue);
    }

    res.render('admin/concert-edit-requests/approve', {
      layout: 'admin',
      title: 'Approve Edit Request',
      editRequest,
      requestedVenue,
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error loading approve page:', error);
    req.flash('error', 'Failed to load approve page');
    res.redirect('/admin/concert-edit-requests');
  }
});

// Show reject edit request page  
router.get('/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await ConcertEditRequest.findById(req.params.id)
      .populate({
        path: 'concert',
        populate: {
          path: 'venue',
          model: 'Venue'
        }
      })
      .populate({
        path: 'artist',
        populate: {
          path: 'user',
          model: 'User'
        }
      });

    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/concert-edit-requests');
    }

    if (editRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/concert-edit-requests/${editRequest._id}`);
    }

    // Get requested venue info if venue was changed
    let requestedVenue = null;
    if (editRequest.requestedChanges.venue) {
      const Venue = require('../models/Venue');
      requestedVenue = await Venue.findById(editRequest.requestedChanges.venue);
    }

    res.render('admin/concert-edit-requests/reject', {
      layout: 'admin',
      title: 'Reject Edit Request',
      editRequest,
      requestedVenue,
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error loading reject page:', error);
    req.flash('error', 'Failed to load reject page');
    res.redirect('/admin/concert-edit-requests');
  }
});

// Approve edit request
router.post('/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminMessage } = req.body;
    
    const editRequest = await ConcertEditRequest.findById(req.params.id)
      .populate('concert');
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    if (editRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    // Apply the requested changes to the concert
    const concert = await Concert.findById(editRequest.concert._id);
    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    // Update concert with requested changes
    const changes = editRequest.requestedChanges;
    if (changes.title) concert.title = changes.title;
    if (changes.description) concert.description = changes.description;
    if (changes.date) concert.date = changes.date;
    if (changes.time) concert.time = changes.time;
    if (changes.venue) {
      concert.venue = changes.venue;
      if (changes.city) concert.city = changes.city;
    }
    if (changes.price !== undefined) concert.price = changes.price;
    if (changes.maxTickets !== undefined) concert.maxTickets = changes.maxTickets;
    if (changes.posterImage) concert.posterImage = changes.posterImage;
    
    await concert.save();
    
    // Update edit request status
    editRequest.status = 'approved';
    editRequest.adminResponse = {
      message: adminMessage || 'Edit request approved successfully',
      respondedBy: req.session.user.id,
      respondedAt: new Date()
    };
    
    await editRequest.save();
    
    req.flash('success', 'Edit request approved and concert updated successfully');
    res.redirect('/admin/concert-edit-requests');
    
  } catch (error) {
    console.error('Error approving edit request:', error);
    req.flash('error', 'Failed to approve edit request');
    res.redirect('/admin/concert-edit-requests');
  }
});

// Reject edit request
router.post('/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminMessage } = req.body;
    
    const editRequest = await ConcertEditRequest.findById(req.params.id);
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    if (editRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    // Update edit request status
    editRequest.status = 'rejected';
    editRequest.adminResponse = {
      message: adminMessage || 'Edit request rejected',
      respondedBy: req.session.user.id,
      respondedAt: new Date()
    };
    
    await editRequest.save();
    
    req.flash('success', 'Edit request rejected successfully');
    res.redirect('/admin/concert-edit-requests');
    
  } catch (error) {
    console.error('Error rejecting edit request:', error);
    req.flash('error', 'Failed to reject edit request');
    res.redirect('/admin/concert-edit-requests');
  }
});

// Delete edit request (only for processed requests)
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await ConcertEditRequest.findById(req.params.id);
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    if (editRequest.status === 'pending') {
      req.flash('error', 'Cannot delete pending edit requests. Please approve or reject first.');
      return res.redirect('/admin/concert-edit-requests');
    }
    
    await ConcertEditRequest.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Edit request deleted successfully');
    res.redirect('/admin/concert-edit-requests');
    
  } catch (error) {
    console.error('Error deleting edit request:', error);
    req.flash('error', 'Failed to delete edit request');
    res.redirect('/admin/concert-edit-requests');
  }
});

module.exports = router;
