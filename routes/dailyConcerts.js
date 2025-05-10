const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DailyConcert = require('../models/DailyConcert');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// GET /daily-concerts - Show all daily concerts
router.get('/', async (req, res) => {
  try {
    // Get filter parameters
    const { date, city, state } = req.query;

    // Build filter object
    const filter = { isVisible: true };

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
    const allCities = await DailyConcert.distinct('eventCity', { isVisible: true });
    const allStates = await DailyConcert.distinct('eventState', { isVisible: true });

    // Get daily concerts
    const dailyConcerts = await DailyConcert.find(filter)
      .populate([
        {
          path: 'artist',
          populate: { path: 'user', select: 'name profileImage' }
        },
        { path: 'roleSlot' },
        { path: 'bookingRequest' }
      ])
      .sort({ eventDate: 1 });

    res.render('daily-concerts/index', {
      title: 'Daily Concerts',
      dailyConcerts,
      filters: { date, city, state },
      filterOptions: {
        cities: allCities,
        states: allStates
      }
    });
  } catch (error) {
    console.error('Error loading daily concerts page:', error);
    req.flash('error', 'An error occurred while loading the page');
    res.redirect('/');
  }
});

module.exports = router;
