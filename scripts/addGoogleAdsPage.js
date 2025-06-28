require('dotenv').config();
const mongoose = require('mongoose');
const AdminPage = require('../models/AdminPage');
const GoogleAdsSettings = require('../models/GoogleAdsSettings');

async function addGoogleAdsPage() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Check if Google Ads admin page already exists
    const existingPage = await AdminPage.findOne({ slug: 'google-ads' });
    
    if (existingPage) {
      console.log('Google Ads admin page already exists');
      console.log('Existing page:', existingPage);
    } else {
      // Create the Google Ads admin page
      const googleAdsPage = new AdminPage({
        name: 'Google Ads',
        slug: 'google-ads',
        description: 'Manage Google AdSense advertisements and revenue',
        path: '/admin/google-ads',
        icon: 'bi-badge-ad',
        category: 'system',
        displayOrder: 10,
        isActive: true,
        alwaysAccessible: false,
        superAdminOnly: false
      });
      
      await googleAdsPage.save();
      console.log('Google Ads admin page created successfully');
      console.log('New page:', googleAdsPage);
    }
    
    // Initialize Google Ads settings if they don't exist
    const existingSettings = await GoogleAdsSettings.findOne();
    
    if (existingSettings) {
      console.log('Google Ads settings already exist');
    } else {
      // Create default Google Ads settings
      const defaultSettings = new GoogleAdsSettings({
        publisherId: 'ca-pub-7790730667146180',
        adsEnabled: true,
        placementRules: {
          enabledPages: [
            '/',
            '/content',
            '/concerts',
            '/artists',
            '/shop',
            '/about',
            '/contact'
          ],
          disabledPages: [
            '/admin',
            '/auth',
            '/payment',
            '/checkout'
          ],
          enabledUserTypes: ['guest', 'user'],
          disabledUserTypes: ['premium', 'admin'],
          maxAdsPerPage: 3,
          minContentLength: 500
        },
        tracking: {
          enabled: true,
          events: ['impression', 'click', 'viewability']
        },
        statistics: {
          totalImpressions: 0,
          totalClicks: 0,
          revenue: 0,
          lastUpdated: new Date()
        }
      });
      
      await defaultSettings.save();
      console.log('Default Google Ads settings created successfully');
    }
    
    console.log('\n✅ Google Ads Integration Complete!');
    console.log('🎯 Admin page added to sidebar navigation');
    console.log('⚙️ Database settings initialized');
    console.log('🔗 Access at: /admin/google-ads');
    
  } catch (error) {
    console.error('Error adding Google Ads page:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
addGoogleAdsPage();
