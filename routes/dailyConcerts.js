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
    const { date, city, state, search, sort } = req.query;

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

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { eventCity: searchRegex },
        { eventState: searchRegex },
        { organizerName: searchRegex },
        { description: searchRegex }
      ];
    }

    // Build sort object
    let sortObj = { eventDate: 1 }; // Default sort by date ascending

    if (sort) {
      switch (sort) {
        case 'title':
          sortObj = { title: 1 };
          break;
        case 'city':
          sortObj = { eventCity: 1 };
          break;
        case 'organizer':
          sortObj = { organizerName: 1 };
          break;
        case 'date':
        default:
          sortObj = { eventDate: 1 };
          break;
      }
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
      .sort(sortObj);

    // Calculate statistics
    const now = new Date();
    const totalConcerts = await DailyConcert.countDocuments({ isVisible: true });
    const upcomingConcerts = await DailyConcert.countDocuments({
      isVisible: true,
      eventDate: { $gte: now }
    });
    const artistConcerts = await DailyConcert.countDocuments({
      isVisible: true,
      bookingType: 'artist'
    });
    const roleConcerts = await DailyConcert.countDocuments({
      isVisible: true,
      bookingType: 'role'
    });

    const stats = {
      total: totalConcerts,
      upcoming: upcomingConcerts,
      artist: artistConcerts,
      role: roleConcerts,
      filtered: dailyConcerts.length
    };

    res.render('daily-concerts/index', {
      title: 'Daily Concerts',
      dailyConcerts,
      filters: { date, city, state, search, sort: sort || 'date' },
      filterOptions: {
        cities: allCities,
        states: allStates
      },
      stats
    });
  } catch (error) {
    console.error('Error loading daily concerts page:', error);
    req.flash('error', 'An error occurred while loading the page');
    res.redirect('/');
  }
});

module.exports = router;
