require('dotenv').config();
const mongoose = require('mongoose');
const GoogleAdsSettings = require('../models/GoogleAdsSettings');

async function initGoogleAdsSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Check if Google Ads settings already exist
    const existingSettings = await GoogleAdsSettings.findOne();
    
    if (existingSettings) {
      console.log('Google Ads settings already exist');
      console.log('Current settings:', JSON.stringify(existingSettings, null, 2));
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
      console.log('Settings:', JSON.stringify(defaultSettings, null, 2));
    }
    
    console.log('\nGoogle Ads Integration Summary:');
    console.log('================================');
    console.log('✅ Google Ads script added to main layout');
    console.log('✅ Ad component created for easy placement');
    console.log('✅ Admin interface for managing ads');
    console.log('✅ Database settings initialized');
    console.log('✅ Helper utilities for ad management');
    console.log('\nNext Steps:');
    console.log('1. Replace placeholder slot IDs with real AdSense slot IDs');
    console.log('2. Configure ad placements in admin panel');
    console.log('3. Test ads on different pages');
    console.log('4. Monitor performance in admin dashboard');
    
  } catch (error) {
    console.error('Error initializing Google Ads settings:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the initialization
initGoogleAdsSettings();
