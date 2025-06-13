const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const FeaturedArtist = require('../models/FeaturedArtist');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// GET /admin/find-my-artist/featured-artists - Manage featured artists
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, genre, city, state, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object for featured artists
    const filter = {};

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
    let sortOptions = { displayOrder: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get all featured artists
    let featuredArtists = await FeaturedArtist.find(filter)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      })
      .sort(sortOptions);

    // Apply filters on populated artist data
    if (genre && genre !== 'all') {
      featuredArtists = featuredArtists.filter(fa =>
        fa.artist && fa.artist.genre && fa.artist.genre.toLowerCase().includes(genre.toLowerCase())
      );
    }

    if (city && city !== 'all') {
      featuredArtists = featuredArtists.filter(fa =>
        fa.artist && fa.artist.city && fa.artist.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    if (state && state !== 'all') {
      featuredArtists = featuredArtists.filter(fa =>
        fa.artist && fa.artist.state && fa.artist.state.toLowerCase().includes(state.toLowerCase())
      );
    }

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      featuredArtists = featuredArtists.filter(fa => {
        const artistName = (fa.artist && fa.artist.user ? fa.artist.user.name : '').toLowerCase();
        const stageName = (fa.artist ? fa.artist.stageName : '').toLowerCase();
        const genre = (fa.artist ? fa.artist.genre : '').toLowerCase();
        const city = (fa.artist ? fa.artist.city : '').toLowerCase();
        const state = (fa.artist ? fa.artist.state : '').toLowerCase();
        const description = (fa.customDescription || '').toLowerCase();

        return artistName.includes(searchTerm) ||
               stageName.includes(searchTerm) ||
               genre.includes(searchTerm) ||
               city.includes(searchTerm) ||
               state.includes(searchTerm) ||
               description.includes(searchTerm);
      });
    }

    // Get all artists that are not featured
    const featuredArtistIds = featuredArtists.map(fa => fa.artist._id);
    const availableArtists = await Artist.find({
      _id: { $nin: featuredArtistIds },
      verified: true
    })
    .populate('user', 'name')
    .sort({ 'user.name': 1 });

    // Get filter options
    const allGenres = await Artist.distinct('genre', { verified: true });
    const allCities = await Artist.distinct('city', { verified: true });
    const allStates = await Artist.distinct('state', { verified: true });

    // Get statistics
    const totalFeatured = await FeaturedArtist.countDocuments();

    res.render('admin/find-my-artist/featured-artists', {
      layout: 'admin',
      title: 'Manage Featured Artists',
      currentPath: '/admin/find-my-artist/featured-artists',
      featuredArtists,
      availableArtists,
      searchParams: {
        search: search || '',
        genre: genre || 'all',
        city: city || 'all',
        state: state || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'displayOrder',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalFeatured,
        filtered: featuredArtists.length
      },
      filterOptions: {
        genres: allGenres.filter(g => g && g.trim()).sort(),
        cities: allCities.filter(c => c && c.trim()).sort(),
        states: allStates.filter(s => s && s.trim()).sort()
      }
    });
  } catch (error) {
    console.error('Error loading featured artists:', error);
    req.flash('error', 'An error occurred while loading featured artists');
    res.redirect('/admin/find-my-artist');
  }
});

// Export featured artists to CSV
router.get('/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, genre, city, state, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

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
    let sortOptions = { displayOrder: 1 };
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get featured artists
    let featuredArtists = await FeaturedArtist.find(filter)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      })
      .sort(sortOptions);

    // Apply filters and search (same logic as main route)
    if (genre && genre !== 'all') {
      featuredArtists = featuredArtists.filter(fa =>
        fa.artist && fa.artist.genre && fa.artist.genre.toLowerCase().includes(genre.toLowerCase())
      );
    }

    if (city && city !== 'all') {
      featuredArtists = featuredArtists.filter(fa =>
        fa.artist && fa.artist.city && fa.artist.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    if (state && state !== 'all') {
      featuredArtists = featuredArtists.filter(fa =>
        fa.artist && fa.artist.state && fa.artist.state.toLowerCase().includes(state.toLowerCase())
      );
    }

    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      featuredArtists = featuredArtists.filter(fa => {
        const artistName = (fa.artist && fa.artist.user ? fa.artist.user.name : '').toLowerCase();
        const stageName = (fa.artist ? fa.artist.stageName : '').toLowerCase();
        const genre = (fa.artist ? fa.artist.genre : '').toLowerCase();
        const city = (fa.artist ? fa.artist.city : '').toLowerCase();
        const state = (fa.artist ? fa.artist.state : '').toLowerCase();
        const description = (fa.customDescription || '').toLowerCase();

        return artistName.includes(searchTerm) ||
               stageName.includes(searchTerm) ||
               genre.includes(searchTerm) ||
               city.includes(searchTerm) ||
               state.includes(searchTerm) ||
               description.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Display Order,Artist Name,Stage Name,Genre,Location,Custom Description,Featured Date\n';
    const csvRows = featuredArtists.map(fa => {
      const displayOrder = fa.displayOrder || 0;
      const artistName = fa.artist && fa.artist.user ? fa.artist.user.name : 'Unknown';
      const stageName = fa.artist ? fa.artist.stageName : '';
      const genre = fa.artist ? fa.artist.genre : '';
      const location = fa.artist && fa.artist.city && fa.artist.state ?
        `${fa.artist.city}, ${fa.artist.state}` : 'Location not specified';
      const description = `"${(fa.customDescription || '').replace(/"/g, '""')}"`;
      const featuredDate = new Date(fa.createdAt).toLocaleDateString();

      return `${displayOrder},"${artistName}","${stageName}","${genre}","${location}",${description},${featuredDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `featured_artists_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export featured artists error:', error);
    req.flash('error', 'Failed to export featured artists');
    res.redirect('/admin/find-my-artist/featured-artists');
  }
});

// POST /admin/find-my-artist/featured-artists/add - Add a featured artist
router.post('/add', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/:id/remove', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/update-order', isLoggedIn, isAdmin, async (req, res) => {
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

module.exports = router;
