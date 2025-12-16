const WebsiteSettings = require('../models/WebsiteSettings');
const { getNavbarMenuSettings } = require('../utils/routeDiscovery');

// Cache for website settings to avoid database calls on every request
let settingsCache = null;
let lastCacheUpdate = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Periodically check for expired maintenance mode
setInterval(async () => {
  try {
    // Only check if we have cached settings and maintenance is enabled
    if (settingsCache && settingsCache.siteSettings.maintenanceMode) {
      const now = new Date();
      if (settingsCache.siteSettings.maintenanceEndTime && now > settingsCache.siteSettings.maintenanceEndTime) {
        // Maintenance has expired, automatically disable it
        const settings = await WebsiteSettings.getSettings();
        if (settings.siteSettings.maintenanceMode) {
          settings.siteSettings.maintenanceMode = false;
          settings.siteSettings.maintenanceStartTime = null;
          settings.siteSettings.maintenanceEndTime = null;
          await settings.save();
          console.log('Maintenance mode automatically disabled due to expiration (background check)');
          clearSettingsCache(); // Clear cache to reflect changes
        }
      }
    }
  } catch (error) {
    console.error('Error in background maintenance check:', error);
  }
}, 60 * 1000); // Check every minute



/**
 * Middleware to load website settings and make them available to all views
 */
const loadWebsiteSettings = async (req, res, next) => {
  try {
    // Check if we need to refresh the cache
    const now = Date.now();
    if (!settingsCache || !lastCacheUpdate || (now - lastCacheUpdate) > CACHE_DURATION) {
      settingsCache = await WebsiteSettings.getSettings();
      lastCacheUpdate = now;
    }

    // Make settings available to all views
    res.locals.websiteSettings = settingsCache;
    
    // Also make individual settings easily accessible
    res.locals.siteSettings = settingsCache.siteSettings;
    res.locals.headerSettings = settingsCache.headerSettings;
    res.locals.menuSettings = getNavbarMenuSettings(settingsCache.menuSettings);
    res.locals.themeSettings = settingsCache.themeSettings;

    // Check maintenance mode
    if (settingsCache.siteSettings.maintenanceMode) {
      // Check if maintenance has expired
      const now = new Date();
      if (settingsCache.siteSettings.maintenanceEndTime && now > settingsCache.siteSettings.maintenanceEndTime) {
        // Maintenance has expired, automatically disable it
        settingsCache.siteSettings.maintenanceMode = false;
        settingsCache.siteSettings.maintenanceStartTime = null;
        settingsCache.siteSettings.maintenanceEndTime = null;
        
        // Save the updated settings
        try {
          await settingsCache.save();
          console.log('Maintenance mode automatically disabled due to expiration');
          clearSettingsCache(); // Clear cache to reflect changes
        } catch (saveError) {
          console.error('Error saving maintenance mode disable:', saveError);
        }
      } else {
        // Maintenance is still active, check user access
        if (!req.session.user || req.session.user.role !== 'admin') {
          // Allow access to maintenance login endpoint
          if (req.path === '/auth/maintenance-login') {
            return next();
          }

          return res.render('maintenance', {
            layout: false,
            siteName: settingsCache.siteSettings.siteName,
            maintenanceReason: settingsCache.siteSettings.maintenanceReason,
            maintenanceStartTime: settingsCache.siteSettings.maintenanceStartTime,
            maintenanceEndTime: settingsCache.siteSettings.maintenanceEndTime
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('Error loading website settings:', error);
    // Continue with default settings if there's an error
    res.locals.websiteSettings = {
      headerSettings: {
        brandType: 'text',
        brandText: 'RAPIRA',
        logoUrl: '',
        logoHeight: 45,
        showBrandText: true
      },
      menuSettings: {
        discoverMenu: {
          enabled: true,
          items: {
            home: true,
            contentLibrary: true,
            concerts: true,
            dailyConcerts: true,
            artists: true
          }
        },
        servicesMenu: {
          enabled: true,
          items: {
            teamRequirement: true,
            findMyArtist: true,
            subscriptions: true
          }
        },
        helpSupportMenu: {
          enabled: true,
          items: {
            demo: true,
            contact: true,
            termsOfService: true,
            privacyPolicy: true,
            refundPolicy: true,
            subscriptionPolicy: true
          }
        }
      },
      siteSettings: {
        siteName: 'Rapira - Indian Rap Music Platform',
        siteDescription: 'The ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.',
        favicon: '/images/favicon.ico',
        maintenanceMode: false,
        maintenanceReason: 'We are currently performing scheduled maintenance to improve your experience.',
        maintenanceStartTime: null,
        maintenanceEndTime: null
      },
      themeSettings: {
        primaryColor: '#6f42c1',
        secondaryColor: '#e91e63',
        accentColor: '#ff9800'
      },
      adminSettings: {
        showDummyData: false,
        dummyDataCount: 10
      }
    };
    
    // Make individual settings available with defaults
    res.locals.siteSettings = res.locals.websiteSettings.siteSettings;
    res.locals.headerSettings = res.locals.websiteSettings.headerSettings;
    res.locals.menuSettings = res.locals.websiteSettings.menuSettings;
    res.locals.themeSettings = res.locals.websiteSettings.themeSettings;
    
    next();
  }
};

/**
 * Function to clear the settings cache (call this when settings are updated)
 */
const clearSettingsCache = () => {
  settingsCache = null;
  lastCacheUpdate = null;
};

/**
 * Function to force refresh settings cache
 */
const refreshSettingsCache = async () => {
  try {
    settingsCache = await WebsiteSettings.getSettings();
    lastCacheUpdate = Date.now();
    return settingsCache;
  } catch (error) {
    console.error('Error refreshing settings cache:', error);
    return null;
  }
};

module.exports = {
  loadWebsiteSettings,
  clearSettingsCache,
  refreshSettingsCache
};
