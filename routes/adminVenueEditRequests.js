const express = require('express');
const router = express.Router();
const VenueEditRequest = require('../models/VenueEditRequest');
const Venue = require('../models/Venue');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// GET /admin/venue-edit-requests - List all venue edit requests
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status = 'all', page = 1, dateRange = '', search = '' } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build filter query
    let filter = {};
    if (status !== 'all') {
      filter.status = status;
    }

    // Add date range filtering
    if (dateRange) {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      if (startDate) {
        filter.createdAt = { $gte: startDate };
      }
    }

    // Get edit requests with pagination and search
    let editRequests = await VenueEditRequest.find(filter)
      .populate('venue', 'name city state')
      .populate('user', 'name email')
      .populate('adminResponse.reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Apply search filter after population if search term exists
    if (search) {
      editRequests = editRequests.filter(request => {
        const venueName = request.venue?.name?.toLowerCase() || '';
        const venueCity = request.venue?.city?.toLowerCase() || '';
        const venueState = request.venue?.state?.toLowerCase() || '';
        const userName = request.user?.name?.toLowerCase() || '';
        const userEmail = request.user?.email?.toLowerCase() || '';
        const searchLower = search.toLowerCase();
        
        return venueName.includes(searchLower) || 
               venueCity.includes(searchLower) || 
               venueState.includes(searchLower) ||
               userName.includes(searchLower) || 
               userEmail.includes(searchLower);
      });
    }

    // Get total count for pagination
    const totalRequests = await VenueEditRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalRequests / limit);

    // Get counts by status for stats
    const statusCounts = await VenueEditRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      total: totalRequests,
      pending: statusCounts.find(s => s._id === 'pending')?.count || 0,
      approved: statusCounts.find(s => s._id === 'approved')?.count || 0,
      rejected: statusCounts.find(s => s._id === 'rejected')?.count || 0
    };

    res.render('admin/venue-edit-requests/index', {
      title: 'Venue Edit Requests',
      editRequests,
      currentPage: parseInt(page),
      totalPages,
      status: status, // Pass as 'status' to match template
      dateRange: dateRange, // Pass dateRange variable
      search: search, // Pass search variable
      stats,
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Error fetching venue edit requests:', error);
    req.flash('error', 'Failed to load venue edit requests');
    res.redirect('/admin');
  }
});

// GET /admin/venue-edit-requests/:id - View specific edit request
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await VenueEditRequest.findById(req.params.id)
      .populate('venue')
      .populate('user', 'name email')
      .populate('adminResponse.reviewedBy', 'name');

    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/venue-edit-requests');
    }

    res.render('admin/venue-edit-requests/details', {
      title: 'Venue Edit Request Details',
      editRequest,
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Error fetching edit request:', error);
    req.flash('error', 'Failed to load edit request');
    res.redirect('/admin/venue-edit-requests');
  }
});

// POST /admin/venue-edit-requests/:id/approve - Approve edit request
router.post('/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await VenueEditRequest.findById(req.params.id).populate('venue');
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/venue-edit-requests');
    }

    if (editRequest.status !== 'pending') {
      req.flash('error', 'This edit request has already been processed');
      return res.redirect(`/admin/venue-edit-requests/${req.params.id}`);
    }

    const venue = editRequest.venue;
    
    // Apply the requested changes to the venue
    const updates = editRequest.requestedChanges;
    
    // Handle image updates
    if (editRequest.newImages && editRequest.newImages.length > 0) {
      venue.images = venue.images || [];
      venue.images.push(...editRequest.newImages);
    }
    
    if (editRequest.imagesToRemove && editRequest.imagesToRemove.length > 0) {
      venue.images = venue.images.filter(img => !editRequest.imagesToRemove.includes(img));
      
      // Delete physical files
      editRequest.imagesToRemove.forEach(imagePath => {
        const fullPath = path.join(__dirname, '../public', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    // Apply other changes
    Object.keys(updates).forEach(key => {
      if (key !== 'images') {
        // Handle venueType validation - convert invalid types to closest valid one
        if (key === 'venueType') {
          const validTypes = ['Indoor Hall', 'Outdoor Venue', 'Auditorium', 'Stadium', 'Club', 'Restaurant', 'Hotel', 'Community Center', 'Other'];
          if (!validTypes.includes(updates[key])) {
            // Map common invalid types to valid ones
            if (updates[key] === 'Concert Hall') {
              venue[key] = 'Auditorium'; // Closest match for Concert Hall
            } else {
              venue[key] = 'Other'; // Default fallback
            }
          } else {
            venue[key] = updates[key];
          }
        } else {
          venue[key] = updates[key];
        }
      }
    });

    await venue.save();

    // Update edit request status
    editRequest.status = 'approved';
    editRequest.adminResponse = {
      reviewedBy: req.session.user.id,
      reviewedAt: new Date(),
      comment: req.body.comment || 'Request approved'
    };

    await editRequest.save();

    req.flash('success', 'Venue edit request approved successfully');
    res.redirect('/admin/venue-edit-requests');

  } catch (error) {
    console.error('Error approving edit request:', error);
    req.flash('error', 'Failed to approve edit request');
    res.redirect(`/admin/venue-edit-requests/${req.params.id}`);
  }
});

// POST /admin/venue-edit-requests/:id/reject - Reject edit request
router.post('/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await VenueEditRequest.findById(req.params.id);
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/venue-edit-requests');
    }

    if (editRequest.status !== 'pending') {
      req.flash('error', 'This edit request has already been processed');
      return res.redirect(`/admin/venue-edit-requests/${req.params.id}`);
    }

    // Delete uploaded images if any
    if (editRequest.newImages && editRequest.newImages.length > 0) {
      editRequest.newImages.forEach(imagePath => {
        const fullPath = path.join(__dirname, '../public', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    // Update edit request status
    editRequest.status = 'rejected';
    editRequest.adminResponse = {
      reviewedBy: req.session.user.id,
      reviewedAt: new Date(),
      comment: req.body.comment || 'Request rejected'
    };

    await editRequest.save();

    req.flash('success', 'Venue edit request rejected');
    res.redirect('/admin/venue-edit-requests');

  } catch (error) {
    console.error('Error rejecting edit request:', error);
    req.flash('error', 'Failed to reject edit request');
    res.redirect(`/admin/venue-edit-requests/${req.params.id}`);
  }
});

// POST /admin/venue-edit-requests/:id/delete - Delete edit request
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const editRequest = await VenueEditRequest.findById(req.params.id);
    
    if (!editRequest) {
      req.flash('error', 'Edit request not found');
      return res.redirect('/admin/venue-edit-requests');
    }

    // Delete the edit request
    await VenueEditRequest.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Venue edit request deleted successfully');
    res.redirect('/admin/venue-edit-requests');

  } catch (error) {
    console.error('Error deleting edit request:', error);
    req.flash('error', 'Failed to delete edit request');
    res.redirect(`/admin/venue-edit-requests`);
  }
});

module.exports = router;
