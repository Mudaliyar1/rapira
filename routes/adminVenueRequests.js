const express = require('express');
const router = express.Router();
const VenueRequest = require('../models/VenueRequest');
const Venue = require('../models/Venue');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { toISTCustomFormat } = require('../utils/dateFormatter');

// GET /admin/venue-requests - List all venue requests
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status, city, search, page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (city && city !== 'all') {
      filter.city = new RegExp(city, 'i');
    }
    
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { address: new RegExp(search, 'i') },
        { city: new RegExp(search, 'i') },
        { state: new RegExp(search, 'i') }
      ];
    }

    // Get venue requests with pagination
    const venueRequests = await VenueRequest.find(filter)
      .populate('user', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('createdVenue', 'name isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalRequests = await VenueRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalRequests / limit);

    // Get stats for dashboard
    const totalCount = await VenueRequest.countDocuments();
    const pendingCount = await VenueRequest.countDocuments({ status: 'pending' });
    const approvedCount = await VenueRequest.countDocuments({ status: 'approved' });
    const rejectedCount = await VenueRequest.countDocuments({ status: 'rejected' });

    // Get unique cities for filter dropdown
    const allCities = await VenueRequest.distinct('city');

    res.render('admin/venue-requests/index', {
      layout: 'admin',
      currentPath: '/admin/venue-requests',
      title: 'Venue Registration Requests',
      venueRequests,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      filters: {
        status: status || 'all',
        city: city || 'all',
        search: search || '',
        cities: allCities
      }
    });
  } catch (error) {
    console.error('Error loading venue requests:', error);
    req.flash('error', 'Failed to load venue requests');
    res.redirect('/admin');
  }
});

// GET /admin/venue-requests/:id - View specific venue request details
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('reviewedBy', 'name email')
      .populate('createdVenue', 'name isActive');

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/admin/venue-requests');
    }

    res.render('admin/venue-requests/details', {
      layout: 'admin',
      currentPath: '/admin/venue-requests',
      title: `Venue Request - ${venueRequest.name}`,
      venueRequest
    });
  } catch (error) {
    console.error('Error loading venue request details:', error);
    req.flash('error', 'Failed to load venue request details');
    res.redirect('/admin/venue-requests');
  }
});

// GET /admin/venue-requests/:id/approve - Show approve form
router.get('/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findById(req.params.id)
      .populate('user', 'name email');

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/admin/venue-requests');
    }

    if (venueRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/venue-requests/${venueRequest._id}`);
    }

    res.render('admin/venue-requests/approve', {
      layout: 'admin',
      currentPath: '/admin/venue-requests',
      title: `Approve Venue Request - ${venueRequest.name}`,
      venueRequest
    });
  } catch (error) {
    console.error('Error loading approve form:', error);
    req.flash('error', 'Failed to load approve form');
    res.redirect('/admin/venue-requests');
  }
});

// POST /admin/venue-requests/:id/approve - Approve venue request
router.post('/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminNotes, autoActivate } = req.body;

    const venueRequest = await VenueRequest.findById(req.params.id)
      .populate('user', 'name email');

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/admin/venue-requests');
    }

    if (venueRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/venue-requests/${venueRequest._id}`);
    }

    // Create the actual venue from the request
    const venue = new Venue({
      name: venueRequest.name,
      address: venueRequest.address,
      city: venueRequest.city,
      state: venueRequest.state,
      pincode: venueRequest.pincode,
      capacity: venueRequest.capacity,
      venueType: venueRequest.venueType,
      facilities: venueRequest.facilities,
      contactPerson: venueRequest.contactPerson,
      priceRange: venueRequest.priceRange,
      pricing: venueRequest.pricing,
      description: venueRequest.description,
      images: venueRequest.images,
      googleMapsLink: venueRequest.googleMapsLink,
      website: venueRequest.website,
      isActive: autoActivate === 'on', // Set based on admin choice
      isVerified: true, // Admin approved, so it's verified
      createdBy: venueRequest.user._id, // Original user who requested
      lastUpdatedBy: req.session.user.id // Admin who approved
    });

    await venue.save();

    // Update the venue request
    venueRequest.status = 'approved';
    venueRequest.adminNotes = adminNotes || '';
    venueRequest.reviewedBy = req.session.user.id;
    venueRequest.reviewedAt = new Date();
    venueRequest.createdVenue = venue._id;

    await venueRequest.save();

    req.flash('success', `Venue request approved and venue "${venue.name}" has been created successfully!`);
    res.redirect('/admin/venue-requests');
  } catch (error) {
    console.error('Error approving venue request:', error);
    req.flash('error', 'Failed to approve venue request');
    res.redirect(`/admin/venue-requests/${req.params.id}`);
  }
});

// GET /admin/venue-requests/:id/reject - Show reject form
router.get('/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findById(req.params.id)
      .populate('user', 'name email');

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/admin/venue-requests');
    }

    if (venueRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/venue-requests/${venueRequest._id}`);
    }

    res.render('admin/venue-requests/reject', {
      layout: 'admin',
      currentPath: '/admin/venue-requests',
      title: `Reject Venue Request - ${venueRequest.name}`,
      venueRequest,
      toISTCustomFormat
    });
  } catch (error) {
    console.error('Error loading reject form:', error);
    req.flash('error', 'Failed to load reject form');
    res.redirect('/admin/venue-requests');
  }
});

// POST /admin/venue-requests/:id/reject - Reject venue request
router.post('/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;

    const venueRequest = await VenueRequest.findById(req.params.id);

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/admin/venue-requests');
    }

    if (venueRequest.status !== 'pending') {
      req.flash('error', 'This request has already been processed');
      return res.redirect(`/admin/venue-requests/${venueRequest._id}`);
    }

    if (!rejectionReason || rejectionReason.trim() === '') {
      req.flash('error', 'Please provide a rejection reason');
      return res.redirect(`/admin/venue-requests/${req.params.id}/reject`);
    }

    // Update the venue request
    venueRequest.status = 'rejected';
    venueRequest.rejectionReason = rejectionReason.trim();
    venueRequest.adminNotes = adminNotes || '';
    venueRequest.reviewedBy = req.session.user.id;
    venueRequest.reviewedAt = new Date();

    await venueRequest.save();

    req.flash('success', 'Venue request has been rejected');
    res.redirect('/admin/venue-requests');
  } catch (error) {
    console.error('Error rejecting venue request:', error);
    req.flash('error', 'Failed to reject venue request');
    res.redirect(`/admin/venue-requests/${req.params.id}`);
  }
});

// POST /admin/venue-requests/:id/delete - Delete venue request
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venueRequest = await VenueRequest.findById(req.params.id);

    if (!venueRequest) {
      req.flash('error', 'Venue request not found');
      return res.redirect('/admin/venue-requests');
    }

    await VenueRequest.findByIdAndDelete(req.params.id);

    req.flash('success', 'Venue request deleted successfully');
    res.redirect('/admin/venue-requests');
  } catch (error) {
    console.error('Error deleting venue request:', error);
    req.flash('error', 'Failed to delete venue request');
    res.redirect('/admin/venue-requests');
  }
});

module.exports = router;
