const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const FeaturedArtist = require('../models/FeaturedArtist');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

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
