const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ArtistRoleSlot = require('../models/ArtistRoleSlot');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// GET /admin/find-my-artist/role-slots - Manage role slots
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/new', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/find-my-artist/role-slot-form', {
    layout: 'admin',
    title: 'Add New Role Slot',
    currentPath: '/admin/find-my-artist/role-slots',
    roleSlot: null
  });
});

// POST /admin/find-my-artist/role-slots - Create a new role slot
router.post('/', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/:id', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/update-order', isLoggedIn, isAdmin, async (req, res) => {
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

module.exports = router;
