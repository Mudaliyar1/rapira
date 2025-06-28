// Google Ads Configuration
// This file contains ad slot configurations for different page types

const googleAdsConfig = {
  // Your Google AdSense Publisher ID
  publisherId: 'ca-pub-7790730667146180',
  
  // Ad Slots Configuration
  adSlots: {
    // Home Page Ads
    homePageBanner: {
      slot: '1234567890', // Replace with actual slot ID from AdSense
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Banner ad on home page'
    },
    
    homePageSidebar: {
      slot: '1234567891', // Replace with actual slot ID
      format: 'rectangle',
      style: 'display:block; width: 300px; height: 250px;',
      responsive: false,
      description: 'Sidebar ad on home page'
    },
    
    // Content Pages Ads
    contentPageTop: {
      slot: '1234567892', // Replace with actual slot ID
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Top banner on content pages'
    },
    
    contentPageBottom: {
      slot: '1234567893', // Replace with actual slot ID
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Bottom banner on content pages'
    },
    
    // Shop Pages Ads
    shopPageBanner: {
      slot: '1234567894', // Replace with actual slot ID
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Banner ad on shop pages'
    },
    
    productPageSidebar: {
      slot: '1234567895', // Replace with actual slot ID
      format: 'rectangle',
      style: 'display:block; width: 300px; height: 250px;',
      responsive: false,
      description: 'Sidebar ad on product pages'
    },
    
    // Concert Pages Ads
    concertListBanner: {
      slot: '1234567896', // Replace with actual slot ID
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Banner ad on concert listing page'
    },
    
    concertDetailsSidebar: {
      slot: '1234567897', // Replace with actual slot ID
      format: 'rectangle',
      style: 'display:block; width: 300px; height: 250px;',
      responsive: false,
      description: 'Sidebar ad on concert details page'
    },
    
    // Artist Pages Ads
    artistListBanner: {
      slot: '1234567898', // Replace with actual slot ID
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Banner ad on artist listing page'
    },
    
    artistProfileSidebar: {
      slot: '1234567899', // Replace with actual slot ID
      format: 'rectangle',
      style: 'display:block; width: 300px; height: 250px;',
      responsive: false,
      description: 'Sidebar ad on artist profile page'
    },
    
    // Mobile Specific Ads
    mobileInFeed: {
      slot: '1234567800', // Replace with actual slot ID
      format: 'fluid',
      style: 'display:block',
      responsive: true,
      description: 'In-feed ad for mobile devices'
    },
    
    mobileBanner: {
      slot: '1234567801', // Replace with actual slot ID
      format: 'auto',
      style: 'display:block',
      responsive: true,
      description: 'Mobile banner ad'
    }
  },
  
  // Ad Placement Rules
  placementRules: {
    // Pages where ads should be shown
    enabledPages: [
      '/',           // Home page
      '/content',    // Content library
      '/concerts',   // Concerts
      '/artists',    // Artists
      '/shop',       // Shop
      '/about',      // About page
      '/contact'     // Contact page
    ],
    
    // Pages where ads should NOT be shown
    disabledPages: [
      '/admin',      // Admin pages
      '/auth',       // Authentication pages
      '/payment',    // Payment pages
      '/checkout'    // Checkout pages
    ],
    
    // User types that should see ads
    enabledUserTypes: ['guest', 'user'],
    
    // User types that should NOT see ads (premium users, etc.)
    disabledUserTypes: ['premium', 'admin'],
    
    // Maximum ads per page
    maxAdsPerPage: 3,
    
    // Minimum content length before showing ads
    minContentLength: 500
  },
  
  // Ad Performance Tracking
  tracking: {
    enabled: true,
    events: ['impression', 'click', 'viewability'],
    customDimensions: {
      userType: 'dimension1',
      pageType: 'dimension2',
      deviceType: 'dimension3'
    }
  }
};

module.exports = googleAdsConfig;
