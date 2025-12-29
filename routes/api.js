const express = require('express');
const router = express.Router();
const WebsiteUpdate = require('../models/WebsiteUpdate');

// GET /api/latest-website-update - API to get the latest active website update
router.get('/latest-website-update', async (req, res) => {
  try {
    // Only return the most recent active update
    const update = await WebsiteUpdate.findOne({ isActive: true })
      .populate('author', 'name')
      .sort({ timestamp: -1 })
      .select('_id title description content timestamp priority tags');
    
    if (update) {
      res.json(update);
    } else {
      res.status(200).json(null); // Return null if no updates found
    }
  } catch (error) {
    console.error('Error fetching latest website update:', error);
    res.status(500).json({ error: 'Failed to fetch website update' });
  }
});

module.exports = router;