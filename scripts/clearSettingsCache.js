require('dotenv').config();
const mongoose = require('mongoose');
const WebsiteSettings = require('../models/WebsiteSettings');

async function clearAndTestSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get current settings
    const settings = await WebsiteSettings.getSettings();
    console.log('Current settings loaded:');
    console.log('- Header Brand Type:', settings.headerSettings.brandType);
    console.log('- Header Brand Text:', settings.headerSettings.brandText);
    console.log('- Logo URL:', settings.headerSettings.logoUrl);
    console.log('- Discover Menu Enabled:', settings.menuSettings.discoverMenu.enabled);
    console.log('- Services Menu Enabled:', settings.menuSettings.servicesMenu.enabled);
    console.log('- Services Team Requirement:', settings.menuSettings.servicesMenu.items.teamRequirement);
    console.log('- Services Find My Artist:', settings.menuSettings.servicesMenu.items.findMyArtist);
    console.log('- Services Subscriptions:', settings.menuSettings.servicesMenu.items.subscriptions);
    console.log('- Primary Color:', settings.themeSettings.primaryColor);
    console.log('- Site Name:', settings.siteSettings.siteName);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the test
clearAndTestSettings();
