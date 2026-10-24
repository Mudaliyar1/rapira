const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DailyConcert = require('../models/DailyConcert');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');

// GET /admin/daily-concerts - Admin: List all daily concerts
router.get('/', isLoggedIn, hasAdminPermission('manage_daily_concerts'), async (req, res) => {
  try {
    // Get search parameters
    const { search, visible, dateRange, city, state, bookingType, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Visibility filter
    if (visible && visible !== 'all') {
      filter.isVisible = visible === 'true';
    }

    // Booking type filter
    if (bookingType && bookingType !== 'all') {
      filter.bookingType = bookingType;
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
        filter.eventDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'upcoming') {
        filter.eventDate = { $gte: now };
      } else if (dateRange === 'past') {
        filter.eventDate = { $lt: now };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.eventDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.eventDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    // Build sort options
    let sortOptions = { eventDate: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get all cities and states for filter dropdown
    const allCities = await DailyConcert.distinct('eventCity');
    const allStates = await DailyConcert.distinct('eventState');

    // Get daily concerts without pagination for search
    let dailyConcerts = await DailyConcert.find(filter)
      .populate([
        {
          path: 'artist',
          populate: { path: 'user', select: 'name profileImage' }
        },
        { path: 'roleSlot' },
        { path: 'bookingRequest' },
        { path: 'createdBy', select: 'name email' }
      ])
      .sort(sortOptions);

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      dailyConcerts = dailyConcerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const description = (concert.description || '').toLowerCase();
        const artistName = (concert.artist && concert.artist.user ? concert.artist.user.name : '').toLowerCase();
        const stageName = (concert.artist ? concert.artist.stageName : '').toLowerCase();
        const roleName = (concert.roleSlot ? concert.roleSlot.name : '').toLowerCase();
        const organizerName = (concert.organizerName || '').toLowerCase();
        const city = (concert.eventCity || '').toLowerCase();
        const state = (concert.eventState || '').toLowerCase();

        return title.includes(searchTerm) ||
          description.includes(searchTerm) ||
          artistName.includes(searchTerm) ||
          stageName.includes(searchTerm) ||
          roleName.includes(searchTerm) ||
          organizerName.includes(searchTerm) ||
          city.includes(searchTerm) ||
          state.includes(searchTerm);
      });
    }

    // Get statistics
    const totalConcerts = await DailyConcert.countDocuments();
    const visibleConcerts = await DailyConcert.countDocuments({ isVisible: true });
    const hiddenConcerts = await DailyConcert.countDocuments({ isVisible: false });
    const upcomingConcerts = await DailyConcert.countDocuments({
      eventDate: { $gte: new Date() }
    });
    const artistConcerts = await DailyConcert.countDocuments({ bookingType: 'artist' });
    const roleConcerts = await DailyConcert.countDocuments({ bookingType: 'role' });

    res.render('admin/daily-concerts/index', {
      layout: 'admin',
      title: 'Daily Concerts Management',
      currentPath: '/admin/daily-concerts',
      dailyConcerts,
      searchParams: {
        search: search || '',
        visible: visible || 'all',
        dateRange: dateRange || 'all',
        city: city || 'all',
        state: state || 'all',
        bookingType: bookingType || 'all',
        sortBy: sortBy || 'eventDate',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalConcerts,
        visible: visibleConcerts,
        hidden: hiddenConcerts,
        upcoming: upcomingConcerts,
        artist: artistConcerts,
        role: roleConcerts,
        filtered: dailyConcerts.length
      },
      filterOptions: {
        cities: allCities.filter(c => c && c.trim()).sort(),
        states: allStates.filter(s => s && s.trim()).sort()
      }
    });
  } catch (error) {
    console.error('Error loading admin daily concerts page:', error);
    req.flash('error', 'An error occurred while loading the page');
    res.redirect('/admin');
  }
});

// Export daily concerts to CSV
router.get('/export', isLoggedIn, hasAdminPermission('manage_daily_concerts'), async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, visible, dateRange, city, state, bookingType, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (visible && visible !== 'all') {
      filter.isVisible = visible === 'true';
    }

    if (bookingType && bookingType !== 'all') {
      filter.bookingType = bookingType;
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
        filter.eventDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'upcoming') {
        filter.eventDate = { $gte: now };
      } else if (dateRange === 'past') {
        filter.eventDate = { $lt: now };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.eventDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.eventDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    // Build sort options
    let sortOptions = { eventDate: 1 };
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get daily concerts
    let dailyConcerts = await DailyConcert.find(filter)
      .populate([
        {
          path: 'artist',
          populate: { path: 'user', select: 'name profileImage' }
        },
        { path: 'roleSlot' },
        { path: 'bookingRequest' },
        { path: 'createdBy', select: 'name email' }
      ])
      .sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      dailyConcerts = dailyConcerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const description = (concert.description || '').toLowerCase();
        const artistName = (concert.artist && concert.artist.user ? concert.artist.user.name : '').toLowerCase();
        const stageName = (concert.artist ? concert.artist.stageName : '').toLowerCase();
        const roleName = (concert.roleSlot ? concert.roleSlot.name : '').toLowerCase();
        const organizerName = (concert.organizerName || '').toLowerCase();
        const city = (concert.eventCity || '').toLowerCase();
        const state = (concert.eventState || '').toLowerCase();

        return title.includes(searchTerm) ||
          description.includes(searchTerm) ||
          artistName.includes(searchTerm) ||
          stageName.includes(searchTerm) ||
          roleName.includes(searchTerm) ||
          organizerName.includes(searchTerm) ||
          city.includes(searchTerm) ||
          state.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Title,Artist/Role,Booking Type,Date,Time,City,State,Organizer,Visibility,Created Date,Created By\n';
    const csvRows = dailyConcerts.map(concert => {
      const title = `"${(concert.title || '').replace(/"/g, '""')}"`;
      let artistRole = '';
      if (concert.bookingType === 'artist' && concert.artist) {
        artistRole = concert.artist.stageName || (concert.artist.user ? concert.artist.user.name : '');
      } else if (concert.bookingType === 'role' && concert.roleSlot) {
        artistRole = concert.roleSlot.name + ' (Role)';
      } else {
        artistRole = 'Multiple Artists';
      }
      artistRole = `"${artistRole.replace(/"/g, '""')}"`;
      const bookingType = concert.bookingType || '';
      const date = concert.eventDate ? new Date(concert.eventDate).toLocaleDateString() : '';
      const time = concert.eventTime || '';
      const city = `"${(concert.eventCity || '').replace(/"/g, '""')}"`;
      const state = `"${(concert.eventState || '').replace(/"/g, '""')}"`;
      const organizer = `"${(concert.organizerName || '').replace(/"/g, '""')}"`;
      const visibility = concert.isVisible ? 'Visible' : 'Hidden';
      const createdDate = new Date(concert.createdAt).toLocaleDateString();
      const createdBy = `"${(concert.createdBy ? concert.createdBy.name : '').replace(/"/g, '""')}"`;

      return `${title},${artistRole},${bookingType},${date},${time},${city},${state},${organizer},${visibility},${createdDate},${createdBy}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `daily_concerts_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export daily concerts error:', error);
    req.flash('error', 'Failed to export daily concerts');
    res.redirect('/admin/daily-concerts');
  }
});

// GET /admin/daily-concerts/:id - Admin: View a specific daily concert
router.get('/:id', isLoggedIn, hasAdminPermission('manage_daily_concerts'), async (req, res) => {
  try {
    const dailyConcert = await DailyConcert.findById(req.params.id)
      .populate([
        {
          path: 'artist',
          populate: { path: 'user', select: 'name email profileImage' }
        },
        { path: 'roleSlot' },
        { path: 'bookingRequest' },
        { path: 'createdBy', select: 'name email' }
      ]);

    if (!dailyConcert) {
      req.flash('error', 'Daily concert not found');
      return res.redirect('/admin/daily-concerts');
    }

    res.render('admin/daily-concerts/details', {
      layout: 'admin',
      title: 'Daily Concert Details',
      currentPath: '/admin/daily-concerts',
      dailyConcert
    });
  } catch (error) {
    console.error('Error loading daily concert details:', error);
    req.flash('error', 'An error occurred while loading the concert details');
    res.redirect('/admin/daily-concerts');
  }
});

// POST /admin/daily-concerts/:id/toggle-visibility - Admin: Toggle visibility
router.post('/:id/toggle-visibility', isLoggedIn, hasAdminPermission('manage_daily_concerts'), async (req, res) => {
  try {
    const dailyConcert = await DailyConcert.findById(req.params.id);

    if (!dailyConcert) {
      req.flash('error', 'Daily concert not found');
      return res.redirect('/admin/daily-concerts');
    }

    // Toggle visibility
    dailyConcert.isVisible = !dailyConcert.isVisible;
    await dailyConcert.save();

    req.flash('success', `Concert visibility ${dailyConcert.isVisible ? 'enabled' : 'disabled'} successfully`);
    res.redirect('/admin/daily-concerts');
  } catch (error) {
    console.error('Error toggling daily concert visibility:', error);
    req.flash('error', 'An error occurred while updating the concert');
    res.redirect('/admin/daily-concerts');
  }
});

// POST /admin/daily-concerts/:id/edit - Admin: Edit daily concert
router.post('/:id/edit', isLoggedIn, hasAdminPermission('manage_daily_concerts'), async (req, res) => {
  try {
    const { title, description, eventTime, eventDate } = req.body;

    const dailyConcert = await DailyConcert.findById(req.params.id);

    if (!dailyConcert) {
      req.flash('error', 'Daily concert not found');
      return res.redirect('/admin/daily-concerts');
    }

    // Update fields
    dailyConcert.title = title;
    dailyConcert.description = description;
    dailyConcert.eventTime = eventTime;
    if (eventDate) {
      dailyConcert.eventDate = new Date(eventDate);
    }

    await dailyConcert.save();

    req.flash('success', 'Concert updated successfully');
    res.redirect(`/admin/daily-concerts/${dailyConcert._id}`);
  } catch (error) {
    console.error('Error updating daily concert:', error);
    req.flash('error', 'An error occurred while updating the concert');
    res.redirect(`/admin/daily-concerts/${req.params.id}`);
  }
});

// POST /admin/daily-concerts/:id/delete - Admin: Delete daily concert
router.post('/:id/delete', isLoggedIn, hasAdminPermission('manage_daily_concerts'), async (req, res) => {
  try {
    await DailyConcert.findByIdAndDelete(req.params.id);

    req.flash('success', 'Concert deleted successfully');
    res.redirect('/admin/daily-concerts');
  } catch (error) {
    console.error('Error deleting daily concert:', error);
    req.flash('error', 'An error occurred while deleting the concert');
    res.redirect('/admin/daily-concerts');
  }
});

module.exports = router;