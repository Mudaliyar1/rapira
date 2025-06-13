const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const User = require('../models/User');
const FeaturedArtist = require('../models/FeaturedArtist');
const ArtistRoleSlot = require('../models/ArtistRoleSlot');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { sendArtistBookingRequestEmail } = require('../utils/brevoEmailService');

// Public routes

// GET /find-my-artist - Show find my artist page
router.get('/', async (req, res) => {
  try {
    // Get filter parameters
    const { artist, role, city, state } = req.query;

    // Get featured artists
    let featuredArtistsQuery = FeaturedArtist.find()
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      })
      .sort({ displayOrder: 1 });

    // Apply filters to featured artists if provided
    if (artist) {
      featuredArtistsQuery = featuredArtistsQuery.populate({
        path: 'artist',
        match: { stageName: new RegExp(artist, 'i') },
        populate: { path: 'user', select: 'name profileImage' }
      });
    }

    if (city) {
      featuredArtistsQuery = featuredArtistsQuery.populate({
        path: 'artist',
        match: { city: new RegExp(city, 'i') },
        populate: { path: 'user', select: 'name profileImage' }
      });
    }

    if (state) {
      featuredArtistsQuery = featuredArtistsQuery.populate({
        path: 'artist',
        match: { state: new RegExp(state, 'i') },
        populate: { path: 'user', select: 'name profileImage' }
      });
    }

    let featuredArtists = await featuredArtistsQuery;

    // Filter out null artists (those that didn't match the criteria)
    featuredArtists = featuredArtists.filter(fa => fa.artist !== null);

    // Get role slots
    let roleFilter = { isActive: true };
    if (role) roleFilter.name = new RegExp(role, 'i');
    if (city) roleFilter.city = new RegExp(city, 'i');
    if (state) roleFilter.state = new RegExp(state, 'i');

    const roleSlots = await ArtistRoleSlot.find(roleFilter).sort({ displayOrder: 1, name: 1 });

    // Get unique cities, states, and role names for filter dropdowns
    const cities = await ArtistRoleSlot.distinct('city', { isActive: true });
    const states = await ArtistRoleSlot.distinct('state', { isActive: true });
    const roleNames = await ArtistRoleSlot.distinct('name', { isActive: true });

    // Also get cities and states from artists
    const artistCities = await Artist.distinct('city');
    const artistStates = await Artist.distinct('state');

    // Combine and deduplicate
    const allCities = [...new Set([...cities, ...artistCities.filter(c => c)])];
    const allStates = [...new Set([...states, ...artistStates.filter(s => s)])];

    res.render('find-my-artist/index', {
      title: 'Find My Artist',
      featuredArtists,
      roleSlots,
      filters: { artist, role, city, state },
      filterOptions: {
        cities: allCities,
        states: allStates,
        roles: roleNames
      }
    });
  } catch (error) {
    console.error('Error loading find my artist page:', error);
    req.flash('error', 'An error occurred while loading the page');
    res.redirect('/');
  }
});

// GET /find-my-artist/book/:type/:id - Show booking form
router.get('/book/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== 'artist' && type !== 'role') {
      req.flash('error', 'Invalid booking type');
      return res.redirect('/find-my-artist');
    }

    let bookingData = {};

    if (type === 'artist') {
      const artist = await Artist.findById(id).populate('user', 'name');

      if (!artist) {
        req.flash('error', 'Artist not found');
        return res.redirect('/find-my-artist');
      }

      bookingData = {
        type: 'artist',
        id: artist._id,
        name: artist.stageName || artist.user.name,
        location: `${artist.city || 'N/A'}, ${artist.state || 'N/A'}`,
        description: artist.about || 'No description available'
      };
    } else {
      const roleSlot = await ArtistRoleSlot.findById(id);

      if (!roleSlot || !roleSlot.isActive) {
        req.flash('error', 'Role not found or not available for booking');
        return res.redirect('/find-my-artist');
      }

      bookingData = {
        type: 'role',
        id: roleSlot._id,
        name: roleSlot.name,
        location: `${roleSlot.city}, ${roleSlot.state}`,
        description: roleSlot.description
      };
    }

    res.render('find-my-artist/booking-form', {
      title: `Book ${bookingData.name}`,
      bookingData
    });
  } catch (error) {
    console.error('Error loading booking form:', error);
    req.flash('error', 'An error occurred while loading the booking form');
    res.redirect('/find-my-artist');
  }
});

// POST /find-my-artist/book-multiple - Show form for booking multiple artists and roles
router.post('/book-multiple', async (req, res) => {
  try {
    console.log('POST /find-my-artist/book-multiple - Request body:', req.body);
    const { selectedItems } = req.body;

    // Validate input
    if (!selectedItems || (Array.isArray(selectedItems) && selectedItems.length === 0) || (!Array.isArray(selectedItems) && !selectedItems)) {
      console.log('No selected items found in request');
      req.flash('error', 'Please select at least one artist or role to book');
      return res.redirect('/find-my-artist');
    }

    // Convert to array if single value
    const itemIds = Array.isArray(selectedItems) ? selectedItems : [selectedItems];

    // Process selections
    const processedSelections = [];
    console.log('Processing item IDs:', itemIds);

    for (const itemId of itemIds) {
      // Format is 'type-id' (e.g., 'artist-123456789' or 'role-987654321')
      console.log('Processing item ID:', itemId);
      const [type, id] = itemId.split('-');
      console.log('Split into type:', type, 'and id:', id);

      if (type === 'artist') {
        const artist = await Artist.findById(id).populate('user', 'name');
        if (artist) {
          console.log('Found artist:', artist.stageName || artist.user.name);
          processedSelections.push({
            bookingType: 'artist',
            name: artist.stageName || artist.user.name,
            artistId: artist._id
          });
        } else {
          console.log('Artist not found with ID:', id);
        }
      } else if (type === 'role') {
        const role = await ArtistRoleSlot.findById(id);
        if (role) {
          console.log('Found role:', role.name);
          processedSelections.push({
            bookingType: 'role',
            name: role.name,
            roleId: role._id
          });
        } else {
          console.log('Role not found with ID:', id);
        }
      } else {
        console.log('Unknown type:', type);
      }
    }

    // If no valid selections were found
    if (processedSelections.length === 0) {
      console.log('No valid selections found');
      req.flash('error', 'No valid artists or roles selected');
      return res.redirect('/find-my-artist');
    }

    console.log('Processed selections:', processedSelections);

    // If only one item is selected, redirect to the single booking form
    if (processedSelections.length === 1) {
      const selection = processedSelections[0];
      console.log('Only one selection, redirecting to single booking form');
      if (selection.bookingType === 'artist') {
        console.log('Redirecting to artist booking form:', `/find-my-artist/book/artist/${selection.artistId}`);
        return res.redirect(`/find-my-artist/book/artist/${selection.artistId}`);
      } else {
        console.log('Redirecting to role booking form:', `/find-my-artist/book/role/${selection.roleId}`);
        return res.redirect(`/find-my-artist/book/role/${selection.roleId}`);
      }
    }

    console.log('Multiple selections, rendering bulk booking form');
    res.render('find-my-artist/bulk-booking-form', {
      title: 'Book Multiple Artists & Roles',
      selections: processedSelections
    });
  } catch (error) {
    console.error('Error processing multiple booking form:', error);
    req.flash('error', 'An error occurred while processing your request');
    res.redirect('/find-my-artist');
  }
});

// POST /find-my-artist/book/bulk/submit - Submit bulk booking request
router.post('/book/bulk/submit', async (req, res) => {
  try {
    const { name, email, phone, eventCity, eventState, eventDate, notes, selections } = req.body;

    // Validate input
    if (!name || !email || !phone || !eventCity || !eventState || !eventDate || !selections) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/find-my-artist');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect('/find-my-artist');
    }

    // Create parent booking request
    const parentRequest = new ArtistBookingRequest({
      name,
      email,
      phone,
      eventCity,
      eventState,
      eventDate: new Date(eventDate),
      notes: notes || '',
      bookingType: 'bulk',
      isBulkRequest: true,
      selections: []
    });

    // Process selections
    const processedSelections = [];
    for (const selection of selections) {
      const selectionData = {
        bookingType: selection.bookingType
      };

      if (selection.bookingType === 'artist') {
        const artist = await Artist.findById(selection.artistId);
        if (!artist) continue;
        selectionData.artist = artist._id;
      } else if (selection.bookingType === 'role') {
        const roleSlot = await ArtistRoleSlot.findById(selection.roleId);
        if (!roleSlot || !roleSlot.isActive) continue;
        selectionData.roleSlot = roleSlot._id;
      }

      processedSelections.push(selectionData);
    }

    // Add selections to parent request
    parentRequest.selections = processedSelections;

    // Save parent request
    await parentRequest.save();

    // Send email notification to admin
    try {
      await sendArtistBookingRequestEmail(parentRequest);
    } catch (emailError) {
      console.error('Error sending booking request email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Your bulk booking request has been submitted successfully. We will contact you soon.');
    res.redirect('/find-my-artist/thank-you');
  } catch (error) {
    console.error('Error submitting bulk booking request:', error);

    // Provide more specific error message
    let errorMessage = 'An error occurred while submitting your booking request';
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    }

    req.flash('error', errorMessage);
    res.redirect('/find-my-artist');
  }
});

// POST /find-my-artist/book/bulk - Show bulk booking form
router.post('/book/bulk', (req, res) => {
  try {
    const { selections } = req.body;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      req.flash('error', 'Please select at least one artist or role');
      return res.redirect('/find-my-artist');
    }

    // Process selections
    const processedSelections = selections.map(selection => {
      return {
        bookingType: selection.bookingType,
        name: selection.name,
        artistId: selection.bookingType === 'artist' ? selection.artistId : null,
        roleId: selection.bookingType === 'role' ? selection.roleId : null
      };
    });

    res.render('find-my-artist/bulk-booking-form', {
      title: 'Bulk Booking Request',
      selections: processedSelections
    });
  } catch (error) {
    console.error('Error processing bulk booking form:', error);
    req.flash('error', 'An error occurred while processing your request');
    res.redirect('/find-my-artist');
  }
});

// POST /find-my-artist/book/bulk/submit - Submit bulk booking request
router.post('/book/bulk/submit', async (req, res) => {
  try {
    const { name, email, phone, eventCity, eventState, eventDate, notes, selections } = req.body;

    // Validate input
    if (!name || !email || !phone || !eventCity || !eventState || !eventDate || !selections) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/find-my-artist');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect('/find-my-artist');
    }

    // Generate a unique bulk request ID
    const bulkRequestId = new mongoose.Types.ObjectId();

    // Create parent booking request
    const parentRequest = new ArtistBookingRequest({
      name,
      email,
      phone,
      eventCity,
      eventState,
      eventDate: new Date(eventDate),
      notes: notes || '',
      bookingType: 'bulk',
      isBulkRequest: true,
      bulkRequestId,
      selections: []
    });

    // Process selections
    const processedSelections = [];
    for (const selection of selections) {
      const selectionData = {
        bookingType: selection.bookingType
      };

      if (selection.bookingType === 'artist') {
        const artist = await Artist.findById(selection.artistId);
        if (!artist) continue;
        selectionData.artist = artist._id;
      } else if (selection.bookingType === 'role') {
        const roleSlot = await ArtistRoleSlot.findById(selection.roleId);
        if (!roleSlot || !roleSlot.isActive) continue;
        selectionData.roleSlot = roleSlot._id;
      }

      processedSelections.push(selectionData);
    }

    // Add selections to parent request
    parentRequest.selections = processedSelections;
    await parentRequest.save();

    // Send email notification to admin
    try {
      await sendArtistBookingRequestEmail(parentRequest);
    } catch (emailError) {
      console.error('Error sending booking request email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', `Your booking request for ${processedSelections.length} items has been submitted successfully. We will contact you soon.`);
    res.redirect('/find-my-artist/thank-you');
  } catch (error) {
    console.error('Error submitting bulk booking request:', error);

    // Provide more specific error message
    let errorMessage = 'An error occurred while submitting your booking request';
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    }

    req.flash('error', errorMessage);
    res.redirect('/find-my-artist');
  }
});

// POST /find-my-artist/book/:type/:id - Submit booking request
router.post('/book/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { name, email, phone, eventCity, eventState, eventDate, notes } = req.body;

    if (type !== 'artist' && type !== 'role') {
      req.flash('error', 'Invalid booking type');
      return res.redirect('/find-my-artist');
    }

    // Validate input
    if (!name || !email || !phone || !eventCity || !eventState || !eventDate) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/find-my-artist/book/${type}/${id}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect(`/find-my-artist/book/${type}/${id}`);
    }

    // Create new booking request
    const newRequest = new ArtistBookingRequest({
      name,
      email,
      phone,
      eventCity,
      eventState,
      eventDate: new Date(eventDate),
      notes: notes || '',
      bookingType: type
    });

    // Set the appropriate reference based on type
    if (type === 'artist') {
      const artist = await Artist.findById(id);
      if (!artist) {
        req.flash('error', 'Artist not found');
        return res.redirect('/find-my-artist');
      }
      newRequest.artist = artist._id;
    } else {
      const roleSlot = await ArtistRoleSlot.findById(id);
      if (!roleSlot || !roleSlot.isActive) {
        req.flash('error', 'Role not found or not available for booking');
        return res.redirect('/find-my-artist');
      }
      newRequest.roleSlot = roleSlot._id;
    }

    await newRequest.save();

    // Send email notification to admin
    try {
      await sendArtistBookingRequestEmail(newRequest);
    } catch (emailError) {
      console.error('Error sending booking request email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Your booking request has been submitted successfully. We will contact you soon.');
    res.redirect('/find-my-artist/thank-you');
  } catch (error) {
    console.error('Error submitting booking request:', error);

    // Provide more specific error message
    let errorMessage = 'An error occurred while submitting your booking request';
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    }

    req.flash('error', errorMessage);
    res.redirect('/find-my-artist');
  }
});

// GET /find-my-artist/thank-you - Thank you page
router.get('/thank-you', (req, res) => {
  res.render('find-my-artist/thank-you', {
    title: 'Thank You'
  });
});

// Admin routes

// GET /admin/find-my-artist - Admin dashboard
router.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get counts for dashboard
    const featuredArtistsCount = await FeaturedArtist.countDocuments();
    const roleSlotsCount = await ArtistRoleSlot.countDocuments();
    const pendingRequestsCount = await ArtistBookingRequest.countDocuments({ status: 'pending' });
    const totalRequestsCount = await ArtistBookingRequest.countDocuments();

    // Get recent booking requests
    const recentRequests = await ArtistBookingRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name' } },
        { path: 'roleSlot' }
      ]);

    res.render('admin/find-my-artist/dashboard', {
      layout: 'admin',
      title: 'Find My Artist Management',
      currentPath: '/admin/find-my-artist',
      stats: {
        featuredArtistsCount,
        roleSlotsCount,
        pendingRequestsCount,
        totalRequestsCount
      },
      recentRequests
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    req.flash('error', 'An error occurred while loading the dashboard');
    res.redirect('/admin');
  }
});

// GET /admin/find-my-artist/featured-artists - Manage featured artists
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all featured artists
    const featuredArtists = await FeaturedArtist.find()
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      })
      .sort({ displayOrder: 1 });

    // Get all artists that are not featured
    const featuredArtistIds = featuredArtists.map(fa => fa.artist._id);
    const availableArtists = await Artist.find({
      _id: { $nin: featuredArtistIds },
      verified: true
    })
    .populate('user', 'name')
    .sort({ 'user.name': 1 });

    res.render('admin/find-my-artist/featured-artists', {
      layout: 'admin',
      title: 'Manage Featured Artists',
      currentPath: '/admin/find-my-artist/featured-artists',
      featuredArtists,
      availableArtists
    });
  } catch (error) {
    console.error('Error loading featured artists:', error);
    req.flash('error', 'An error occurred while loading featured artists');
    res.redirect('/admin/find-my-artist');
  }
});

// POST /admin/find-my-artist/featured-artists/add - Add a featured artist
router.post('/admin/find-my-artist/featured-artists/add', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { artistId, customDescription } = req.body;

    // Validate input
    if (!artistId) {
      req.flash('error', 'Please select an artist');
      return res.redirect('/admin/find-my-artist/featured-artists');
    }

    // Check if artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/find-my-artist/featured-artists');
    }

    // Check if artist is already featured
    const existingFeatured = await FeaturedArtist.findOne({ artist: artistId });
    if (existingFeatured) {
      req.flash('error', 'This artist is already featured');
      return res.redirect('/admin/find-my-artist/featured-artists');
    }

    // Get the highest display order
    const highestOrder = await FeaturedArtist.findOne().sort({ displayOrder: -1 });
    const nextOrder = highestOrder ? highestOrder.displayOrder + 1 : 1;

    // Create new featured artist
    const newFeaturedArtist = new FeaturedArtist({
      artist: artistId,
      addedBy: req.session.user.id,
      displayOrder: nextOrder,
      customDescription: customDescription || ''
    });

    await newFeaturedArtist.save();

    req.flash('success', 'Artist added to featured list successfully');
    res.redirect('/admin/find-my-artist/featured-artists');
  } catch (error) {
    console.error('Error adding featured artist:', error);
    req.flash('error', 'An error occurred while adding the featured artist');
    res.redirect('/admin/find-my-artist/featured-artists');
  }
});

// POST /admin/find-my-artist/featured-artists/:id/remove - Remove a featured artist
router.post('/admin/find-my-artist/featured-artists/:id/remove', isLoggedIn, isAdmin, async (req, res) => {
  try {
    await FeaturedArtist.findByIdAndDelete(req.params.id);

    req.flash('success', 'Artist removed from featured list successfully');
    res.redirect('/admin/find-my-artist/featured-artists');
  } catch (error) {
    console.error('Error removing featured artist:', error);
    req.flash('error', 'An error occurred while removing the featured artist');
    res.redirect('/admin/find-my-artist/featured-artists');
  }
});

// POST /admin/find-my-artist/featured-artists/update-order - Update display order
router.post('/admin/find-my-artist/featured-artists/update-order', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    // Update each featured artist's display order
    for (const item of orders) {
      await FeaturedArtist.findByIdAndUpdate(item.id, { displayOrder: item.order });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating display order:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/find-my-artist/role-slots - Manage role slots
router.get('/admin/find-my-artist/role-slots', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const roleSlots = await ArtistRoleSlot.find().sort({ displayOrder: 1, name: 1 });

    res.render('admin/find-my-artist/role-slots', {
      layout: 'admin',
      title: 'Manage Role Slots',
      currentPath: '/admin/find-my-artist/role-slots',
      roleSlots
    });
  } catch (error) {
    console.error('Error loading role slots:', error);
    req.flash('error', 'An error occurred while loading role slots');
    res.redirect('/admin/find-my-artist');
  }
});

// GET /admin/find-my-artist/role-slots/new - Show form to create a new role slot
router.get('/admin/find-my-artist/role-slots/new', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/find-my-artist/role-slot-form', {
    layout: 'admin',
    title: 'Add New Role Slot',
    currentPath: '/admin/find-my-artist/role-slots',
    roleSlot: null
  });
});

// POST /admin/find-my-artist/role-slots - Create a new role slot
router.post('/admin/find-my-artist/role-slots', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, city, state, isActive } = req.body;

    // Validate input
    if (!name || !description || !city || !state) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/find-my-artist/role-slots/new');
    }

    // Get the highest display order
    const highestOrder = await ArtistRoleSlot.findOne().sort({ displayOrder: -1 });
    const nextOrder = highestOrder ? highestOrder.displayOrder + 1 : 1;

    // Create new role slot
    const newRoleSlot = new ArtistRoleSlot({
      name,
      description,
      city,
      state,
      isActive: isActive === 'on',
      createdBy: req.session.user.id,
      displayOrder: nextOrder
    });

    await newRoleSlot.save();

    req.flash('success', 'Role slot created successfully');
    res.redirect('/admin/find-my-artist/role-slots');
  } catch (error) {
    console.error('Error creating role slot:', error);
    req.flash('error', 'An error occurred while creating the role slot');
    res.redirect('/admin/find-my-artist/role-slots/new');
  }
});

// GET /admin/find-my-artist/role-slots/:id/edit - Show form to edit a role slot
router.get('/admin/find-my-artist/role-slots/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const roleSlot = await ArtistRoleSlot.findById(req.params.id);

    if (!roleSlot) {
      req.flash('error', 'Role slot not found');
      return res.redirect('/admin/find-my-artist/role-slots');
    }

    res.render('admin/find-my-artist/role-slot-form', {
      layout: 'admin',
      title: 'Edit Role Slot',
      currentPath: '/admin/find-my-artist/role-slots',
      roleSlot
    });
  } catch (error) {
    console.error('Error loading role slot for editing:', error);
    req.flash('error', 'An error occurred while loading the role slot');
    res.redirect('/admin/find-my-artist/role-slots');
  }
});

// POST /admin/find-my-artist/role-slots/:id - Update a role slot
router.post('/admin/find-my-artist/role-slots/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, city, state, isActive } = req.body;

    // Validate input
    if (!name || !description || !city || !state) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/admin/find-my-artist/role-slots/${req.params.id}/edit`);
    }

    // Update role slot
    await ArtistRoleSlot.findByIdAndUpdate(req.params.id, {
      name,
      description,
      city,
      state,
      isActive: isActive === 'on'
    });

    req.flash('success', 'Role slot updated successfully');
    res.redirect('/admin/find-my-artist/role-slots');
  } catch (error) {
    console.error('Error updating role slot:', error);
    req.flash('error', 'An error occurred while updating the role slot');
    res.redirect(`/admin/find-my-artist/role-slots/${req.params.id}/edit`);
  }
});

// POST /admin/find-my-artist/role-slots/:id/delete - Delete a role slot
router.post('/admin/find-my-artist/role-slots/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Check if there are any pending booking requests for this role
    const pendingRequests = await ArtistBookingRequest.countDocuments({
      roleSlot: req.params.id,
      status: 'pending'
    });

    if (pendingRequests > 0) {
      req.flash('error', `Cannot delete role slot with ${pendingRequests} pending booking requests`);
      return res.redirect('/admin/find-my-artist/role-slots');
    }

    await ArtistRoleSlot.findByIdAndDelete(req.params.id);

    req.flash('success', 'Role slot deleted successfully');
    res.redirect('/admin/find-my-artist/role-slots');
  } catch (error) {
    console.error('Error deleting role slot:', error);
    req.flash('error', 'An error occurred while deleting the role slot');
    res.redirect('/admin/find-my-artist/role-slots');
  }
});

// POST /admin/find-my-artist/role-slots/update-order - Update display order
router.post('/admin/find-my-artist/role-slots/update-order', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    // Update each role slot's display order
    for (const item of orders) {
      await ArtistRoleSlot.findByIdAndUpdate(item.id, { displayOrder: item.order });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating display order:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/find-my-artist/booking-requests - List all booking requests
router.get('/admin/find-my-artist/booking-requests', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, status, type, city, state, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Type filter
    if (type && type !== 'all') {
      filter.bookingType = type;
    }

    // City filter
    if (city && city !== 'all') {
      filter.eventCity = new RegExp(city, 'i');
    }

    // State filter
    if (state && state !== 'all') {
      filter.eventState = new RegExp(state, 'i');
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get requests without pagination for search
    let requests = await ArtistBookingRequest.find(filter)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name' } },
        { path: 'roleSlot' },
        { path: 'reviewedBy', select: 'name email' }
      ])
      .sort(sortOptions);

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      requests = requests.filter(request => {
        const name = (request.name || '').toLowerCase();
        const email = (request.email || '').toLowerCase();
        const phone = (request.phone || '').toLowerCase();
        const eventCity = (request.eventCity || '').toLowerCase();
        const eventState = (request.eventState || '').toLowerCase();
        const notes = (request.notes || '').toLowerCase();
        const artistName = (request.artist && request.artist.user ? request.artist.user.name : '').toLowerCase();
        const stageName = (request.artist ? request.artist.stageName : '').toLowerCase();
        const roleSlotName = (request.roleSlot ? request.roleSlot.name : '').toLowerCase();

        return name.includes(searchTerm) ||
               email.includes(searchTerm) ||
               phone.includes(searchTerm) ||
               eventCity.includes(searchTerm) ||
               eventState.includes(searchTerm) ||
               notes.includes(searchTerm) ||
               artistName.includes(searchTerm) ||
               stageName.includes(searchTerm) ||
               roleSlotName.includes(searchTerm);
      });
    }

    // Get unique cities, states for filter dropdowns
    const cities = await ArtistBookingRequest.distinct('eventCity');
    const states = await ArtistBookingRequest.distinct('eventState');

    // Get statistics
    const totalRequests = await ArtistBookingRequest.countDocuments();
    const pendingRequests = await ArtistBookingRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await ArtistBookingRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await ArtistBookingRequest.countDocuments({ status: 'rejected' });
    const artistBookings = await ArtistBookingRequest.countDocuments({ bookingType: 'artist' });
    const roleBookings = await ArtistBookingRequest.countDocuments({ bookingType: 'role' });
    const bulkBookings = await ArtistBookingRequest.countDocuments({ bookingType: 'bulk' });

    res.render('admin/find-my-artist/booking-requests', {
      layout: 'admin',
      title: 'Artist Booking Requests',
      currentPath: '/admin/find-my-artist/booking-requests',
      requests,
      searchParams: {
        search: search || '',
        status: status || 'all',
        type: type || 'all',
        city: city || 'all',
        state: state || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        artist: artistBookings,
        role: roleBookings,
        bulk: bulkBookings,
        filtered: requests.length
      },
      filterOptions: {
        cities: cities.filter(c => c && c.trim()).sort(),
        states: states.filter(s => s && s.trim()).sort()
      }
    });
  } catch (error) {
    console.error('Error loading booking requests:', error);
    req.flash('error', 'An error occurred while loading booking requests');
    res.redirect('/admin/find-my-artist');
  }
});

// Export artist booking requests to CSV
router.get('/admin/find-my-artist/booking-requests/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, status, type, city, state, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (type && type !== 'all') {
      filter.bookingType = type;
    }

    if (city && city !== 'all') {
      filter.eventCity = new RegExp(city, 'i');
    }

    if (state && state !== 'all') {
      filter.eventState = new RegExp(state, 'i');
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get requests
    let requests = await ArtistBookingRequest.find(filter)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name' } },
        { path: 'roleSlot' },
        { path: 'reviewedBy', select: 'name email' }
      ])
      .sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      requests = requests.filter(request => {
        const name = (request.name || '').toLowerCase();
        const email = (request.email || '').toLowerCase();
        const phone = (request.phone || '').toLowerCase();
        const eventCity = (request.eventCity || '').toLowerCase();
        const eventState = (request.eventState || '').toLowerCase();
        const notes = (request.notes || '').toLowerCase();
        const artistName = (request.artist && request.artist.user ? request.artist.user.name : '').toLowerCase();
        const stageName = (request.artist ? request.artist.stageName : '').toLowerCase();
        const roleSlotName = (request.roleSlot ? request.roleSlot.name : '').toLowerCase();

        return name.includes(searchTerm) ||
               email.includes(searchTerm) ||
               phone.includes(searchTerm) ||
               eventCity.includes(searchTerm) ||
               eventState.includes(searchTerm) ||
               notes.includes(searchTerm) ||
               artistName.includes(searchTerm) ||
               stageName.includes(searchTerm) ||
               roleSlotName.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Name,Email,Phone,Booking Type,Booking Target,Event Location,Event Date,Status,Notes,Request Date,Reviewed By,Reviewed Date\n';
    const csvRows = requests.map(request => {
      const name = `"${(request.name || '').replace(/"/g, '""')}"`;
      const email = `"${(request.email || '').replace(/"/g, '""')}"`;
      const phone = `"${(request.phone || '').replace(/"/g, '""')}"`;
      const bookingType = request.bookingType || '';

      let bookingTarget = '';
      if (request.bookingType === 'artist' && request.artist) {
        bookingTarget = request.artist.stageName || (request.artist.user ? request.artist.user.name : 'Unknown');
      } else if (request.bookingType === 'role' && request.roleSlot) {
        bookingTarget = request.roleSlot.name;
      } else if (request.bookingType === 'bulk') {
        bookingTarget = 'Bulk Booking';
      }
      bookingTarget = `"${bookingTarget.replace(/"/g, '""')}"`;

      const eventLocation = `"${request.eventCity}, ${request.eventState}".replace(/"/g, '""')`;
      const eventDate = new Date(request.eventDate).toLocaleDateString();
      const status = request.status || '';
      const notes = `"${(request.notes || '').replace(/"/g, '""')}"`;
      const requestDate = new Date(request.createdAt).toLocaleDateString();
      const reviewedBy = request.reviewedBy ? request.reviewedBy.name : '';
      const reviewedDate = request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString() : '';

      return `${name},${email},${phone},${bookingType},${bookingTarget},${eventLocation},${eventDate},${status},${notes},${requestDate},"${reviewedBy}",${reviewedDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `artist_booking_requests_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export artist booking requests error:', error);
    req.flash('error', 'Failed to export artist booking requests');
    res.redirect('/admin/find-my-artist/booking-requests');
  }
});

// GET /admin/find-my-artist/booking-requests/:id - View a specific booking request
router.get('/admin/find-my-artist/booking-requests/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const request = await ArtistBookingRequest.findById(req.params.id)
      .populate([
        { path: 'artist', populate: { path: 'user', select: 'name profileImage' } },
        { path: 'roleSlot' },
        { path: 'reviewedBy', select: 'name email' }
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
router.post('/admin/find-my-artist/booking-requests/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const request = await ArtistBookingRequest.findById(req.params.id);

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

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('ArtistBookingRequest', request._id, 'approved');

    // Send approval email to requester
    try {
      // Implement email sending functionality
      // await sendArtistBookingApprovalEmail(request);
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Booking request approved successfully');
    res.redirect('/admin/find-my-artist/booking-requests');
  } catch (error) {
    console.error('Error approving booking request:', error);
    req.flash('error', 'An error occurred while approving the booking request');
    res.redirect(`/admin/find-my-artist/booking-requests/${req.params.id}`);
  }
});

// POST /admin/find-my-artist/booking-requests/:id/reject - Reject a booking request
router.post('/admin/find-my-artist/booking-requests/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
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

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('ArtistBookingRequest', request._id, 'rejected');

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
router.post('/admin/find-my-artist/booking-requests/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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
