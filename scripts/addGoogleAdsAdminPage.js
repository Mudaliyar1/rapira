require('dotenv').config();
const mongoose = require('mongoose');
const AdminPage = require('../models/AdminPage');

async function addGoogleAdsAdminPage() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Check if the Google Ads admin page already exists
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
        category: 'monetization',
        displayOrder: 25,
        isActive: true,
        alwaysAccessible: false,
        superAdminOnly: false // Allow all admins to access
      });
      
      await googleAdsPage.save();
      console.log('Google Ads admin page created successfully');
      console.log('New page:', googleAdsPage);
    }
    
    // List all admin pages to verify
    const allPages = await AdminPage.find().sort({ category: 1, displayOrder: 1 });
    console.log('\nAll Admin Pages:');
    console.log('================');
    allPages.forEach(page => {
      console.log(`${page.category.toUpperCase()}: ${page.name} (${page.path}) - ${page.isActive ? 'Active' : 'Inactive'}`);
    });
    
  } catch (error) {
    console.error('Error adding Google Ads admin page:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
addGoogleAdsAdminPage();
