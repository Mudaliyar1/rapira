const WebsiteSettings = require('../models/WebsiteSettings');
const { getNavbarMenuSettings } = require('../utils/routeDiscovery');

// Cache for website settings to avoid database calls on every request
let settingsCache = null;
let lastCacheUpdate = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes



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
    res.locals.heroCarouselSettings = settingsCache.heroCarouselSettings;

    // Check maintenance mode
    if (settingsCache.isMaintenanceActive()) {
      // Auto-disable maintenance if expired
      if (settingsCache.isMaintenanceExpired()) {
        settingsCache.siteSettings.maintenanceMode = false;
        settingsCache.siteSettings.maintenanceStartTime = null;
        await settingsCache.save();
        
        // Refresh the cache
        await refreshSettingsCache();
        
        // Continue with normal flow since maintenance is now disabled
        return next();
      }
      
      // Allow admins and superAdmins to access during maintenance
      if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'superAdmin')) {
        // Allow access to maintenance login endpoint
        if (req.path === '/auth/maintenance-login') {
          return next();
        }

        return res.render('maintenance', {
          layout: false,
          siteName: settingsCache.siteSettings.siteName,
          maintenanceReason: settingsCache.siteSettings.maintenanceReason,
          maintenanceStartTime: settingsCache.siteSettings.maintenanceStartTime,
          maintenanceDuration: settingsCache.siteSettings.maintenanceDuration,
          maintenanceEndTime: settingsCache.getMaintenanceEndTime()
        });
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
        maintenanceMode: false
      },
      themeSettings: {
        primaryColor: '#6f42c1',
        secondaryColor: '#e91e63',
        accentColor: '#ff9800'
      },
      heroCarouselSettings: {
        autoplay: true,
        intervalMs: 5000,
        slides: []
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
    res.locals.heroCarouselSettings = res.locals.websiteSettings.heroCarouselSettings;
    
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
