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
    logoHeight: {
      type: Number,
      default: 45
    },
    showBrandText: {
      type: Boolean,
      default: true
    }
  },

  // Navigation Menu Settings
  menuSettings: {
    discoverMenu: {
      enabled: { type: Boolean, default: true },
      items: {
        home: { type: Boolean, default: true },
        contentLibrary: { type: Boolean, default: true },
        concerts: { type: Boolean, default: true },
        dailyConcerts: { type: Boolean, default: true },
        artists: { type: Boolean, default: true }
      }
    },
    servicesMenu: {
      enabled: { type: Boolean, default: true },
      items: {
        teamRequirement: { type: Boolean, default: true },
        findMyArtist: { type: Boolean, default: true },
        subscriptions: { type: Boolean, default: true }
      }
    },
    helpSupportMenu: {
      enabled: { type: Boolean, default: true },
      items: {
        demo: { type: Boolean, default: true },
        contact: { type: Boolean, default: true },
        termsOfService: { type: Boolean, default: true },
        privacyPolicy: { type: Boolean, default: true },
        refundPolicy: { type: Boolean, default: true },
        subscriptionPolicy: { type: Boolean, default: true }
      }
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
