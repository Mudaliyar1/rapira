const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const WebsiteSettings = require('../models/WebsiteSettings');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { clearSettingsCache } = require('../middleware/websiteSettings');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/images/branding/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// GET - Test Settings (for debugging)
router.get('/test', async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Website Settings Page
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    
    res.render('admin/website-settings', {
      layout: 'admin',
      title: 'Website Settings',
      currentPath: '/admin/website-settings',
      settings,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading website settings:', error);
    req.flash('error', 'Failed to load website settings');
    res.redirect('/admin');
  }
});

// POST - Update Header Settings
router.post('/header', isLoggedIn, isAdmin, upload.single('logo'), async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const { brandType, brandText, logoHeight, showBrandText } = req.body;

    // Update header settings
    settings.headerSettings.brandType = brandType;
    settings.headerSettings.brandText = brandText || 'RAPIRA';
    settings.headerSettings.logoHeight = parseInt(logoHeight) || 45;
    settings.headerSettings.showBrandText = showBrandText === 'on';

    // Handle logo upload
    if (req.file) {
      // Delete old logo if exists
      if (settings.headerSettings.logoUrl && settings.headerSettings.logoUrl.startsWith('/images/branding/')) {
        const oldLogoPath = path.join(__dirname, '..', 'public', settings.headerSettings.logoUrl);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      settings.headerSettings.logoUrl = '/images/branding/' + req.file.filename;
    }

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache to force reload of settings
    clearSettingsCache();

    req.flash('success', 'Header settings updated successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating header settings:', error);
    req.flash('error', 'Failed to update header settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Update Menu Settings
router.post('/menu', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const menuData = req.body;

    // Update discover menu
    settings.menuSettings.discoverMenu.enabled = menuData.discoverMenuEnabled === 'on';
    settings.menuSettings.discoverMenu.items.home = menuData.discoverHome === 'on';
    settings.menuSettings.discoverMenu.items.contentLibrary = menuData.discoverContentLibrary === 'on';
    settings.menuSettings.discoverMenu.items.concerts = menuData.discoverConcerts === 'on';
    settings.menuSettings.discoverMenu.items.dailyConcerts = menuData.discoverDailyConcerts === 'on';
    settings.menuSettings.discoverMenu.items.artists = menuData.discoverArtists === 'on';

    // Update services menu
    settings.menuSettings.servicesMenu.enabled = menuData.servicesMenuEnabled === 'on';
    settings.menuSettings.servicesMenu.items.teamRequirement = menuData.servicesTeamRequirement === 'on';
    settings.menuSettings.servicesMenu.items.findMyArtist = menuData.servicesFindMyArtist === 'on';
    settings.menuSettings.servicesMenu.items.subscriptions = menuData.servicesSubscriptions === 'on';

    // Update help & support menu
    settings.menuSettings.helpSupportMenu.enabled = menuData.helpSupportMenuEnabled === 'on';
    settings.menuSettings.helpSupportMenu.items.demo = menuData.helpSupportDemo === 'on';
    settings.menuSettings.helpSupportMenu.items.contact = menuData.helpSupportContact === 'on';
    settings.menuSettings.helpSupportMenu.items.termsOfService = menuData.helpSupportTerms === 'on';
    settings.menuSettings.helpSupportMenu.items.privacyPolicy = menuData.helpSupportPrivacy === 'on';
    settings.menuSettings.helpSupportMenu.items.refundPolicy = menuData.helpSupportRefund === 'on';
    settings.menuSettings.helpSupportMenu.items.subscriptionPolicy = menuData.helpSupportSubscriptionPolicy === 'on';

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache to force reload of settings
    clearSettingsCache();

    req.flash('success', 'Menu settings updated successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating menu settings:', error);
    req.flash('error', 'Failed to update menu settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Update Site Settings
router.post('/site', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const { siteName, siteDescription, maintenanceMode } = req.body;

    settings.siteSettings.siteName = siteName || 'Rapira - Indian Rap Music Platform';
    settings.siteSettings.siteDescription = siteDescription || 'The ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.';
    settings.siteSettings.maintenanceMode = maintenanceMode === 'on';

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache to force reload of settings
    clearSettingsCache();

    req.flash('success', 'Site settings updated successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating site settings:', error);
    req.flash('error', 'Failed to update site settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Reset Theme Settings to Default
router.post('/theme/reset', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();

    // Reset to default theme colors
    settings.themeSettings.primaryColor = '#6f42c1';
    settings.themeSettings.secondaryColor = '#e91e63';
    settings.themeSettings.accentColor = '#ff9800';

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache to force reload of settings
    clearSettingsCache();

    req.flash('success', 'Theme colors reset to default successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error resetting theme settings:', error);
    req.flash('error', 'Failed to reset theme settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Update Theme Settings
router.post('/theme', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const { primaryColor, secondaryColor, accentColor } = req.body;

    settings.themeSettings.primaryColor = primaryColor || '#6f42c1';
    settings.themeSettings.secondaryColor = secondaryColor || '#e91e63';
    settings.themeSettings.accentColor = accentColor || '#ff9800';

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache to force reload of settings
    clearSettingsCache();

    req.flash('success', 'Theme settings updated successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating theme settings:', error);
    req.flash('error', 'Failed to update theme settings');
    res.redirect('/admin/website-settings');
  }
});

// DELETE - Remove Logo
router.delete('/logo', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    
    // Delete logo file if exists
    if (settings.headerSettings.logoUrl && settings.headerSettings.logoUrl.startsWith('/images/branding/')) {
      const logoPath = path.join(__dirname, '..', 'public', settings.headerSettings.logoUrl);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    settings.headerSettings.logoUrl = '';
    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    res.json({ success: true, message: 'Logo removed successfully' });
  } catch (error) {
    console.error('Error removing logo:', error);
    res.status(500).json({ success: false, message: 'Failed to remove logo' });
  }
});

module.exports = router;
