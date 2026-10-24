const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const WebsiteSettings = require('../models/WebsiteSettings');
const Media = require('../models/Media');
const ArtistPost = require('../models/ArtistPost');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const { getMenuConfiguration, getAllRoutes } = require('../utils/routeDiscovery');
const { clearSettingsCache } = require('../middleware/websiteSettings');
const { clearEmailLinksCache } = require('../utils/emailService');
const { clearBrevoEmailLinksCache } = require('../utils/brevoEmailService');

const getDefaultHeroCarouselSlides = () => {
  const currentYear = new Date().getFullYear();
  return [
    {
      title: 'Experience the Best of Indian Rap',
      description: 'Discover artists, book concerts, and connect with the hip-hop community',
      badge: 'LIVE CULTURE',
      dateText: `${currentYear} • RAPIRA`,
      buttonText: 'Explore Concerts',
      linkUrl: '/concerts',
      imageUrl: 'https://images.unsplash.com/photo-1571266028243-100ffcfb6f4f?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    },
    {
      title: `Summer Rap Festival ${currentYear}`,
      description: 'Join the biggest hip-hop event of the year with top artists performing live!',
      badge: 'FEATURED EVENT',
      dateText: `June 15-17, ${currentYear}`,
      buttonText: 'Book Now',
      linkUrl: '/concerts',
      imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    },
    {
      title: 'Go Premium',
      description: 'Get exclusive access to VIP tickets, backstage passes, and special discounts!',
      badge: 'NEW FEATURE',
      dateText: `Premium Access • ${currentYear}`,
      buttonText: 'Upgrade Now',
      linkUrl: '/subscriptions',
      imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    },
    {
      title: 'Become a Featured Artist',
      description: 'Showcase your talent and reach thousands of fans on our platform!',
      badge: 'ARTIST SPOTLIGHT',
      dateText: `Applications Open • ${currentYear}`,
      buttonText: 'Join as Artist',
      linkUrl: '/artists/register',
      imageUrl: 'https://images.unsplash.com/photo-1521335629791-ce4aec67dd53?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    },
    {
      title: 'Reels-Ready Cypher Nights',
      description: 'Shoot viral moments, tag your crew, and perform in camera-first live sessions.',
      badge: 'TRENDING NOW',
      dateText: `Friday Nights • ${currentYear}`,
      buttonText: 'See Lineup',
      linkUrl: '/concerts',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    },
    {
      title: 'Streetwear Drop Live',
      description: 'Limited-edition rap merch drops with creator collabs and early access.',
      badge: 'LIMITED DROP',
      dateText: `Fresh Drop • ${currentYear}`,
      buttonText: 'Shop Drop',
      linkUrl: '/shop',
      imageUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    },
    {
      title: 'Creator Collab Rooms',
      description: 'Match with rappers, producers, and videographers to create your next hit.',
      badge: 'FOR CREATORS',
      dateText: `Collab Season • ${currentYear}`,
      buttonText: 'Start Collab',
      linkUrl: '/find-my-artist',
      imageUrl: 'https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=1600&q=80',
      isActive: true
    }
  ];
};

const appendCuratedSlidesIfMissing = (settings) => {
  if (!settings.heroCarouselSettings) return false;
  if (!Array.isArray(settings.heroCarouselSettings.slides)) {
    settings.heroCarouselSettings.slides = [];
  }

  const existingTitleSet = new Set(
    settings.heroCarouselSettings.slides
      .map((slide) => (slide?.title || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const curatedSlides = getDefaultHeroCarouselSlides();
  let changed = false;

  curatedSlides.forEach((slide) => {
    const key = (slide.title || '').trim().toLowerCase();
    if (key && !existingTitleSet.has(key)) {
      settings.heroCarouselSettings.slides.push(slide);
      existingTitleSet.add(key);
      changed = true;
    }
  });

  return changed;
};

const toArray = (value) => (Array.isArray(value) ? value : (value !== undefined ? [value] : []));

const normalizeLinkUrl = (value) => {
  const input = (value || '').trim();
  if (!input) return '/';
  if (input.startsWith('/')) return input;
  if (/^https?:\/\//i.test(input)) return input;
  return `/${input}`;
};

const normalizeViewsLabel = (value) => {
  const input = String(value || '').trim().replace(/\s+/g, '');
  if (!input) return '';

  const match = input.match(/^(\d+(?:\.\d+)?)([kKmMbBtT]?)$/);
  if (!match) return '';

  const numberPart = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();

  if (!Number.isFinite(numberPart) || numberPart < 0) {
    return '';
  }

  const multiplierMap = {
    '': 1,
    K: 1e3,
    M: 1e6,
    B: 1e9,
    T: 1e12
  };

  const absoluteViews = numberPart * (multiplierMap[suffix] || 1);

  const formatCompact = (num) => {
    if (!Number.isFinite(num)) return '';
    const rounded = Number(num.toFixed(2));
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  if (absoluteViews >= 1e12) {
    return `${formatCompact(absoluteViews / 1e12)}T`;
  }
  if (absoluteViews >= 1e9) {
    return `${formatCompact(absoluteViews / 1e9)}B`;
  }
  if (absoluteViews >= 1e6) {
    return `${formatCompact(absoluteViews / 1e6)}M`;
  }
  if (absoluteViews >= 1e3) {
    return `${formatCompact(absoluteViews / 1e3)}K`;
  }

  return formatCompact(absoluteViews);
};

const normalizeCountLabel = (value) => normalizeViewsLabel(value);

const extractPostIdFromLink = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  if (/^[a-f\d]{24}$/i.test(input)) {
    return input;
  }

  // Accept any URL/text containing one or more ObjectIds.
  // If artistId and postId both exist in a link, the last one is usually postId.
  const fromAnyText = (text) => {
    const matches = String(text || '').match(/[a-f\d]{24}/ig);
    if (!matches || matches.length === 0) return '';
    return matches[matches.length - 1];
  };

  const fromRaw = fromAnyText(input);
  if (fromRaw) return fromRaw;

  const fromPath = (pathValue) => {
    const match = String(pathValue || '').match(/([a-f\d]{24})(?=\/|$|\?|#)/i);
    return match ? match[1] : '';
  };

  try {
    const parsed = new URL(input, process.env.BASE_URL || 'http://localhost:3000');
    const fromQuery = parsed.searchParams.get('postId') || parsed.searchParams.get('id') || '';
    if (/^[a-f\d]{24}$/i.test(fromQuery)) {
      return fromQuery;
    }
    return fromAnyText(`${parsed.pathname}${parsed.search}${parsed.hash}`) || fromPath(parsed.pathname);
  } catch (_) {
    return fromAnyText(input) || fromPath(input);
  }
};

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
router.get('/', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const menuConfiguration = await getMenuConfiguration();
    const allRoutes = await getAllRoutes();

    // Helper function to format duration in human-readable format
    const formatDuration = (minutes) => {
      if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else if (minutes < 1440) {  // Less than a day
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
        if (remainingMinutes > 0) {
          result += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        }
        return result;
      } else {
        const days = Math.floor(minutes / 1440);
        const remainingHours = Math.floor((minutes % 1440) / 60);
        let result = `${days} day${days !== 1 ? 's' : ''}`;
        if (remainingHours > 0) {
          result += ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
        }
        return result;
      }
    };

    // Initialize menu items if they don't exist
    if (!settings.menuSettings.discoverMenu.items) settings.menuSettings.discoverMenu.items = {};
    if (!settings.menuSettings.servicesMenu.items) settings.menuSettings.servicesMenu.items = {};
    if (!settings.menuSettings.shopMenu.items) settings.menuSettings.shopMenu.items = {};
    if (!settings.menuSettings.helpSupportMenu.items) settings.menuSettings.helpSupportMenu.items = {};

    if (!settings.heroCarouselSettings) {
      settings.heroCarouselSettings = {
        autoplay: true,
        intervalMs: 5000,
        slides: getDefaultHeroCarouselSlides()
      };
      await settings.save();
    }

    // Ensure slides array exists (but don't auto-populate if empty)
    if (!settings.heroCarouselSettings.slides) {
      settings.heroCarouselSettings.slides = [];
    }

    // Remove stale View Increaser entries for posts that no longer exist.
    if (!settings.viewIncreaser) settings.viewIncreaser = { entries: [] };
    if (!Array.isArray(settings.viewIncreaser.entries)) settings.viewIncreaser.entries = [];
    if (settings.viewIncreaser.entries.length > 0) {
      const mappedPostIds = settings.viewIncreaser.entries
        .map(entry => (entry && entry.postId ? String(entry.postId) : ''))
        .filter(Boolean);

      if (mappedPostIds.length > 0) {
        const existingPosts = await ArtistPost.find({ _id: { $in: mappedPostIds } }).select('_id').lean();
        const existingSet = new Set(existingPosts.map(post => String(post._id)));
        const filteredEntries = settings.viewIncreaser.entries.filter(entry => {
          const id = entry && entry.postId ? String(entry.postId) : '';
          return id && existingSet.has(id);
        });

        if (filteredEntries.length !== settings.viewIncreaser.entries.length) {
          settings.viewIncreaser.entries = filteredEntries;
        }
      }
    }

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

    // Save the updated settings if any were modified
    if (settings.isModified()) {
      await settings.save();
    }

    res.render('admin/website-settings', {
      layout: 'admin',
      title: 'Website Settings',
      currentPath: '/admin/website-settings',
      settings,
      menuConfiguration,
      allRoutes,
      formatDuration,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading website settings:', error);
    req.flash('error', 'Failed to load website settings');
    res.redirect('/admin');
  }
});

// POST - Update Home Hero Carousel Settings
router.post('/carousel', isLoggedIn, hasAdminPermission('manage_website_settings'), upload.any(), async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();

    if (!settings.heroCarouselSettings) {
      settings.heroCarouselSettings = { autoplay: true, intervalMs: 5000, slides: [] };
    }

    const existingTitles = toArray(req.body.existingTitle);
    const existingDescriptions = toArray(req.body.existingDescription);
    const existingBadges = toArray(req.body.existingBadge);
    const existingDateTexts = toArray(req.body.existingDateText);
    const existingButtonTexts = toArray(req.body.existingButtonText);
    const existingLinkUrls = toArray(req.body.existingLinkUrl);
    const existingImageUrls = toArray(req.body.existingImageUrl);
    const existingImageMediaIds = toArray(req.body.existingImageMediaId);
    const existingIsActiveValues = toArray(req.body.existingIsActive);
    const removeSlideIndices = new Set(toArray(req.body.removeSlideIndices).map(value => parseInt(value, 10)));

    const maxLength = Math.max(
      existingTitles.length,
      existingDescriptions.length,
      existingBadges.length,
      existingDateTexts.length,
      existingButtonTexts.length,
      existingLinkUrls.length,
      existingImageUrls.length,
      existingImageMediaIds.length
    );

    const updatedSlides = [];
    const uploadedFiles = req.files || [];

    for (let index = 0; index < maxLength; index += 1) {
      if (removeSlideIndices.has(index)) {
        const mediaId = existingImageMediaIds[index];
        if (mediaId) {
          const mediaDoc = await Media.findById(mediaId);
          await deleteMedia(mediaDoc);
        }
        continue;
      }

      let imageUrl = (existingImageUrls[index] || '').trim();
      let imageMediaId = existingImageMediaIds[index] || null;

      const replacementFile = uploadedFiles.find(file => file.fieldname === `existingSlideImage_${index}`);
      if (replacementFile) {
        if (imageMediaId) {
          const previousMediaDoc = await Media.findById(imageMediaId);
          await deleteMedia(previousMediaDoc);
        }

        const { media } = await uploadFileToCloudinary(replacementFile, {
          module: 'homeHeroCarousel',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: 'rapira/admin/home-hero-carousel'
        });

        imageUrl = media.secure_url;
        imageMediaId = media._id;
      }

      if (!imageUrl) {
        continue;
      }

      updatedSlides.push({
        title: (existingTitles[index] || '').trim(),
        description: (existingDescriptions[index] || '').trim(),
        badge: (existingBadges[index] || '').trim(),
        dateText: (existingDateTexts[index] || '').trim(),
        buttonText: (existingButtonTexts[index] || '').trim(),
        linkUrl: normalizeLinkUrl(existingLinkUrls[index]),
        imageUrl,
        imageMedia: imageMediaId,
        isActive: existingIsActiveValues.includes(String(index))
      });
    }

    const newSlideFile = uploadedFiles.find(file => file.fieldname === 'newSlideImage');
    if (newSlideFile) {
      const { media } = await uploadFileToCloudinary(newSlideFile, {
        module: 'homeHeroCarousel',
        ownerType: 'admin',
        ownerId: req.session?.user?.id,
        folder: 'rapira/admin/home-hero-carousel'
      });

      updatedSlides.push({
        title: (req.body.newTitle || '').trim(),
        description: (req.body.newDescription || '').trim(),
        badge: (req.body.newBadge || '').trim(),
        dateText: (req.body.newDateText || '').trim(),
        buttonText: (req.body.newButtonText || '').trim(),
        linkUrl: normalizeLinkUrl(req.body.newLinkUrl),
        imageUrl: media.secure_url,
        imageMedia: media._id,
        isActive: true
      });
    }

    settings.heroCarouselSettings.autoplay = req.body.autoplay === 'on';
    settings.heroCarouselSettings.intervalMs = Math.min(Math.max(parseInt(req.body.intervalMs, 10) || 5000, 2000), 20000);
    settings.heroCarouselSettings.slides = updatedSlides;
    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    clearSettingsCache();
    req.flash('success', 'Hero carousel settings updated successfully');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating hero carousel settings:', error);
    req.flash('error', 'Failed to update hero carousel settings');
    res.redirect('/admin/website-settings');
  }
});

// POST - Update Header Settings
router.post('/header', isLoggedIn, hasAdminPermission('manage_website_settings'), upload.single('logo'), async (req, res) => {
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
router.post('/menu', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.post('/site', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const { siteName, siteDescription, maintenanceMode, maintenanceReason, maintenanceDuration, maintenanceAutoStart, enableButtonSounds, activeTheme } = req.body;

    settings.siteSettings.siteName = siteName || 'Rapira - Indian Rap Music Platform';
    settings.siteSettings.siteDescription = siteDescription || 'The ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.';

    // Handle maintenance mode
    if (maintenanceMode === 'on') {
      // Enable maintenance mode
      settings.siteSettings.maintenanceMode = true;
      settings.siteSettings.maintenanceReason = maintenanceReason || 'Scheduled maintenance in progress';
      settings.siteSettings.maintenanceStartTime = new Date();

      // Validate maintenance duration (1 minute to 1 day)
      let duration = parseInt(maintenanceDuration) || 60;
      duration = Math.max(1, Math.min(1440, duration)); // Clamp between 1 minute and 1440 minutes (1 day)
      settings.siteSettings.maintenanceDuration = duration;

      settings.siteSettings.maintenanceAutoStart = maintenanceAutoStart === 'on';
    } else {
      // Disable maintenance mode
      settings.siteSettings.maintenanceMode = false;
      settings.siteSettings.maintenanceStartTime = null;
    }

    // Update button sounds setting
    settings.siteSettings.enableButtonSounds = enableButtonSounds === 'on';

    // Update active theme setting
    settings.siteSettings.activeTheme = activeTheme || '';

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

// POST - Update Theme Settings (Seasonal Themes)
router.post('/theme-seasonal', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    const { activeTheme } = req.body;

    // Update active theme setting
    settings.siteSettings.activeTheme = activeTheme || '';

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

// POST - Reset Theme Settings to Default
router.post('/theme/reset', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.post('/theme', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.delete('/logo', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.post('/admin', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.post('/preview-dummy-data', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.get('/debug-menu', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.post('/test-menu-item', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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
router.post('/venue', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
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

// POST /admin/website-settings/ticket-commission - Update ticket commission settings
router.post('/ticket-commission', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    const { ticketCommissionEnabled, ticketCommissionPercentage } = req.body;

    const settings = await WebsiteSettings.getSettings();

    // Initialize ticketCommissionSettings if it doesn't exist
    if (!settings.ticketCommissionSettings) {
      settings.ticketCommissionSettings = {};
    }

    // Update ticket commission settings
    settings.ticketCommissionSettings.enabled = ticketCommissionEnabled === 'on';
    settings.ticketCommissionSettings.percentage = parseFloat(ticketCommissionPercentage) || 0;

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    req.flash('success', 'Ticket commission settings updated successfully!');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating ticket commission settings:', error);
    req.flash('error', 'Failed to update ticket commission settings');
    res.redirect('/admin/website-settings');
  }
});

// POST /admin/website-settings/producer-beat-commission - Update producer beat commission settings
router.post('/producer-beat-commission', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { producerBeatCommissionPercentage } = req.body;

    const settings = await WebsiteSettings.getSettings();

    // Initialize producerBeatCommissionSettings if it doesn't exist
    if (!settings.producerBeatCommissionSettings) {
      settings.producerBeatCommissionSettings = {};
    }

    // Update producer beat commission settings
    settings.producerBeatCommissionSettings.percentage = parseFloat(producerBeatCommissionPercentage) || 0;

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    req.flash('success', 'Producer beat commission settings updated successfully!');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating producer beat commission settings:', error);
    req.flash('error', 'Failed to update producer beat commission settings');
    res.redirect('/admin/website-settings');
  }
});

// POST /admin/website-settings/registration-fees - Update registration fees
router.post('/registration-fees', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const {
      artistRegistrationFee,
      producerRegistrationFee,
      distributorRegistrationFee,
      distributorCommission
    } = req.body;
    const settings = await WebsiteSettings.getSettings();

    if (!settings.registrationFees) settings.registrationFees = {};
    if (!settings.distributorCommissionSettings) settings.distributorCommissionSettings = {};

    settings.registrationFees.artistRegistrationFee = parseFloat(artistRegistrationFee) || 0;
    settings.registrationFees.producerRegistrationFee = parseFloat(producerRegistrationFee) || 0;
    settings.registrationFees.distributorRegistrationFee = parseFloat(distributorRegistrationFee) || 0;

    settings.distributorCommissionSettings.percentage = parseFloat(distributorCommission) || 0;

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();

    clearSettingsCache();

    req.flash('success', 'Registration fees updated successfully!');
    res.redirect('/admin/website-settings');
  } catch (error) {
    console.error('Error updating registration fees:', error);
    req.flash('error', 'Failed to update registration fees');
    res.redirect('/admin/website-settings');
  }
});

// POST /admin/website-settings/email-links - Update email button link overrides
router.post('/email-links', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    const {
      baseDomain, loginUrl, accountReactivationUrl, artistDashboardUrl, artistApplicationReviewUrl,
      concertViewUrl, ticketViewUrl, subscriptionViewUrl, refundViewUrl,
      learningUrl, teamReviewUrl, termsUrl, privacyUrl
    } = req.body;

    const settings = await WebsiteSettings.getSettings();
    if (!settings.emailLinks) settings.emailLinks = {};

    const trimOrEmpty = v => (v || '').trim();
    settings.emailLinks.baseDomain               = trimOrEmpty(baseDomain);
    settings.emailLinks.loginUrl                  = trimOrEmpty(loginUrl);
    settings.emailLinks.accountReactivationUrl    = trimOrEmpty(accountReactivationUrl);
    settings.emailLinks.artistDashboardUrl        = trimOrEmpty(artistDashboardUrl);
    settings.emailLinks.artistApplicationReviewUrl = trimOrEmpty(artistApplicationReviewUrl);
    settings.emailLinks.concertViewUrl            = trimOrEmpty(concertViewUrl);
    settings.emailLinks.ticketViewUrl             = trimOrEmpty(ticketViewUrl);
    settings.emailLinks.subscriptionViewUrl       = trimOrEmpty(subscriptionViewUrl);
    settings.emailLinks.refundViewUrl             = trimOrEmpty(refundViewUrl);
    settings.emailLinks.learningUrl               = trimOrEmpty(learningUrl);
    settings.emailLinks.teamReviewUrl             = trimOrEmpty(teamReviewUrl);
    settings.emailLinks.termsUrl                  = trimOrEmpty(termsUrl);
    settings.emailLinks.privacyUrl                = trimOrEmpty(privacyUrl);

    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();
    clearSettingsCache();
    clearEmailLinksCache();
    clearBrevoEmailLinksCache();

    req.flash('success', 'Email link overrides saved successfully!');
    res.redirect('/admin/website-settings#email-links');
  } catch (error) {
    console.error('Error updating email links:', error);
    req.flash('error', 'Failed to save email link overrides');
    res.redirect('/admin/website-settings');
  }
});

// POST /admin/website-settings/view-increaser - Update fake view labels for artist posts
router.post('/view-increaser', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    if (!settings.viewIncreaser) settings.viewIncreaser = { entries: [] };

    const links = toArray(req.body.postLink);
    const rowPostIds = toArray(req.body.rowPostId);
    const labels = toArray(req.body.viewsLabel);
    const likesLabels = toArray(req.body.likesLabel);
    const maxLen = Math.max(links.length, labels.length, likesLabels.length, rowPostIds.length);

    const incomingEntries = [];
    const invalidRows = [];
    let hasNonEmptyRow = false;

    for (let i = 0; i < maxLen; i += 1) {
      const postLink = String(links[i] || '').trim();
      const explicitPostId = String(rowPostIds[i] || '').trim();
      const rawLabel = String(labels[i] || '').trim();
      const rawLikesLabel = String(likesLabels[i] || '').trim();

      if (!postLink && !rawLabel && !rawLikesLabel && !explicitPostId) {
        continue;
      }

      hasNonEmptyRow = true;

      const postId = /^[a-f\d]{24}$/i.test(explicitPostId)
        ? explicitPostId
        : extractPostIdFromLink(postLink);
      const viewsLabel = normalizeViewsLabel(rawLabel);
      const fakeLikesLabel = normalizeCountLabel(rawLikesLabel);

      if (!postId || !viewsLabel) {
        invalidRows.push(i + 1);
        continue;
      }

      const postExists = await ArtistPost.exists({ _id: postId });
      if (!postExists) {
        invalidRows.push(i + 1);
        continue;
      }

      incomingEntries.push({
        postId,
        postLink,
        viewsLabel,
        fakeLikesLabel,
        updatedAt: new Date()
      });
    }

    // Keep only one entry per post (latest one in form wins)
    const dedupedMap = new Map();
    incomingEntries.forEach(entry => {
      dedupedMap.set(String(entry.postId), entry);
    });
    const dedupedEntries = Array.from(dedupedMap.values());

    // If admin submitted data but none of the rows are valid, do not erase existing settings.
    if (hasNonEmptyRow && dedupedEntries.length === 0) {
      req.flash('error', 'No valid rows were found. Nothing was changed. Please check post link and view format.');
      return res.redirect('/admin/website-settings#view-increaser');
    }

    const previousPostIds = new Set(
      (settings.viewIncreaser.entries || [])
        .map(entry => (entry && entry.postId ? String(entry.postId) : ''))
        .filter(Boolean)
    );
    const nextPostIds = new Set(dedupedEntries.map(entry => String(entry.postId)));

    const removedPostIds = Array.from(previousPostIds).filter(id => !nextPostIds.has(id));

    // Clear removed fake labels
    if (removedPostIds.length > 0) {
      await ArtistPost.updateMany(
        { _id: { $in: removedPostIds } },
        { $unset: { fakeViewsLabel: '', fakeLikesLabel: '' } }
      );
    }

    // Apply latest fake labels
    for (const entry of dedupedEntries) {
      await ArtistPost.findByIdAndUpdate(entry.postId, {
        fakeViewsLabel: entry.viewsLabel,
        fakeLikesLabel: entry.fakeLikesLabel || ''
      });
    }

    settings.viewIncreaser.entries = dedupedEntries;
    settings.lastUpdatedBy = req.session.user.id;
    await settings.save();
    clearSettingsCache();

    if (invalidRows.length > 0) {
      req.flash('error', `Some rows were skipped due to invalid post link or view format: ${invalidRows.join(', ')}`);
    }

    req.flash('success', 'View increaser settings saved successfully!');
    res.redirect('/admin/website-settings#view-increaser');
  } catch (error) {
    console.error('Error updating view increaser settings:', error);
    req.flash('error', 'Failed to save view increaser settings');
    res.redirect('/admin/website-settings#view-increaser');
  }
});

module.exports = router;
