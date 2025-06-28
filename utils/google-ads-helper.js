const googleAdsConfig = require('../config/google-ads');

class GoogleAdsHelper {
  /**
   * Check if ads should be displayed for the current user and page
   * @param {Object} req - Express request object
   * @param {string} pagePath - Current page path
   * @returns {boolean} - Whether ads should be shown
   */
  static shouldShowAds(req, pagePath) {
    const { placementRules } = googleAdsConfig;
    
    // Check if page is in disabled list
    if (placementRules.disabledPages.some(path => pagePath.startsWith(path))) {
      return false;
    }
    
    // Check if page is in enabled list (if specified)
    if (placementRules.enabledPages.length > 0) {
      const isEnabledPage = placementRules.enabledPages.some(path => 
        pagePath === path || pagePath.startsWith(path + '/')
      );
      if (!isEnabledPage) {
        return false;
      }
    }
    
    // Check user type
    const user = req.session.user;
    if (user) {
      const userType = user.role || 'user';
      if (placementRules.disabledUserTypes.includes(userType)) {
        return false;
      }
    } else {
      // Guest user
      if (!placementRules.enabledUserTypes.includes('guest')) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get ad configuration for a specific slot
   * @param {string} slotName - Name of the ad slot
   * @returns {Object|null} - Ad configuration or null if not found
   */
  static getAdConfig(slotName) {
    return googleAdsConfig.adSlots[slotName] || null;
  }
  
  /**
   * Get all available ad slots
   * @returns {Object} - All ad slot configurations
   */
  static getAllAdSlots() {
    return googleAdsConfig.adSlots;
  }
  
  /**
   * Generate ad data for EJS template
   * @param {string} slotName - Name of the ad slot
   * @param {Object} options - Additional options
   * @returns {Object} - Ad data for template
   */
  static generateAdData(slotName, options = {}) {
    const config = this.getAdConfig(slotName);
    if (!config) {
      console.warn(`Ad slot '${slotName}' not found in configuration`);
      return null;
    }
    
    return {
      slot: config.slot,
      format: config.format,
      style: config.style,
      responsive: config.responsive,
      className: options.className || 'my-4',
      ...options
    };
  }
  
  /**
   * Get ads for a specific page type
   * @param {string} pageType - Type of page (home, content, shop, etc.)
   * @returns {Array} - Array of ad configurations for the page
   */
  static getAdsForPage(pageType) {
    const pageAds = {
      home: ['homePageBanner', 'homePageSidebar'],
      content: ['contentPageTop', 'contentPageBottom'],
      shop: ['shopPageBanner', 'productPageSidebar'],
      concerts: ['concertListBanner', 'concertDetailsSidebar'],
      artists: ['artistListBanner', 'artistProfileSidebar']
    };
    
    const adSlots = pageAds[pageType] || [];
    return adSlots.map(slot => this.generateAdData(slot)).filter(Boolean);
  }
  
  /**
   * Check if device is mobile
   * @param {Object} req - Express request object
   * @returns {boolean} - Whether device is mobile
   */
  static isMobileDevice(req) {
    const userAgent = req.headers['user-agent'] || '';
    return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  }
  
  /**
   * Get appropriate ad for device type
   * @param {Object} req - Express request object
   * @param {string} desktopSlot - Desktop ad slot name
   * @param {string} mobileSlot - Mobile ad slot name
   * @returns {Object|null} - Ad configuration
   */
  static getResponsiveAd(req, desktopSlot, mobileSlot) {
    const isMobile = this.isMobileDevice(req);
    const slotName = isMobile ? mobileSlot : desktopSlot;
    return this.generateAdData(slotName);
  }
  
  /**
   * Middleware to add ad helper to response locals
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  static middleware(req, res, next) {
    res.locals.googleAds = {
      shouldShow: GoogleAdsHelper.shouldShowAds(req, req.path),
      getAd: (slotName, options) => GoogleAdsHelper.generateAdData(slotName, options),
      getPageAds: (pageType) => GoogleAdsHelper.getAdsForPage(pageType),
      getResponsiveAd: (desktopSlot, mobileSlot) => 
        GoogleAdsHelper.getResponsiveAd(req, desktopSlot, mobileSlot),
      config: googleAdsConfig
    };
    next();
  }
  
  /**
   * Generate tracking data for analytics
   * @param {string} slotName - Ad slot name
   * @param {Object} req - Express request object
   * @returns {Object} - Tracking data
   */
  static generateTrackingData(slotName, req) {
    const user = req.session.user;
    return {
      slot: slotName,
      userType: user ? user.role : 'guest',
      pageType: req.path.split('/')[1] || 'home',
      deviceType: this.isMobileDevice(req) ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = GoogleAdsHelper;
