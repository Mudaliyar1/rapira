const mongoose = require('mongoose');

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
      default: 'Scheduled maintenance in progress'
    },
    maintenanceStartTime: {
      type: Date,
      default: null
    },
    maintenanceDuration: {
      type: Number, // duration in minutes
      default: 60 // default 1 hour
    },
    maintenanceAutoStart: {
      type: Boolean,
      default: false
    },
    enableButtonSounds: {
      type: Boolean,
      default: true
    },
    activeTheme: {
      type: String,
      default: '',
      enum: ['', 'winter', 'summer', 'rainy', 'newyear', 'christmas', 'spring', 'autumn', 'halloween']
    }
  },

  // Home Hero Carousel Settings
  heroCarouselSettings: {
    autoplay: {
      type: Boolean,
      default: true
    },
    intervalMs: {
      type: Number,
      default: 5000,
      min: 2000,
      max: 20000
    },
    slides: {
      type: [
        {
          title: { type: String, default: '' },
          description: { type: String, default: '' },
          badge: { type: String, default: '' },
          dateText: { type: String, default: '' },
          buttonText: { type: String, default: '' },
          linkUrl: { type: String, default: '/' },
          imageUrl: { type: String, default: '' },
          imageMedia: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
          isActive: { type: Boolean, default: true }
        }
      ],
      default: getDefaultHeroCarouselSlides
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

  // Ticket Commission Settings
  ticketCommissionSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },

  // Producer Beat Commission Settings
  producerBeatCommissionSettings: {
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 4
    }
  },

  // Registration Fee Settings
  registrationFees: {
    artistRegistrationFee: {
      type: Number,
      min: 0,
      default: 0
    },
    producerRegistrationFee: {
      type: Number,
      min: 0,
      default: 0
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
WebsiteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Instance method to calculate maintenance end time
WebsiteSettingsSchema.methods.getMaintenanceEndTime = function () {
  if (!this.siteSettings.maintenanceMode || !this.siteSettings.maintenanceStartTime) {
    return null;
  }

  const startTime = new Date(this.siteSettings.maintenanceStartTime);
  const durationInMinutes = this.siteSettings.maintenanceDuration || 60; // default to 60 minutes

  // Add duration in minutes to start time
  const endTime = new Date(startTime.getTime() + (durationInMinutes * 60000));
  return endTime;
};

// Instance method to check if maintenance mode is expired
WebsiteSettingsSchema.methods.isMaintenanceExpired = function () {
  const endTime = this.getMaintenanceEndTime();
  if (!endTime) {
    return false;
  }

  return new Date() > endTime;
};

// Instance method to check if maintenance mode is active
WebsiteSettingsSchema.methods.isMaintenanceActive = function () {
  if (!this.siteSettings.maintenanceMode) {
    return false;
  }

  if (this.isMaintenanceExpired()) {
    return false;
  }

  return true;
};

module.exports = mongoose.model('WebsiteSettings', WebsiteSettingsSchema);
