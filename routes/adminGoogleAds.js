const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const GoogleAdsSettings = require('../models/GoogleAdsSettings');

// Apply authentication middleware to all routes
router.use(isLoggedIn);
router.use(isAdmin);

// Google Ads Settings Page
router.get('/', async (req, res) => {
  try {
    const settings = await GoogleAdsSettings.getSettings();
    
    res.render('admin/google-ads', {
      title: 'Google Ads Management',
      settings,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Google Ads settings error:', error);
    req.flash('error', 'Failed to load Google Ads settings');
    res.redirect('/admin');
  }
});

// Update Google Ads Settings
router.post('/update', async (req, res) => {
  try {
    const settings = await GoogleAdsSettings.getSettings();
    
    // Update basic settings
    settings.adsEnabled = req.body.adsEnabled === 'on';
    settings.publisherId = req.body.publisherId || settings.publisherId;
    
    // Update placement rules
    if (req.body.enabledPages) {
      settings.placementRules.enabledPages = Array.isArray(req.body.enabledPages) 
        ? req.body.enabledPages 
        : [req.body.enabledPages];
    }
    
    if (req.body.disabledPages) {
      settings.placementRules.disabledPages = Array.isArray(req.body.disabledPages) 
        ? req.body.disabledPages 
        : [req.body.disabledPages];
    }
    
    if (req.body.enabledUserTypes) {
      settings.placementRules.enabledUserTypes = Array.isArray(req.body.enabledUserTypes) 
        ? req.body.enabledUserTypes 
        : [req.body.enabledUserTypes];
    }
    
    if (req.body.disabledUserTypes) {
      settings.placementRules.disabledUserTypes = Array.isArray(req.body.disabledUserTypes) 
        ? req.body.disabledUserTypes 
        : [req.body.disabledUserTypes];
    }
    
    settings.placementRules.maxAdsPerPage = parseInt(req.body.maxAdsPerPage) || 3;
    settings.placementRules.minContentLength = parseInt(req.body.minContentLength) || 500;
    
    // Update tracking settings
    settings.tracking.enabled = req.body.trackingEnabled === 'on';
    
    await settings.save();
    
    req.flash('success', 'Google Ads settings updated successfully');
    res.redirect('/admin/google-ads');
  } catch (error) {
    console.error('Update Google Ads settings error:', error);
    req.flash('error', 'Failed to update Google Ads settings');
    res.redirect('/admin/google-ads');
  }
});

// Update Ad Slot
router.post('/slot/:slotName', async (req, res) => {
  try {
    const { slotName } = req.params;
    const settings = await GoogleAdsSettings.getSettings();
    
    if (!settings.adSlots[slotName]) {
      req.flash('error', 'Ad slot not found');
      return res.redirect('/admin/google-ads');
    }
    
    // Update ad slot data
    const slotData = {
      enabled: req.body.enabled === 'on',
      slot: req.body.slot || settings.adSlots[slotName].slot,
      format: req.body.format || settings.adSlots[slotName].format,
      style: req.body.style || settings.adSlots[slotName].style,
      responsive: req.body.responsive === 'on'
    };
    
    settings.updateAdSlot(slotName, slotData);
    await settings.save();
    
    req.flash('success', `Ad slot '${slotName}' updated successfully`);
    res.redirect('/admin/google-ads');
  } catch (error) {
    console.error('Update ad slot error:', error);
    req.flash('error', 'Failed to update ad slot');
    res.redirect('/admin/google-ads');
  }
});

// Toggle Ad Slot
router.post('/slot/:slotName/toggle', async (req, res) => {
  try {
    const { slotName } = req.params;
    const settings = await GoogleAdsSettings.getSettings();
    
    if (!settings.adSlots[slotName]) {
      return res.status(404).json({ error: 'Ad slot not found' });
    }
    
    settings.toggleAdSlot(slotName);
    await settings.save();
    
    res.json({ 
      success: true, 
      enabled: settings.adSlots[slotName].enabled,
      message: `Ad slot '${slotName}' ${settings.adSlots[slotName].enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Toggle ad slot error:', error);
    res.status(500).json({ error: 'Failed to toggle ad slot' });
  }
});

// Get Ad Performance Statistics
router.get('/stats', async (req, res) => {
  try {
    const settings = await GoogleAdsSettings.getSettings();
    
    // Calculate performance metrics
    const stats = {
      totalImpressions: settings.statistics.totalImpressions,
      totalClicks: settings.statistics.totalClicks,
      clickThroughRate: settings.statistics.totalImpressions > 0 
        ? ((settings.statistics.totalClicks / settings.statistics.totalImpressions) * 100).toFixed(2)
        : 0,
      revenue: settings.statistics.revenue,
      averageRPM: settings.statistics.totalImpressions > 0 
        ? ((settings.statistics.revenue / settings.statistics.totalImpressions) * 1000).toFixed(2)
        : 0,
      enabledSlots: Object.keys(settings.adSlots).filter(slot => settings.adSlots[slot].enabled).length,
      totalSlots: Object.keys(settings.adSlots).length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get ad stats error:', error);
    res.status(500).json({ error: 'Failed to get ad statistics' });
  }
});

// Reset Ad Statistics
router.post('/stats/reset', async (req, res) => {
  try {
    const settings = await GoogleAdsSettings.getSettings();
    
    settings.statistics = {
      totalImpressions: 0,
      totalClicks: 0,
      revenue: 0,
      lastUpdated: new Date()
    };
    
    await settings.save();
    
    req.flash('success', 'Ad statistics reset successfully');
    res.redirect('/admin/google-ads');
  } catch (error) {
    console.error('Reset ad stats error:', error);
    req.flash('error', 'Failed to reset ad statistics');
    res.redirect('/admin/google-ads');
  }
});

// Test Ad Configuration
router.get('/test/:slotName', async (req, res) => {
  try {
    const { slotName } = req.params;
    const settings = await GoogleAdsSettings.getSettings();
    
    if (!settings.adSlots[slotName]) {
      return res.status(404).json({ error: 'Ad slot not found' });
    }
    
    const adConfig = settings.adSlots[slotName];
    
    res.render('admin/google-ads-test', {
      title: `Test Ad Slot: ${slotName}`,
      slotName,
      adConfig,
      publisherId: settings.publisherId,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Test ad slot error:', error);
    req.flash('error', 'Failed to load ad test page');
    res.redirect('/admin/google-ads');
  }
});

module.exports = router;
