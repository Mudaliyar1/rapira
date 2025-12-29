const express = require('express');
const router = express.Router();
const WebsiteUpdate = require('../models/WebsiteUpdate');

// GET /website-updates - Show all website updates to users
router.get('/', async (req, res) => {
  try {
    // Only show active updates, sorted by most recent first
    const updates = await WebsiteUpdate.find({ isActive: true })
      .populate('author', 'name')
      .sort({ timestamp: -1 });
    
    res.render('website-updates', {
      layout: 'layouts/main',
      title: 'Website Updates',
      updates
    });
  } catch (error) {
    console.error('Error loading website updates:', error);
    req.flash('error', 'Failed to load website updates');
    res.redirect('/');
  }
});

// GET /website-updates/:id - Show specific website update
router.get('/:id', async (req, res) => {
  try {
    const update = await WebsiteUpdate.findById(req.params.id)
      .populate('author', 'name')
      .select('_id title description content timestamp priority tags isActive');
    
    if (!update || !update.isActive) {
      req.flash('error', 'Website update not found');
      return res.redirect('/website-updates');
    }
    
    // Pass as a single-item array to reuse the same template
    res.render('website-updates', {
      layout: 'layouts/main',
      title: update.title,
      updates: [update]
    });
  } catch (error) {
    console.error('Error loading website update details:', error);
    req.flash('error', 'Failed to load website update');
    res.redirect('/website-updates');
  }
});

module.exports = router;