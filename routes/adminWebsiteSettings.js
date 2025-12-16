const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const WebsiteSettings = require('../models/WebsiteSettings');
const Media = require('../models/Media');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { getMenuConfiguration, getAllRoutes } = require('../utils/routeDiscovery');
const { clearSettingsCache } = require('../middleware/websiteSettings');

// Configure multer for logo uploads (memory → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
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

    // Handle logo upload (Cloudinary)
    if (req.file) {
      try {
        if (settings.headerSettings.logoMedia) {
          const prev = await Media.findById(settings.headerSettings.logoMedia);
          await deleteMedia(prev);
        }

        const { media } = await uploadFileToCloudinary(req.file, {
          module: 'adminBranding',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: 'rapira/admin/branding'
        });

        settings.headerSettings.logoMedia = media._id;
        settings.headerSettings.logoUrl = media.secure_url;
      } catch (err) {
        console.error('Cloud upload failed (logo):', err);
        req.flash('error', 'Logo upload failed');
        return res.redirect('/admin/website-settings');
      }
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
    const { siteName, siteDescription, maintenanceMode, maintenanceReason, maintenanceDays, maintenanceHours, maintenanceMinutes, maintenanceSeconds, maintenanceAutoStart } = req.body;

    settings.siteSettings.siteName = siteName || 'Rapira - Indian Rap Music Platform';
    settings.siteSettings.siteDescription = siteDescription || 'The ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.';
    settings.siteSettings.maintenanceMode = maintenanceMode === 'on';
    settings.siteSettings.maintenanceReason = maintenanceReason || 'We are currently performing scheduled maintenance to improve your experience.';
    
    // Handle duration fields and convert large values appropriately
    let totalSeconds = 0;
    
    // Convert all inputs to seconds and sum them up
    totalSeconds += (parseInt(maintenanceDays) || 0) * 24 * 60 * 60;
    totalSeconds += (parseInt(maintenanceHours) || 0) * 60 * 60;
    totalSeconds += (parseInt(maintenanceMinutes) || 0) * 60;
    totalSeconds += parseInt(maintenanceSeconds) || 0;
    
    // Convert total seconds back to days, hours, minutes, seconds for storage
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    
    settings.siteSettings.maintenanceDays = days;
    settings.siteSettings.maintenanceHours = hours;
    settings.siteSettings.maintenanceMinutes = minutes;
    settings.siteSettings.maintenanceSeconds = seconds;
    settings.siteSettings.maintenanceAutoStart = maintenanceAutoStart === 'on';
    
    // Calculate start and end times based on duration if maintenance is enabled
    if (maintenanceMode === 'on') {
      const startTime = maintenanceAutoStart === 'on' ? new Date() : new Date(Date.now() + 5000); // Start in 5 seconds or now
      const durationMs = totalSeconds * 1000; // Convert to milliseconds
      const endTime = new Date(startTime.getTime() + durationMs);
      
      settings.siteSettings.maintenanceStartTime = startTime;
      settings.siteSettings.maintenanceEndTime = endTime;
    } else {
      // Clear times when maintenance is disabled
      settings.siteSettings.maintenanceStartTime = null;
      settings.siteSettings.maintenanceEndTime = null;
    }

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

// POST /admin/website-settings/venue - Update venue settings
router.post('/venue', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { defaultCommissionPercentage, minimumVenueRate, requireAdminApproval, allowUserCommissionEdit } = req.body;

    const settings = await WebsiteSettings.getSettings();
    
    // Initialize venueSettings if it doesn't exist
    if (!settings.venueSettings) {
      settings.venueSettings = {};
    }

    // Update venue settings
    settings.venueSettings.defaultCommissionPercentage = parseFloat(defaultCommissionPercentage) || 10;
    settings.venueSettings.minimumVenueRate = parseInt(minimumVenueRate) || 500;
    settings.venueSettings.requireAdminApproval = requireAdminApproval === 'on';
    settings.venueSettings.allowUserCommissionEdit = allowUserCommissionEdit === 'on';
    
    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    req.flash('success', 'Venue settings updated successfully!');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating venue settings:', error);
    req.flash('error', 'Failed to update venue settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Lock a specific page
router.post('/lock-page', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { pagePath, lockReason, lockDuration } = req.body;
    const settings = await WebsiteSettings.getSettings();
    
    // Initialize lockedPages if it doesn't exist
    if (!settings.siteSettings.lockedPages) {
      settings.siteSettings.lockedPages = new Map();
    }
    
    // Calculate unlock time if duration is provided
    let unlockAt = null;
    if (lockDuration && lockDuration > 0) {
      unlockAt = new Date(Date.now() + (lockDuration * 60 * 1000)); // Convert minutes to milliseconds
    }
    
    // Create or update page lock
    settings.siteSettings.lockedPages.set(pagePath, {
      isLocked: true,
      reason: lockReason || 'This page is temporarily unavailable due to maintenance.',
      lockedBy: req.session.user.id,
      lockedAt: new Date(),
      unlockAt: unlockAt
    });
    
    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();
    
    // Clear cache to force reload of settings
    clearSettingsCache();
    
    req.flash('success', `Page ${pagePath} has been locked successfully.`);
    res.redirect('/admin/website-settings#page-lock');
  } catch (error) {
    console.error('Error locking page:', error);
    req.flash('error', 'Failed to lock page');
    res.redirect('/admin/website-settings#page-lock');
  }
});

// POST - Unlock a specific page
router.post('/unlock-page', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { pagePath } = req.body;
    const settings = await WebsiteSettings.getSettings();
    
    // Remove page lock if it exists
    if (settings.siteSettings.lockedPages && settings.siteSettings.lockedPages.has(pagePath)) {
      settings.siteSettings.lockedPages.delete(pagePath);
      
      settings.lastUpdatedBy = req.session.user.id;
      await settings.save();
      
      // Clear cache to force reload of settings
      clearSettingsCache();
      
      req.flash('success', `Page ${pagePath} has been unlocked successfully.`);
    } else {
      req.flash('warning', `Page ${pagePath} is not currently locked.`);
    }
    
    res.redirect('/admin/website-settings#page-lock');
  } catch (error) {
    console.error('Error unlocking page:', error);
    req.flash('error', 'Failed to unlock page');
    res.redirect('/admin/website-settings#page-lock');
  }
});

module.exports = router;
