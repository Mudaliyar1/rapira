const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AdminPage = require('../models/AdminPage');
const AdminPagePermission = require('../models/AdminPagePermission');
const { isLoggedIn, isSuperAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

// Super Admin: Access Control Dashboard
router.get('/', isLoggedIn, isSuperAdmin, async (req, res) => {
  try {
    // Get all admin users
    const adminUsers = await User.find({ role: 'admin' }).sort({ name: 1 });
    
    // Get all super admin users
    const superAdmins = await User.find({ role: 'superAdmin' }).sort({ name: 1 });
    
    // Get all admin pages
    const adminPages = await AdminPage.find({ isActive: true })
      .sort({ category: 1, displayOrder: 1 });
    
    // Group pages by category
    const pagesByCategory = {};
    adminPages.forEach(page => {
      if (!pagesByCategory[page.category]) {
        pagesByCategory[page.category] = [];
      }
      pagesByCategory[page.category].push(page);
    });
    
    // Get all admin permissions
    const permissions = await AdminPagePermission.find({
      admin: { $in: adminUsers.map(admin => admin._id) }
    });
    
    // Create a map of admin ID to permissions
    const permissionsMap = {};
    permissions.forEach(perm => {
      permissionsMap[perm.admin.toString()] = perm;
    });
    
    res.render('admin/access-control', {
      layout: 'admin',
      title: 'Admin Access Control',
      currentPath: '/admin/access-control',
      adminUsers,
      superAdmins,
      pagesByCategory,
      permissionsMap,
      categories: {
        dashboard: 'Dashboard',
        user_management: 'User Management',
        content_management: 'Content Management',
        booking_management: 'Booking Management',
        system: 'System'
      }
    });
  } catch (error) {
    console.error('Error in access control dashboard:', error);
    req.flash('error', 'An error occurred while loading the access control dashboard');
    res.redirect('/admin');
  }
});

// Super Admin: Promote admin to super admin
router.post('/promote', isLoggedIn, isSuperAdmin, async (req, res) => {
  try {
    const { adminId } = req.body;
    
    if (!adminId) {
      req.flash('error', 'Admin ID is required');
      return res.redirect('/admin/access-control');
    }
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      req.flash('error', 'Invalid admin ID');
      return res.redirect('/admin/access-control');
    }
    
    // Find the admin user
    const admin = await User.findById(adminId);
    
    if (!admin) {
      req.flash('error', 'Admin user not found');
      return res.redirect('/admin/access-control');
    }
    
    if (admin.role !== 'admin') {
      req.flash('error', 'User is not an admin');
      return res.redirect('/admin/access-control');
    }
    
    // Update the admin to super admin
    admin.role = 'superAdmin';
    await admin.save();
    
    req.flash('success', `${admin.name} has been promoted to Super Admin`);
    res.redirect('/admin/access-control');
  } catch (error) {
    console.error('Error promoting admin to super admin:', error);
    req.flash('error', 'An error occurred while promoting the admin');
    res.redirect('/admin/access-control');
  }
});

// Super Admin: Demote super admin to admin
router.post('/demote', isLoggedIn, isSuperAdmin, async (req, res) => {
  try {
    const { adminId } = req.body;
    
    if (!adminId) {
      req.flash('error', 'Admin ID is required');
      return res.redirect('/admin/access-control');
    }
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      req.flash('error', 'Invalid admin ID');
      return res.redirect('/admin/access-control');
    }
    
    // Find the super admin user
    const superAdmin = await User.findById(adminId);
    
    if (!superAdmin) {
      req.flash('error', 'Super admin user not found');
      return res.redirect('/admin/access-control');
    }
    
    if (superAdmin.role !== 'superAdmin') {
      req.flash('error', 'User is not a super admin');
      return res.redirect('/admin/access-control');
    }
    
    // Prevent demoting yourself
    if (superAdmin._id.toString() === req.session.user.id) {
      req.flash('error', 'You cannot demote yourself');
      return res.redirect('/admin/access-control');
    }
    
    // Update the super admin to admin
    superAdmin.role = 'admin';
    await superAdmin.save();
    
    req.flash('success', `${superAdmin.name} has been demoted to Admin`);
    res.redirect('/admin/access-control');
  } catch (error) {
    console.error('Error demoting super admin to admin:', error);
    req.flash('error', 'An error occurred while demoting the super admin');
    res.redirect('/admin/access-control');
  }
});

// Super Admin: Update admin page permissions
router.post('/update-permissions', isLoggedIn, isSuperAdmin, async (req, res) => {
  try {
    const { adminId, permissions } = req.body;
    
    if (!adminId) {
      req.flash('error', 'Admin ID is required');
      return res.redirect('/admin/access-control');
    }
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      req.flash('error', 'Invalid admin ID');
      return res.redirect('/admin/access-control');
    }
    
    // Find the admin user
    const admin = await User.findById(adminId);
    
    if (!admin) {
      req.flash('error', 'Admin user not found');
      return res.redirect('/admin/access-control');
    }
    
    if (admin.role !== 'admin') {
      req.flash('error', 'User is not an admin');
      return res.redirect('/admin/access-control');
    }
    
    // Get all admin pages
    const adminPages = await AdminPage.find({ isActive: true });
    
    // Create a map of page permissions
    const pagePermissions = new Map();
    
    // Set permissions based on form data
    adminPages.forEach(page => {
      // If the page is always accessible, set to true regardless of form input
      if (page.alwaysAccessible) {
        pagePermissions.set(page.slug, true);
      } else {
        // Otherwise, use the form input or default to false
        const hasPermission = permissions && permissions.includes(page.slug);
        pagePermissions.set(page.slug, hasPermission);
      }
    });
    
    // Find or create admin permissions document
    let adminPermission = await AdminPagePermission.findOne({ admin: adminId });
    
    if (!adminPermission) {
      adminPermission = new AdminPagePermission({
        admin: adminId,
        pagePermissions: pagePermissions,
        lastModifiedBy: req.session.user.id
      });
    } else {
      adminPermission.pagePermissions = pagePermissions;
      adminPermission.lastModifiedBy = req.session.user.id;
    }
    
    await adminPermission.save();
    
    req.flash('success', `Permissions updated for ${admin.name}`);
    res.redirect('/admin/access-control');
  } catch (error) {
    console.error('Error updating admin permissions:', error);
    req.flash('error', 'An error occurred while updating permissions');
    res.redirect('/admin/access-control');
  }
});

module.exports = router;