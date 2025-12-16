require('dotenv').config();
const mongoose = require('mongoose');
const WebsiteSettings = require('../models/WebsiteSettings');

async function initializeWebsiteSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Check if settings already exist
    let settings = await WebsiteSettings.findOne();
    
    if (!settings) {
      // Create default settings
      settings = new WebsiteSettings({
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
              about: true,
              content: true,
              concerts: true,
              daily_concerts: true,
              artists: true,
              learning: true
            }
          },
          servicesMenu: {
            enabled: true,
            items: {
              team_requirement: true,
              find_my_artist: true,
              subscriptions: true
            }
          },
          shopMenu: {
            enabled: true,
            items: {
              shop: true,
              my_orders: true
            }
          },
          helpSupportMenu: {
            enabled: true,
            items: {
              demo: true,
              contact: true,
              terms_of_service: true,
              privacy_policy: true,
              refund_policy: true,
              subscription_policy: true,
              shopping_policy: true
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
          maintenanceEndTime: null,
          maintenanceDays: 0,
          maintenanceHours: 0,
          maintenanceMinutes: 0,
          maintenanceSeconds: 0,
          maintenanceAutoStart: true
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
      });

      await settings.save();
      console.log('Default website settings created successfully');
    } else {
      console.log('Website settings already exist');
    }

    console.log('Current settings:', JSON.stringify(settings, null, 2));
    
  } catch (error) {
    console.error('Error initializing website settings:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the initialization
initializeWebsiteSettings();
