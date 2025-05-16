/**
 * Script to add the Session Management page to the admin pages
 * Run with: node scripts/add-session-management-page.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AdminPage = require('../models/AdminPage');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB Connected');
  addSessionManagementPage();
})
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

async function addSessionManagementPage() {
  try {
    // Check if the page already exists
    const existingPage = await AdminPage.findOne({ slug: 'session-management' });
    
    if (existingPage) {
      console.log('Session Management page already exists');
      mongoose.connection.close();
      return;
    }
    
    // Create the new admin page
    const newPage = new AdminPage({
      name: 'Session Management',
      slug: 'session-management',
      description: 'Manage user sessions and cookies',
      path: '/admin/sessions',
      icon: 'bi-people-fill',
      category: 'system',
      displayOrder: 20,
      isActive: true,
      alwaysAccessible: false,
      superAdminOnly: true // Only super admins can access this page
    });
    
    await newPage.save();
    console.log('Session Management page added successfully');
    
    // Close the MongoDB connection
    mongoose.connection.close();
  } catch (error) {
    console.error('Error adding Session Management page:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}
