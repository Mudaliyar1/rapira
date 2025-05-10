const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeamRequirementRole = require('../models/TeamRequirementRole');
const TeamBookingRequest = require('../models/TeamBookingRequest');
const Notification = require('../models/Notification');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { sendTeamBookingRequestEmail } = require('../utils/emailService');
const { createTeamBookingNotification } = require('../utils/notificationService');

// Public routes

// GET /team-requirement - Show team requirement page
router.get('/', async (req, res) => {
  try {
    // Get filter parameters
    const { role, city, state } = req.query;

    // Build filter object
    const filter = { isActive: true };
    if (role) filter.name = new RegExp(role, 'i');
    if (city) filter.city = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');

    // Get all active roles
    const roles = await TeamRequirementRole.find(filter).sort({ name: 1 });

    // Get unique cities and states for filter dropdowns
    const cities = await TeamRequirementRole.distinct('city', { isActive: true });
    const states = await TeamRequirementRole.distinct('state', { isActive: true });
    const roleNames = await TeamRequirementRole.distinct('name', { isActive: true });

    res.render('team-requirement/index', {
      title: 'Team Requirement',
      roles,
      cities,
      states,
      roleNames,
      filters: { role, city, state }
    });
  } catch (error) {
    console.error('Error loading team requirement page:', error);
    req.flash('error', 'An error occurred while loading the team requirement page');
    res.redirect('/');
  }
});

// GET /team-requirement/book/:id - Show booking form for a specific role
router.get('/book/:id', async (req, res) => {
  try {
    const role = await TeamRequirementRole.findById(req.params.id);

    if (!role || !role.isActive) {
      req.flash('error', 'Role not found or not available for booking');
      return res.redirect('/team-requirement');
    }

    res.render('team-requirement/booking-form', {
      title: `Book ${role.name}`,
      role
    });
  } catch (error) {
    console.error('Error loading booking form:', error);
    req.flash('error', 'An error occurred while loading the booking form');
    res.redirect('/team-requirement');
  }
});

// POST /team-requirement/book-multiple - Show form for booking multiple roles
router.post('/book-multiple', async (req, res) => {
  try {
    const { selectedRoles } = req.body;

    // Validate input
    if (!selectedRoles || (Array.isArray(selectedRoles) && selectedRoles.length === 0) || (!Array.isArray(selectedRoles) && !selectedRoles)) {
      req.flash('error', 'Please select at least one role to book');
      return res.redirect('/team-requirement');
    }

    // Convert to array if single value
    const roleIds = Array.isArray(selectedRoles) ? selectedRoles : [selectedRoles];

    // Get all selected roles
    const roles = await TeamRequirementRole.find({
      _id: { $in: roleIds },
      isActive: true
    });

    if (roles.length === 0) {
      req.flash('error', 'No valid roles selected');
      return res.redirect('/team-requirement');
    }

    // If only one role is selected, redirect to the single booking form
    if (roles.length === 1) {
      return res.redirect(`/team-requirement/book/${roles[0]._id}`);
    }

    res.render('team-requirement/bulk-booking-form', {
      title: 'Book Multiple Roles',
      roles
    });
  } catch (error) {
    console.error('Error preparing bulk booking form:', error);
    req.flash('error', 'An error occurred while preparing the booking form');
    res.redirect('/team-requirement');
  }
});

// POST /team-requirement/book-multiple - Submit multiple booking requests
router.post('/book-multiple/submit', async (req, res) => {
  try {
    const { name, email, phone, city, state, message, roleIds } = req.body;

    // Validate input
    if (!name || !email || !phone || !city || !state || !message || !roleIds) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/team-requirement');
    }

    // Convert to array if single value
    const roleIdsArray = Array.isArray(roleIds) ? roleIds : [roleIds];

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect('/team-requirement');
    }

    // Get all selected roles
    const roles = await TeamRequirementRole.find({
      _id: { $in: roleIdsArray },
      isActive: true
    });

    if (roles.length === 0) {
      req.flash('error', 'No valid roles selected');
      return res.redirect('/team-requirement');
    }

    // Generate a unique bulk request ID
    const bulkRequestId = new mongoose.Types.ObjectId().toString();

    // Create a main bulk request entry
    const mainRequest = new TeamBookingRequest({
      name,
      email,
      phone,
      city,
      state,
      role: roles[0]._id, // Use the first role as the primary role
      message,
      bulkRequestId,
      isBulkRequest: true,
      bulkRoleCount: roles.length
    });

    await mainRequest.save();

    // Create additional booking requests for each role if more than one
    if (roles.length > 1) {
      const additionalRoles = roles.slice(1);
      const bookingPromises = additionalRoles.map(role => {
        const newRequest = new TeamBookingRequest({
          name,
          email,
          phone,
          city,
          state,
          role: role._id,
          message,
          bulkRequestId,
          isBulkRequest: false
        });

        return newRequest.save();
      });

      // Wait for all additional booking requests to be saved
      await Promise.all(bookingPromises);
    }

    // Send email notification for the bulk booking
    try {
      await sendTeamBookingRequestEmail(mainRequest, roles[0]);

      // Create notification for admin dashboard
      const populatedRequest = await TeamBookingRequest.findById(mainRequest._id).populate('role');
      await createTeamBookingNotification(populatedRequest);
      console.log(`Notification created for bulk team booking request: ${mainRequest._id}`);
    } catch (emailError) {
      console.error('Error sending booking request email or creating notification:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', `Your booking requests for ${roles.length} roles have been submitted successfully. We will contact you soon.`);
    res.redirect('/team-requirement/thank-you');
  } catch (error) {
    console.error('Error submitting bulk booking requests:', error);
    req.flash('error', 'An error occurred while submitting your booking requests');
    res.redirect('/team-requirement');
  }
});

// POST /team-requirement/book/:id - Submit booking request
router.post('/book/:id', async (req, res) => {
  try {
    const { name, email, phone, city, state, message } = req.body;
    const role = await TeamRequirementRole.findById(req.params.id);

    if (!role || !role.isActive) {
      req.flash('error', 'Role not found or not available for booking');
      return res.redirect('/team-requirement');
    }

    // Validate input
    if (!name || !email || !phone || !city || !state || !message) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/team-requirement/book/${req.params.id}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect(`/team-requirement/book/${req.params.id}`);
    }

    // Create new booking request
    const newRequest = new TeamBookingRequest({
      name,
      email,
      phone,
      city,
      state,
      role: role._id,
      message
    });

    await newRequest.save();

    // Send email notification to admin
    try {
      await sendTeamBookingRequestEmail(newRequest, role);

      // Create notification for admin dashboard
      const populatedRequest = await TeamBookingRequest.findById(newRequest._id).populate('role');
      await createTeamBookingNotification(populatedRequest);
      console.log(`Notification created for team booking request: ${newRequest._id}`);
    } catch (emailError) {
      console.error('Error sending booking request email or creating notification:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Your booking request has been submitted successfully. We will contact you soon.');
    res.redirect('/team-requirement/thank-you');
  } catch (error) {
    console.error('Error submitting booking request:', error);
    req.flash('error', 'An error occurred while submitting your booking request');
    res.redirect(`/team-requirement/book/${req.params.id}`);
  }
});

// GET /team-requirement/thank-you - Thank you page after successful booking
router.get('/thank-you', (req, res) => {
  res.render('team-requirement/thank-you', {
    title: 'Thank You for Your Booking Request'
  });
});

// GET /team-requirement/filter - AJAX endpoint for filtering roles
router.get('/filter', async (req, res) => {
  try {
    // Get filter parameters
    const { role, city, state } = req.query;

    // Build filter object
    const filter = { isActive: true };
    if (role) filter.name = new RegExp(role, 'i');
    if (city) filter.city = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');

    // Get all active roles
    const roles = await TeamRequirementRole.find(filter).sort({ name: 1 });

    // Return JSON response
    res.json({
      success: true,
      roles
    });
  } catch (error) {
    console.error('Error filtering team requirement roles:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while filtering roles'
    });
  }
});

// Admin routes

// GET /admin/team-requirement/roles - List all roles
router.get('/roles', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const roles = await TeamRequirementRole.find().sort({ name: 1 });

    res.render('admin/team-requirement/roles', {
      layout: 'admin',
      title: 'Team Requirement Roles',
      currentPath: '/admin/team-requirement/roles',
      roles
    });
  } catch (error) {
    console.error('Error loading team requirement roles:', error);
    req.flash('error', 'An error occurred while loading team requirement roles');
    res.redirect('/admin');
  }
});

// GET /admin/team-requirement/roles/new - Show form to create a new role
router.get('/roles/new', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/team-requirement/role-form', {
    layout: 'admin',
    title: 'Add New Team Requirement Role',
    currentPath: '/admin/team-requirement/roles',
    role: null
  });
});

// POST /admin/team-requirement/roles - Create a new role
router.post('/roles', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, city, state, phoneNumber, isActive } = req.body;

    // Validate input
    if (!name || !description || !city || !state || !phoneNumber) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/team-requirement/roles/new');
    }

    // Check if a role with the same phone number already exists
    const existingRole = await TeamRequirementRole.findOne({ phoneNumber });
    if (existingRole) {
      req.flash('error', 'A role with this phone number already exists. Please use a different phone number.');
      return res.redirect('/admin/team-requirement/roles/new');
    }

    // Create new role
    const newRole = new TeamRequirementRole({
      name,
      description,
      city,
      state,
      phoneNumber,
      isActive: isActive === 'on'
    });

    await newRole.save();

    req.flash('success', 'Team requirement role created successfully');
    res.redirect('/admin/team-requirement/roles');
  } catch (error) {
    console.error('Error creating team requirement role:', error);
    req.flash('error', 'An error occurred while creating the team requirement role');
    res.redirect('/admin/team-requirement/roles/new');
  }
});

// GET /admin/team-requirement/roles/:id/edit - Show form to edit a role
router.get('/roles/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const role = await TeamRequirementRole.findById(req.params.id);

    if (!role) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/team-requirement/roles');
    }

    res.render('admin/team-requirement/role-form', {
      layout: 'admin',
      title: 'Edit Team Requirement Role',
      currentPath: '/admin/team-requirement/roles',
      role
    });
  } catch (error) {
    console.error('Error loading role for editing:', error);
    req.flash('error', 'An error occurred while loading the role');
    res.redirect('/admin/team-requirement/roles');
  }
});

// POST /admin/team-requirement/roles/:id - Update a role
router.post('/roles/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, city, state, phoneNumber, isActive } = req.body;

    // Validate input
    if (!name || !description || !city || !state || !phoneNumber) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/admin/team-requirement/roles/${req.params.id}/edit`);
    }

    // Check if a role with the same phone number already exists (excluding this role)
    const existingRole = await TeamRequirementRole.findOne({
      phoneNumber,
      _id: { $ne: req.params.id }
    });

    if (existingRole) {
      req.flash('error', 'A role with this phone number already exists. Please use a different phone number.');
      return res.redirect(`/admin/team-requirement/roles/${req.params.id}/edit`);
    }

    // Update role
    await TeamRequirementRole.findByIdAndUpdate(req.params.id, {
      name,
      description,
      city,
      state,
      phoneNumber,
      isActive: isActive === 'on'
    });

    req.flash('success', 'Team requirement role updated successfully');
    res.redirect('/admin/team-requirement/roles');
  } catch (error) {
    console.error('Error updating team requirement role:', error);
    req.flash('error', 'An error occurred while updating the team requirement role');
    res.redirect(`/admin/team-requirement/roles/${req.params.id}/edit`);
  }
});

// GET /admin/team-requirement/roles/:id/delete-confirm - Show confirmation page for deleting a role
router.get('/roles/:id/delete-confirm', isLoggedIn, isAdmin, async (req, res) => {
  try {
    console.log('Delete confirmation route accessed with ID:', req.params.id);
    console.log('Full URL:', req.originalUrl);

    const role = await TeamRequirementRole.findById(req.params.id);

    if (!role) {
      console.log('Role not found with ID:', req.params.id);
      req.flash('error', 'Role not found');
      return res.redirect('/admin/team-requirement/roles');
    }

    console.log('Role found:', role.name);

    // Check if there are any pending booking requests for this role
    const pendingRequests = await TeamBookingRequest.countDocuments({
      role: req.params.id,
      status: 'pending'
    });

    console.log('Pending requests count:', pendingRequests);

    if (pendingRequests > 0) {
      req.flash('error', `Cannot delete role with ${pendingRequests} pending booking requests`);
      return res.redirect('/admin/team-requirement/roles');
    }

    console.log('Rendering delete confirmation page');
    res.render('admin/team-requirement/delete-role-confirm', {
      layout: 'admin',
      title: 'Confirm Delete Role',
      currentPath: '/admin/team-requirement/roles',
      role
    });
  } catch (error) {
    console.error('Error loading role for delete confirmation:', error);
    req.flash('error', 'An error occurred while loading the role');
    res.redirect('/admin/team-requirement/roles');
  }
});

// POST /admin/team-requirement/roles/:id/delete - Delete a role
router.post('/roles/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Check if there are any pending booking requests for this role
    const pendingRequests = await TeamBookingRequest.countDocuments({
      role: req.params.id,
      status: 'pending'
    });

    if (pendingRequests > 0) {
      req.flash('error', `Cannot delete role with ${pendingRequests} pending booking requests`);
      return res.redirect('/admin/team-requirement/roles');
    }

    await TeamRequirementRole.findByIdAndDelete(req.params.id);

    req.flash('success', 'Team requirement role deleted successfully');
    res.redirect('/admin/team-requirement/roles');
  } catch (error) {
    console.error('Error deleting team requirement role:', error);
    req.flash('error', 'An error occurred while deleting the team requirement role');
    res.redirect('/admin/team-requirement/roles');
  }
});

// GET /admin/team-requirement/requests - List all booking requests
router.get('/requests', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get filter parameters
    const { status, role, city, state } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (city) filter.city = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');

    // Handle role filter (need to join with TeamRequirementRole)
    let roleId = null;
    if (role) {
      const roleDoc = await TeamRequirementRole.findOne({ name: new RegExp(role, 'i') });
      if (roleDoc) {
        roleId = roleDoc._id;
        filter.role = roleId;
      }
    }

    // Get all booking requests with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // First, get all main requests (either single requests or bulk main requests)
    const mainRequestsFilter = { ...filter };
    // Only include requests that are either not part of a bulk request (bulkRequestId is null)
    // or are the main entry for a bulk request (isBulkRequest is true)
    mainRequestsFilter.$or = [
      { bulkRequestId: null },
      { isBulkRequest: true }
    ];

    const requests = await TeamBookingRequest.find(mainRequestsFilter)
      .populate('role')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // For bulk requests, fetch all related roles
    for (const request of requests) {
      if (request.isBulkRequest && request.bulkRequestId) {
        // Find all related requests with the same bulkRequestId
        const relatedRequests = await TeamBookingRequest.find({
          bulkRequestId: request.bulkRequestId,
          isBulkRequest: false
        }).populate('role');

        // Add the related roles to the request object
        request.relatedRoles = relatedRequests.map(r => r.role);
      }
    }

    const totalRequests = await TeamBookingRequest.countDocuments(mainRequestsFilter);
    const totalPages = Math.ceil(totalRequests / limit);

    // Get unique cities, states, and roles for filter dropdowns
    const cities = await TeamBookingRequest.distinct('city');
    const states = await TeamBookingRequest.distinct('state');
    const roles = await TeamRequirementRole.find().sort({ name: 1 });

    res.render('admin/team-requirement/requests', {
      layout: 'admin',
      title: 'Team Booking Requests',
      currentPath: '/admin/team-requirement/requests',
      requests,
      pagination: {
        page,
        totalPages,
        totalRequests
      },
      filters: { status, role, city, state },
      filterOptions: {
        cities,
        states,
        roles
      }
    });
  } catch (error) {
    console.error('Error loading team booking requests:', error);
    req.flash('error', 'An error occurred while loading team booking requests');
    res.redirect('/admin');
  }
});

// GET /admin/team-requirement/requests/:id - View a specific booking request
router.get('/requests/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await TeamBookingRequest.findById(req.params.id)
      .populate('role')
      .populate('reviewedBy', 'name email');

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/team-requirement/requests');
    }

    // If this is a bulk request, fetch all related roles
    let relatedRequests = [];
    if (request.isBulkRequest && request.bulkRequestId) {
      relatedRequests = await TeamBookingRequest.find({
        bulkRequestId: request.bulkRequestId,
        isBulkRequest: false
      }).populate('role');
    }

    res.render('admin/team-requirement/request-details', {
      layout: 'admin',
      title: 'Booking Request Details',
      currentPath: '/admin/team-requirement/requests',
      request,
      relatedRequests
    });
  } catch (error) {
    console.error('Error loading booking request details:', error);
    req.flash('error', 'An error occurred while loading the booking request details');
    res.redirect('/admin/team-requirement/requests');
  }
});

// POST /admin/team-requirement/requests/:id/approve - Approve a booking request
router.post('/requests/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const request = await TeamBookingRequest.findById(req.params.id)
      .populate('role');

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/team-requirement/requests');
    }

    // Update request status
    request.status = 'approved';
    request.adminNotes = adminNotes || '';
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // If this is a bulk request, update all related requests
    if (request.isBulkRequest && request.bulkRequestId) {
      await TeamBookingRequest.updateMany(
        { bulkRequestId: request.bulkRequestId, isBulkRequest: false },
        {
          status: 'approved',
          adminNotes: adminNotes || '',
          reviewedBy: req.session.user.id,
          reviewedAt: new Date()
        }
      );
    }

    // Send approval email to requester
    try {
      // Implement email sending functionality
      // await sendTeamBookingApprovalEmail(request);

      // Update notification status
      const { updateNotificationStatus } = require('../utils/notificationService');
      await updateNotificationStatus('TeamBookingRequest', request._id, 'approved');
    } catch (emailError) {
      console.error('Error sending approval email or updating notification:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', request.isBulkRequest ? 'Bulk booking request approved successfully' : 'Booking request approved successfully');
    res.redirect('/admin/team-requirement/requests');
  } catch (error) {
    console.error('Error approving booking request:', error);
    req.flash('error', 'An error occurred while approving the booking request');
    res.redirect(`/admin/team-requirement/requests/${req.params.id}`);
  }
});

// POST /admin/team-requirement/requests/:id/reject - Reject a booking request
router.post('/requests/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminNotes } = req.body;

    if (!adminNotes) {
      req.flash('error', 'Please provide a reason for rejection');
      return res.redirect(`/admin/team-requirement/requests/${req.params.id}`);
    }

    const request = await TeamBookingRequest.findById(req.params.id)
      .populate('role');

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/team-requirement/requests');
    }

    // Update request status
    request.status = 'rejected';
    request.adminNotes = adminNotes;
    request.reviewedBy = req.session.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // If this is a bulk request, update all related requests
    if (request.isBulkRequest && request.bulkRequestId) {
      await TeamBookingRequest.updateMany(
        { bulkRequestId: request.bulkRequestId, isBulkRequest: false },
        {
          status: 'rejected',
          adminNotes: adminNotes,
          reviewedBy: req.session.user.id,
          reviewedAt: new Date()
        }
      );
    }

    // Send rejection email to requester
    try {
      // Implement email sending functionality
      // await sendTeamBookingRejectionEmail(request);

      // Update notification status
      const { updateNotificationStatus } = require('../utils/notificationService');
      await updateNotificationStatus('TeamBookingRequest', request._id, 'rejected');
    } catch (emailError) {
      console.error('Error sending rejection email or updating notification:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', request.isBulkRequest ? 'Bulk booking request rejected successfully' : 'Booking request rejected successfully');
    res.redirect('/admin/team-requirement/requests');
  } catch (error) {
    console.error('Error rejecting booking request:', error);
    req.flash('error', 'An error occurred while rejecting the booking request');
    res.redirect(`/admin/team-requirement/requests/${req.params.id}`);
  }
});

// GET /admin/team-requirement/requests/:id/delete-confirm - Show confirmation page for deleting a request
router.get('/requests/:id/delete-confirm', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await TeamBookingRequest.findById(req.params.id)
      .populate('role');

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/team-requirement/requests');
    }

    res.render('admin/team-requirement/delete-request-confirm', {
      layout: 'admin',
      title: 'Confirm Delete Booking Request',
      currentPath: '/admin/team-requirement/requests',
      request,
      bulkDelete: false,
      requestIds: []
    });
  } catch (error) {
    console.error('Error loading delete confirmation:', error);
    req.flash('error', 'An error occurred while loading the delete confirmation');
    res.redirect('/admin/team-requirement/requests');
  }
});

// POST /admin/team-requirement/requests/:id/delete - Delete a booking request
router.post('/requests/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await TeamBookingRequest.findById(req.params.id);

    if (!request) {
      req.flash('error', 'Booking request not found');
      return res.redirect('/admin/team-requirement/requests');
    }

    // If this is a bulk request, delete all related requests
    if (request.isBulkRequest && request.bulkRequestId) {
      await TeamBookingRequest.deleteMany({ bulkRequestId: request.bulkRequestId, isBulkRequest: false });
    }

    // Delete the main request
    await TeamBookingRequest.findByIdAndDelete(req.params.id);

    req.flash('success', request.isBulkRequest ? 'Bulk booking request deleted successfully' : 'Booking request deleted successfully');
    res.redirect('/admin/team-requirement/requests');
  } catch (error) {
    console.error('Error deleting booking request:', error);
    req.flash('error', 'An error occurred while deleting the booking request');
    res.redirect('/admin/team-requirement/requests');
  }
});

// POST /admin/team-requirement/requests/bulk-delete-confirm - Show confirmation page for bulk deletion
router.post('/requests/bulk-delete-confirm', isLoggedIn, isAdmin, async (req, res) => {
  try {
    console.log('Bulk delete confirmation request received:', req.body);
    const { requestIds } = req.body;

    // Validate input
    if (!requestIds || (Array.isArray(requestIds) && requestIds.length === 0) || (!Array.isArray(requestIds) && !requestIds)) {
      console.error('No request IDs found in request body:', req.body);
      req.flash('error', 'No requests selected for deletion');
      return res.redirect('/admin/team-requirement/requests');
    }

    // Convert to array if single value
    const requestIdsArray = Array.isArray(requestIds) ? requestIds : [requestIds];
    console.log(`Processing ${requestIdsArray.length} request IDs for confirmation:`, requestIdsArray);

    // Validate that all IDs are valid MongoDB ObjectIDs
    const validIds = requestIdsArray.filter(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id);
      } catch (err) {
        console.error(`Invalid ObjectID: ${id}`, err);
        return false;
      }
    });

    if (validIds.length === 0) {
      console.error('No valid ObjectIDs found in request');
      req.flash('error', 'No valid request IDs found');
      return res.redirect('/admin/team-requirement/requests');
    }

    console.log(`Found ${validIds.length} valid ObjectIDs for confirmation`);

    // Get request details for debugging
    const requestCount = await TeamBookingRequest.countDocuments({ _id: { $in: validIds } });
    console.log(`Found ${requestCount} matching requests in database`);

    res.render('admin/team-requirement/delete-request-confirm', {
      layout: 'admin',
      title: 'Confirm Bulk Delete',
      currentPath: '/admin/team-requirement/requests',
      bulkDelete: true,
      requestIds: validIds,
      request: null
    });
  } catch (error) {
    console.error('Error preparing bulk delete confirmation:', error);
    req.flash('error', 'An error occurred while preparing the delete confirmation');
    res.redirect('/admin/team-requirement/requests');
  }
});

// POST /admin/team-requirement/requests/bulk-delete - Delete multiple booking requests
router.post('/requests/bulk-delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    console.log('Bulk delete request received:', req.body);
    const { requestIds } = req.body;

    // Validate input
    if (!requestIds || (Array.isArray(requestIds) && requestIds.length === 0) || (!Array.isArray(requestIds) && !requestIds)) {
      console.error('No request IDs found in request body:', req.body);
      req.flash('error', 'No requests selected for deletion');
      return res.redirect('/admin/team-requirement/requests');
    }

    // Convert to array if single value
    const requestIdsArray = Array.isArray(requestIds) ? requestIds : [requestIds];
    console.log(`Processing ${requestIdsArray.length} request IDs for deletion:`, requestIdsArray);

    // Validate that all IDs are valid MongoDB ObjectIDs
    const validIds = requestIdsArray.filter(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id);
      } catch (err) {
        console.error(`Invalid ObjectID: ${id}`, err);
        return false;
      }
    });

    if (validIds.length === 0) {
      console.error('No valid ObjectIDs found in request');
      req.flash('error', 'No valid request IDs found');
      return res.redirect('/admin/team-requirement/requests');
    }

    console.log(`Found ${validIds.length} valid ObjectIDs for deletion`);

    // Find all bulk requests in the selection
    const bulkRequests = await TeamBookingRequest.find({
      _id: { $in: validIds },
      isBulkRequest: true
    });

    console.log(`Found ${bulkRequests.length} bulk requests in the selection`);

    // Get all bulk request IDs
    const bulkRequestIds = bulkRequests.map(req => req.bulkRequestId).filter(id => id);

    // Delete all related requests for bulk requests
    let relatedDeleted = 0;
    if (bulkRequestIds.length > 0) {
      console.log(`Deleting related requests for ${bulkRequestIds.length} bulk requests`);
      const relatedResult = await TeamBookingRequest.deleteMany({
        bulkRequestId: { $in: bulkRequestIds },
        isBulkRequest: false
      });
      relatedDeleted = relatedResult.deletedCount;
      console.log(`Deleted ${relatedDeleted} related requests`);
    }

    // Delete all selected requests
    console.log(`Deleting ${validIds.length} selected requests`);
    const result = await TeamBookingRequest.deleteMany({ _id: { $in: validIds } });
    console.log(`Deleted ${result.deletedCount} selected requests`);

    const totalDeleted = result.deletedCount + relatedDeleted;
    req.flash('success', `Successfully deleted ${totalDeleted} booking requests`);
    res.redirect('/admin/team-requirement/requests');
  } catch (error) {
    console.error('Error performing bulk delete:', error);
    req.flash('error', 'An error occurred while deleting the booking requests');
    res.redirect('/admin/team-requirement/requests');
  }
});

module.exports = router;
