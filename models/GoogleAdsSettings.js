const mongoose = require('mongoose');

const googleAdsSettingsSchema = new mongoose.Schema({
  // Google AdSense Configuration
  publisherId: {
    type: String,
    required: true,
    default: 'ca-pub-7790730667146180'
  },
  
  // Global Ad Settings
  adsEnabled: {
    type: Boolean,
    default: true
  },
  
  // Ad Slots Configuration
  adSlots: {
    // Home Page Ads
    homePageBanner: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567890' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    homePageSidebar: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567891' },
      format: { type: String, default: 'rectangle' },
      style: { type: String, default: 'display:block; width: 300px; height: 250px;' },
      responsive: { type: Boolean, default: false }
    },
    
    // Content Pages
    contentPageTop: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567892' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    contentPageBottom: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567893' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    // Shop Pages
    shopPageBanner: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567894' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    productPageSidebar: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567895' },
      format: { type: String, default: 'rectangle' },
      style: { type: String, default: 'display:block; width: 300px; height: 250px;' },
      responsive: { type: Boolean, default: false }
    },
    
    // Concert Pages
    concertListBanner: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567896' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    concertDetailsSidebar: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567897' },
      format: { type: String, default: 'rectangle' },
      style: { type: String, default: 'display:block; width: 300px; height: 250px;' },
      responsive: { type: Boolean, default: false }
    },
    
    // Artist Pages
    artistListBanner: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567898' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    artistProfileSidebar: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567899' },
      format: { type: String, default: 'rectangle' },
      style: { type: String, default: 'display:block; width: 300px; height: 250px;' },
      responsive: { type: Boolean, default: false }
    },
    
    // Mobile Ads
    mobileInFeed: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567800' },
      format: { type: String, default: 'fluid' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    },
    
    mobileBanner: {
      enabled: { type: Boolean, default: true },
      slot: { type: String, default: '1234567801' },
      format: { type: String, default: 'auto' },
      style: { type: String, default: 'display:block' },
      responsive: { type: Boolean, default: true }
    }
  },
  
  // Placement Rules
  placementRules: {
    enabledPages: [{
      type: String
    }],
    disabledPages: [{
      type: String
    }],
    enabledUserTypes: [{
      type: String,
      enum: ['guest', 'user', 'artist', 'admin', 'premium']
    }],
    disabledUserTypes: [{
      type: String,
      enum: ['guest', 'user', 'artist', 'admin', 'premium']
    }],
    maxAdsPerPage: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    },
    minContentLength: {
      type: Number,
      default: 500
    }
  },
  
  // Performance Tracking
  tracking: {
    enabled: { type: Boolean, default: true },
    events: [{
      type: String,
      enum: ['impression', 'click', 'viewability']
    }]
  },
  
  // Statistics
  statistics: {
    totalImpressions: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Static method to get or create settings
googleAdsSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this({
      placementRules: {
        enabledPages: ['/', '/content', '/concerts', '/artists', '/shop', '/about', '/contact'],
        disabledPages: ['/admin', '/auth', '/payment', '/checkout'],
        enabledUserTypes: ['guest', 'user'],
        disabledUserTypes: ['premium', 'admin']
      },
      tracking: {
        events: ['impression', 'click', 'viewability']
      }
    });
    await settings.save();
  }
  return settings;
};

// Method to update ad slot
googleAdsSettingsSchema.methods.updateAdSlot = function(slotName, slotData) {
  if (this.adSlots[slotName]) {
    Object.assign(this.adSlots[slotName], slotData);
    this.markModified(`adSlots.${slotName}`);
  }
};

// Method to toggle ad slot
googleAdsSettingsSchema.methods.toggleAdSlot = function(slotName) {
  if (this.adSlots[slotName]) {
    this.adSlots[slotName].enabled = !this.adSlots[slotName].enabled;
    this.markModified(`adSlots.${slotName}`);
  }
};

module.exports = mongoose.model('GoogleAdsSettings', googleAdsSettingsSchema);
