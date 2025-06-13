const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ArtistRoleSlot = require('../models/ArtistRoleSlot');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// GET /admin/find-my-artist/role-slots - Manage role slots
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, isActive, city, state, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Active status filter
    if (isActive && isActive !== 'all') {
      filter.isActive = isActive === 'true';
    }

    // City filter
    if (city && city !== 'all') {
      filter.city = new RegExp(city, 'i');
    }

    // State filter
    if (state && state !== 'all') {
      filter.state = new RegExp(state, 'i');
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
    let sortOptions = { displayOrder: 1, name: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get role slots with filters
    let roleSlots = await ArtistRoleSlot.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      roleSlots = roleSlots.filter(slot => {
        const name = (slot.name || '').toLowerCase();
        const description = (slot.description || '').toLowerCase();
        const city = (slot.city || '').toLowerCase();
        const state = (slot.state || '').toLowerCase();

        return name.includes(searchTerm) ||
               description.includes(searchTerm) ||
               city.includes(searchTerm) ||
               state.includes(searchTerm);
      });
    }

    // Get all cities and states for filter dropdown
    const allCities = await ArtistRoleSlot.distinct('city');
    const allStates = await ArtistRoleSlot.distinct('state');

    // Get statistics
    const totalSlots = await ArtistRoleSlot.countDocuments();
    const activeSlots = await ArtistRoleSlot.countDocuments({ isActive: true });
    const inactiveSlots = await ArtistRoleSlot.countDocuments({ isActive: false });

    res.render('admin/find-my-artist/role-slots', {
      layout: 'admin',
      title: 'Manage Role Slots',
      currentPath: '/admin/find-my-artist/role-slots',
      roleSlots,
      searchParams: {
        search: search || '',
        isActive: isActive || 'all',
        city: city || 'all',
        state: state || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'displayOrder',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalSlots,
        active: activeSlots,
        inactive: inactiveSlots,
        filtered: roleSlots.length
      },
      filterOptions: {
        cities: allCities.filter(c => c && c.trim()).sort(),
        states: allStates.filter(s => s && s.trim()).sort()
      }
    });
  } catch (error) {
    console.error('Error loading role slots:', error);
    req.flash('error', 'An error occurred while loading role slots');
    res.redirect('/admin/find-my-artist');
  }
});

// Export role slots to CSV
router.get('/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, isActive, city, state, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (isActive && isActive !== 'all') {
      filter.isActive = isActive === 'true';
    }

    if (city && city !== 'all') {
      filter.city = new RegExp(city, 'i');
    }

    if (state && state !== 'all') {
      filter.state = new RegExp(state, 'i');
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
    let sortOptions = { displayOrder: 1, name: 1 };
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get role slots with filters
    let roleSlots = await ArtistRoleSlot.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      roleSlots = roleSlots.filter(slot => {
        const name = (slot.name || '').toLowerCase();
        const description = (slot.description || '').toLowerCase();
        const city = (slot.city || '').toLowerCase();
        const state = (slot.state || '').toLowerCase();

        return name.includes(searchTerm) ||
               description.includes(searchTerm) ||
               city.includes(searchTerm) ||
               state.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Display Order,Name,Description,Location,Status,Created Date\n';
    const csvRows = roleSlots.map(slot => {
      const displayOrder = slot.displayOrder || 0;
      const name = `"${(slot.name || '').replace(/"/g, '""')}"`;
      const description = `"${(slot.description || '').replace(/"/g, '""')}"`;
      const location = `"${slot.city}, ${slot.state}".replace(/"/g, '""')`;
      const status = slot.isActive ? 'Active' : 'Inactive';
      const createdDate = new Date(slot.createdAt).toLocaleDateString();

      return `${displayOrder},${name},${description},${location},${status},${createdDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `role_slots_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export role slots error:', error);
    req.flash('error', 'Failed to export role slots');
    res.redirect('/admin/find-my-artist/role-slots');
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
