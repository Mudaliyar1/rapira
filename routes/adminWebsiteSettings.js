const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const WebsiteSettings = require('../models/WebsiteSettings');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { getMenuConfiguration, getAllRoutes } = require('../utils/routeDiscovery');
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
    const menuConfiguration = await getMenuConfiguration();
    const allRoutes = await getAllRoutes();

    // Initialize menu items if they don't exist
    if (!settings.menuSettings.discoverMenu.items) settings.menuSettings.discoverMenu.items = {};
    if (!settings.menuSettings.servicesMenu.items) settings.menuSettings.servicesMenu.items = {};
    if (!settings.menuSettings.shopMenu.items) settings.menuSettings.shopMenu.items = {};
    if (!settings.menuSettings.helpSupportMenu.items) settings.menuSettings.helpSupportMenu.items = {};

    // Initialize all route items with default values if they don't exist
    Object.keys(allRoutes.discover).forEach(key => {
      if (settings.menuSettings.discoverMenu.items[key] === undefined) {
        settings.menuSettings.discoverMenu.items[key] = true;
      }
    });

    Object.keys(allRoutes.services).forEach(key => {
      if (settings.menuSettings.servicesMenu.items[key] === undefined) {
        settings.menuSettings.servicesMenu.items[key] = true;
      }
    });

    Object.keys(allRoutes.shop).forEach(key => {
      if (settings.menuSettings.shopMenu.items[key] === undefined) {
        settings.menuSettings.shopMenu.items[key] = true;
      }
    });

    Object.keys(allRoutes.help).forEach(key => {
      if (settings.menuSettings.helpSupportMenu.items[key] === undefined) {
        settings.menuSettings.helpSupportMenu.items[key] = true;
      }
    });

    // Save the updated settings
    await settings.save();

    res.render('admin/website-settings', {
      layout: 'admin',
      title: 'Website Settings',
      currentPath: '/admin/website-settings',
      settings,
      menuConfiguration,
      allRoutes,
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
    const formData = req.body;
    const allRoutes = await getAllRoutes();

    console.log('=== MENU UPDATE DEBUG ===');
    console.log('Form data received:', formData);

    // Update menu enabled states
    settings.menuSettings.discoverMenu.enabled = formData.discoverMenuEnabled === 'on';
    settings.menuSettings.servicesMenu.enabled = formData.servicesMenuEnabled === 'on';
    settings.menuSettings.shopMenu.enabled = formData.shopMenuEnabled === 'on';
    settings.menuSettings.helpSupportMenu.enabled = formData.helpSupportMenuEnabled === 'on';

    // Initialize menu items objects
    settings.menuSettings.discoverMenu.items = {};
    settings.menuSettings.servicesMenu.items = {};
    settings.menuSettings.shopMenu.items = {};
    settings.menuSettings.helpSupportMenu.items = {};

    // Process discover menu items
    Object.keys(allRoutes.discover).forEach(key => {
      const isEnabled = formData[key] === 'on';
      settings.menuSettings.discoverMenu.items[key] = isEnabled;
      console.log(`Discover ${key}: ${isEnabled}`);
    });

    // Process services menu items
    Object.keys(allRoutes.services).forEach(key => {
      const isEnabled = formData[key] === 'on';
      settings.menuSettings.servicesMenu.items[key] = isEnabled;
      console.log(`Services ${key}: ${isEnabled}`);
    });

    // Process shop menu items
    Object.keys(allRoutes.shop).forEach(key => {
      const isEnabled = formData[key] === 'on';
      settings.menuSettings.shopMenu.items[key] = isEnabled;
      console.log(`Shop ${key}: ${isEnabled}`);
    });

    // Process help menu items
    Object.keys(allRoutes.help).forEach(key => {
      const isEnabled = formData[key] === 'on';
      settings.menuSettings.helpSupportMenu.items[key] = isEnabled;
      console.log(`Help ${key}: ${isEnabled}`);
    });

    // Save settings
    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache
    clearSettingsCache();

    console.log('Final menu settings:', {
      discover: settings.menuSettings.discoverMenu.items,
      services: settings.menuSettings.servicesMenu.items,
      shop: settings.menuSettings.shopMenu.items,
      help: settings.menuSettings.helpSupportMenu.items
    });
    console.log('=== END DEBUG ===');

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

// POST - Update Admin Settings
router.post('/admin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const { showDummyData, dummyDataCount } = req.body;

    // Initialize adminSettings if it doesn't exist
    if (!settings.adminSettings) {
      settings.adminSettings = {};
    }

    settings.adminSettings.showDummyData = showDummyData === 'on';
    settings.adminSettings.dummyDataCount = parseInt(dummyDataCount) || 10;

    // Validate dummy data count
    if (settings.adminSettings.dummyDataCount < 5) {
      settings.adminSettings.dummyDataCount = 5;
    } else if (settings.adminSettings.dummyDataCount > 50) {
      settings.adminSettings.dummyDataCount = 50;
    }

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    // Clear cache to force reload of settings
    clearSettingsCache();

    req.flash('success', 'Admin settings updated successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating admin settings:', error);
    req.flash('error', 'Failed to update admin settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Preview Dummy Data
router.post('/preview-dummy-data', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { count } = req.body;
    const DummyDataGenerator = require('../utils/dummyDataGenerator');
    const generator = new DummyDataGenerator();

    const dummyCount = Math.min(Math.max(parseInt(count) || 10, 5), 50);
    const preview = generator.generateAllDummyData(dummyCount);

    res.json({
      success: true,
      preview: {
        users: preview.users.slice(0, 5),
        artists: preview.artists.slice(0, 5),
        concerts: preview.concerts.slice(0, 5),
        content: preview.content.slice(0, 5),
        tickets: preview.tickets.slice(0, 5),
        subscriptions: preview.subscriptions.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Error generating dummy data preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate dummy data preview'
    });
  }
});

// Debug route to check menu settings
router.get('/debug-menu', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const allRoutes = await getAllRoutes();
    const { getNavbarMenuSettings } = require('../utils/routeDiscovery');

    res.json({
      rawMenuSettings: settings.menuSettings,
      allRoutes: allRoutes,
      navbarMenuSettings: getNavbarMenuSettings(settings.menuSettings),
      sampleFormData: {
        discoverMenuEnabled: 'on',
        content: 'on',
        shop: 'on',
        daily_concerts: 'on'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test route to manually set a menu item
router.post('/test-menu-item', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { key, enabled, category } = req.body;
    const settings = await WebsiteSettings.getSettings();

    // Initialize if needed
    if (!settings.menuSettings[category]) {
      settings.menuSettings[category] = { enabled: true, items: {} };
    }
    if (!settings.menuSettings[category].items) {
      settings.menuSettings[category].items = {};
    }

    // Set the specific item
    settings.menuSettings[category].items[key] = enabled === 'true';

    await settings.save();
    clearSettingsCache();

    res.json({
      success: true,
      message: `Set ${key} in ${category} to ${enabled}`,
      currentValue: settings.menuSettings[category].items[key]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
