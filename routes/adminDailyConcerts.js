const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DailyConcert = require('../models/DailyConcert');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// GET /admin/daily-concerts - Admin: List all daily concerts
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get filter parameters
    const { visible, date, city, state } = req.query;

    // Build filter object
    const filter = {};
    
    if (visible === 'true') {
      filter.isVisible = true;
    } else if (visible === 'false') {
      filter.isVisible = false;
    }

    if (city) {
      filter.eventCity = new RegExp(city, 'i');
    }

    if (state) {
      filter.eventState = new RegExp(state, 'i');
    }

    if (date) {
      const selectedDate = new Date(date);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filter.eventDate = {
        $gte: selectedDate,
        $lt: nextDay
      };
    }

    // Get all cities and states for filter dropdown
    const allCities = await DailyConcert.distinct('eventCity');
    const allStates = await DailyConcert.distinct('eventState');

    // Get daily concerts with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const total = await DailyConcert.countDocuments(filter);

    const dailyConcerts = await DailyConcert.find(filter)
      .populate([
        { 
          path: 'artist', 
          populate: { path: 'user', select: 'name profileImage' } 
        },
        { path: 'roleSlot' },
        { path: 'bookingRequest' },
        { path: 'createdBy', select: 'name email' }
      ])
      .sort({ eventDate: 1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/daily-concerts/index', {
      layout: 'admin',
      title: 'Daily Concerts Management',
      currentPath: '/admin/daily-concerts',
      dailyConcerts,
      filters: { visible, date, city, state },
      filterOptions: {
        cities: allCities,
        states: allStates
      },
      pagination: {
        page,
        pageCount: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error loading admin daily concerts page:', error);
    req.flash('error', 'An error occurred while loading the page');
    res.redirect('/admin');
  }
});

// GET /admin/daily-concerts/:id - Admin: View a specific daily concert
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/:id/toggle-visibility', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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