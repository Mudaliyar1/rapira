const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const DailyConcert = require('../models/DailyConcert');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');

// GET /admin/find-my-artist/booking-requests - List all booking requests
router.get('/', isLoggedIn, hasAdminPermission('manage_booking_requests'), async (req, res) => {
  try {
    // Get filter parameters
    const { status, type, city, state } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.bookingType = type;
    if (city) filter.eventCity = new RegExp(city, 'i');
    if (state) filter.eventState = new RegExp(state, 'i');

    // Get all booking requests with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const requests = await ArtistBookingRequest.find(filter)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name' } },
        { path: 'roleSlot' },
        { path: 'reviewedBy', select: 'name email' },
        {
          path: 'selections.artist',
          populate: { path: 'user', select: 'name' }
        },
        {
          path: 'selections.roleSlot'
        }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalRequests = await ArtistBookingRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalRequests / limit);

    // Get unique cities, states for filter dropdowns
    const cities = await ArtistBookingRequest.distinct('eventCity');
    const states = await ArtistBookingRequest.distinct('eventState');

    res.render('admin/find-my-artist/booking-requests', {
      layout: 'admin',
      title: 'Artist Booking Requests',
      currentPath: '/admin/find-my-artist/booking-requests',
      requests,
      pagination: {
        page,
        totalPages,
        totalRequests
      },
      filters: { status, type, city, state },
      filterOptions: {
        cities,
        states
      }
    });
  } catch (error) {
    console.error('Error loading booking requests:', error);
    req.flash('error', 'An error occurred while loading booking requests');
    res.redirect('/admin/find-my-artist');
  }
});

// GET /admin/find-my-artist/booking-requests/:id - View a specific booking request
router.get('/:id', isLoggedIn, hasAdminPermission('manage_booking_requests'), async (req, res) => {
  try {
    const request = await ArtistBookingRequest.findById(req.params.id)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name email profileImage' } },
        { path: 'roleSlot', populate: { path: 'createdBy', select: 'name email' } },
        { path: 'reviewedBy', select: 'name email' },
        {
          path: 'selections.artist',
          populate: { path: 'user', select: 'name email profileImage' }
        },
        {
          path: 'selections.roleSlot',
          populate: { path: 'createdBy', select: 'name email' }
        }
      ]);

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/find-my-artist/booking-requests');
    }

    res.render('admin/find-my-artist/booking-details', {
      layout: 'admin',
      title: 'Booking Request Details',
      currentPath: '/admin/find-my-artist/booking-requests',
      request
    });
  } catch (error) {
    console.error('Error loading booking request details:', error);
    req.flash('error', 'An error occurred while loading the booking request details');
    res.redirect('/admin/find-my-artist/booking-requests');
  }
});

// POST /admin/find-my-artist/booking-requests/:id/approve - Approve a booking request
router.post('/:id/approve', isLoggedIn, hasAdminPermission('manage_booking_requests'), async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const request = await ArtistBookingRequest.findById(req.params.id)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name' } },
        { path: 'roleSlot' }
      ]);

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/find-my-artist/booking-requests');
    }

    // Update request status
    request.status = 'approved';
    request.adminNotes = adminNotes || '';
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // Create a daily concert entry from this approved booking
    try {
      // Generate title based on booking type
      let title = '';
      if (request.bookingType === 'artist' && request.artist) {
        title = `${request.artist.stageName || request.artist.user.name} Live Performance`;
      } else if (request.bookingType === 'role' && request.roleSlot) {
        title = `${request.roleSlot.name} Performance`;
      } else if (request.bookingType === 'bulk') {
        title = 'Multi-Artist Performance';
      }

      // Create the daily concert
      const newDailyConcert = new DailyConcert({
        bookingRequest: request._id,
        title: title,
        description: request.notes || 'Live performance organized through Find My Artist',
        bookingType: request.bookingType,
        artist: request.bookingType === 'artist' ? request.artist : null,
        roleSlot: request.bookingType === 'role' ? request.roleSlot : null,
        eventDate: request.eventDate,
        eventTime: '19:00', // Default time if not specified
        eventCity: request.eventCity,
        eventState: request.eventState,
        organizerName: request.name,
        isVisible: true,
        createdBy: req.session.user.id
      });

      await newDailyConcert.save();
      console.log('Daily concert created successfully:', newDailyConcert._id);
    } catch (concertError) {
      console.error('Error creating daily concert:', concertError);
      // Continue with the process even if daily concert creation fails
    }

    // Send approval email to requester
    try {
      // Implement email sending functionality
      // await sendArtistBookingApprovalEmail(request);
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Booking request approved successfully and added to Daily Concerts');
    res.redirect('/admin/find-my-artist/booking-requests');
  } catch (error) {
    console.error('Error approving booking request:', error);
    req.flash('error', 'An error occurred while approving the booking request');
    res.redirect(`/admin/find-my-artist/booking-requests/${req.params.id}`);
  }
});

// POST /admin/find-my-artist/booking-requests/:id/reject - Reject a booking request
router.post('/:id/reject', isLoggedIn, hasAdminPermission('manage_booking_requests'), async (req, res) => {
  try {
    const { adminNotes } = req.body;

    if (!adminNotes) {
      req.flash('error', 'Please provide a reason for rejection');
      return res.redirect(`/admin/find-my-artist/booking-requests/${req.params.id}`);
    }

    const request = await ArtistBookingRequest.findById(req.params.id);

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/find-my-artist/booking-requests');
    }

    // Update request status
    request.status = 'rejected';
    request.adminNotes = adminNotes;
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // Send rejection email to requester
    try {
      // Implement email sending functionality
      // await sendArtistBookingRejectionEmail(request);
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Booking request rejected successfully');
    res.redirect('/admin/find-my-artist/booking-requests');
  } catch (error) {
    console.error('Error rejecting booking request:', error);
    req.flash('error', 'An error occurred while rejecting the booking request');
    res.redirect(`/admin/find-my-artist/booking-requests/${req.params.id}`);
  }
});

// POST /admin/find-my-artist/booking-requests/:id/delete - Delete a booking request
router.post('/:id/delete', isLoggedIn, hasAdminPermission('manage_booking_requests'), async (req, res) => {
  try {
    await ArtistBookingRequest.findByIdAndDelete(req.params.id);

    req.flash('success', 'Booking request deleted successfully');
    res.redirect('/admin/find-my-artist/booking-requests');
  } catch (error) {
    console.error('Error deleting booking request:', error);
    req.flash('error', 'An error occurred while deleting the booking request');
    res.redirect('/admin/find-my-artist/booking-requests');
  }
});

module.exports = router;