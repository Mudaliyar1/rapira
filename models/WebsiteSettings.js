const mongoose = require('mongoose');

const WebsiteSettingsSchema = new mongoose.Schema({
  // Header/Branding Settings
  headerSettings: {
    brandType: {
      type: String,
      enum: ['text', 'logo', 'both'],
      default: 'text'
    },
    brandText: {
      type: String,
      default: 'RAPIRA'
    },
    logoUrl: {
      type: String,
      default: ''
    },
    logoMedia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media'
    },
    logoHeight: {
      type: Number,
      default: 45
    },
    showBrandText: {
      type: Boolean,
      default: true
    }
  },

  // Navigation Menu Settings - Simple object structure
  menuSettings: {
    discoverMenu: {
      enabled: { type: Boolean, default: true },
      items: { type: Object, default: {} }
    },
    servicesMenu: {
      enabled: { type: Boolean, default: true },
      items: { type: Object, default: {} }
    },
    shopMenu: {
      enabled: { type: Boolean, default: true },
      items: { type: Object, default: {} }
    },
    helpSupportMenu: {
      enabled: { type: Boolean, default: true },
      items: { type: Object, default: {} }
    }
  },

  // General Website Settings
  siteSettings: {
    siteName: {
      type: String,
      default: 'Rapira - Indian Rap Music Platform'
    },
    siteDescription: {
      type: String,
      default: 'The ultimate platform for Indian rap artists and fans to connect, discover, and experience the best of hip-hop culture.'
    },
    favicon: {
      type: String,
      default: '/images/favicon.ico'
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    maintenanceReason: {
      type: String,
      default: 'We are currently performing scheduled maintenance to improve your experience.'
    },
    maintenanceStartTime: {
      type: Date
    },
    maintenanceEndTime: {
      type: Date
    },
    maintenanceDays: {
      type: Number,
      default: 0
    },
    maintenanceHours: {
      type: Number,
      default: 0
    },
    maintenanceMinutes: {
      type: Number,
      default: 0
    },
    maintenanceSeconds: {
      type: Number,
      default: 0
    },
    maintenanceAutoStart: {
      type: Boolean,
      default: true
    },
    // Page locking settings
    lockedPages: {
      type: Map,
      of: {
        isLocked: { type: Boolean, default: false },
        reason: { type: String, default: 'This page is temporarily unavailable due to maintenance.' },
        lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lockedAt: { type: Date },
        unlockAt: { type: Date }
      },
      default: new Map()
    }
  },

  // Admin Development Settings
  adminSettings: {
    showDummyData: {
      type: Boolean,
      default: false
    },
    dummyDataCount: {
      type: Number,
      default: 10,
      min: 5,
      max: 50
    }
  },

  // Theme Settings
  themeSettings: {
    primaryColor: {
      type: String,
      default: '#6f42c1'
    },
    secondaryColor: {
      type: String,
      default: '#e91e63'
    },
    accentColor: {
      type: String,
      default: '#ff9800'
    }
  },

  // Venue Management Settings
  venueSettings: {
    defaultCommissionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 10
    },
    allowUserCommissionEdit: {
      type: Boolean,
      default: false
    },
    minimumVenueRate: {
      type: Number,
      min: 0,
      default: 500
    },
    requireAdminApproval: {
      type: Boolean,
      default: true
    }
  },

  // Last updated info
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  // Ensure only one settings document exists
  collection: 'websitesettings'
});

// Static method to get or create settings
WebsiteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('WebsiteSettings', WebsiteSettingsSchema);
