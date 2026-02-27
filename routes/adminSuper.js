const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isLoggedIn, hasAdminPermission } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const PERMISSION_GROUPS = {
    'User Management': [
        { id: 'manage_users_list', name: 'Users' },
        { id: 'manage_live_users', name: 'Live Users by Page' },
        { id: 'manage_artists', name: 'Artists' },
        { id: 'manage_artist_beat_purchases', name: 'Artist Beat Purchases' },
        { id: 'manage_unblock_requests', name: 'Unblock Requests' },
        { id: 'manage_artist_applications', name: 'Artist Applications' },
        { id: 'manage_producer_applications', name: 'Producer Applications' },
        { id: 'manage_distributor_applications', name: 'Distributor Applications' },
        { id: 'manage_distributor_list', name: 'Distributor List' },
        { id: 'manage_producers', name: 'Producers' },
        { id: 'manage_producer_beats', name: 'Producer Beats' },
        { id: 'manage_producer_unblock', name: 'Producer Unblock Requests' },
        { id: 'manage_follower_analytics', name: 'Follower Analytics' },
        { id: 'manage_artist_upgrades', name: 'Artist Upgrades' },
        { id: 'manage_roles', name: 'Roles' },
        { id: 'manage_user_roles', name: 'User Roles' },
        { id: 'manage_deleted_accounts', name: 'Deleted Accounts' }
    ],
    'Concert Management': [
        { id: 'manage_concerts_list', name: 'Concerts' },
        { id: 'manage_venues', name: 'Venues' },
        { id: 'manage_venue_requests', name: 'Venue Requests' },
        { id: 'manage_venue_edit_requests', name: 'Venue Edit Requests' },
        { id: 'manage_venue_bookings', name: 'Venue Bookings' },
        { id: 'manage_concerts_pending', name: 'Pending Concerts' },
        { id: 'manage_concert_edit_requests', name: 'Concert Edit Requests' },
        { id: 'manage_tickets', name: 'Tickets' },
        { id: 'manage_free_ticket_issue', name: 'Free Ticket Issue' },
        { id: 'manage_refund_requests', name: 'Refund Requests' },
        { id: 'manage_daily_concerts', name: 'Daily Concerts' }
    ],
    'Content Management': [
        { id: 'manage_content_feature', name: 'Content' },
        { id: 'manage_artist_posts', name: 'Artist Posts' },
        { id: 'manage_pages', name: 'Pages' },
        { id: 'manage_about_us', name: 'About Us' },
        { id: 'manage_learning_modules', name: 'Learning Modules' }
    ],
    'Booking Management': [
        { id: 'manage_ticket_validation', name: 'Ticket Validation' },
        { id: 'manage_team_roles', name: 'Team Roles' },
        { id: 'manage_team_bookings', name: 'Team Bookings' },
        { id: 'manage_featured_artists', name: 'Featured Artists' },
        { id: 'manage_role_slots', name: 'Role Slots' },
        { id: 'manage_artist_bookings', name: 'Artist Bookings' }
    ],
    'Merchandise': [
        { id: 'manage_merch_products', name: 'Products' },
        { id: 'manage_merch_orders', name: 'Orders' },
        { id: 'manage_reviews', name: 'Reviews' }
    ],
    'Subscriptions': [
        { id: 'manage_sub_plans', name: 'Subscription Plans' },
        { id: 'manage_sub_users', name: 'User Subscriptions' }
    ],
    'Communication': [
        { id: 'manage_website_updates', name: 'Website Updates' },
        { id: 'manage_contact_messages', name: 'Contact Messages' },
        { id: 'manage_compose_email', name: 'Compose Email' },
        { id: 'manage_basic_email', name: 'Basic Email' },
        { id: 'manage_email_status', name: 'Email Status' },
        { id: 'manage_team_updates', name: 'Team Updates' }
    ],
    'System': [
        { id: 'manage_revenue_analysis', name: 'Revenue Analysis' },
        { id: 'manage_distribution_receipts', name: 'Distribution Receipts' },
        { id: 'manage_media_management', name: 'Media Management' },
        { id: 'manage_website_settings', name: 'Website Settings' },
        { id: 'manage_storage_management', name: 'Storage Management' },
        { id: 'manage_session_management', name: 'Session Management' },
        { id: 'manage_dashboard', name: 'Dashboard' },
        { id: 'manage_notifications', name: 'Notifications' },
        { id: 'manage_admins', name: 'Admin Management' }
    ]
};

// Get all admins
router.get('/manage-admins', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });
        res.render('admin/super/manage-admins', {
            layout: 'admin',
            title: 'Manage Admins',
            currentPath: '/admin/super/manage-admins',
            admins,
            PERMISSION_GROUPS
        });
    } catch (error) {
        console.error('Error fetching admins:', error);
        req.flash('error', 'Failed to load admins');
        res.redirect('/admin');
    }
});

// GET add admin form
router.get('/add-admin', isLoggedIn, hasAdminPermission('manage_admins'), (req, res) => {
    res.render('admin/super/add-admin', {
        layout: 'admin',
        title: 'Add New Admin',
        currentPath: '/admin/super/manage-admins',
        PERMISSION_GROUPS
    });
});

// Create new admin
router.post('/add-admin', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
    try {
        const { name, email, password, isSuperAdminValue, permissions, adminTitle } = req.body;

        // Security check: Only super admins can create other super admins
        if (isSuperAdminValue === 'true' && !req.session.user.isSuperAdmin) {
            req.flash('error', 'Only Super Admins can grant Super Admin privileges.');
            return res.redirect('/admin/super/manage-admins');
        }

        // Check if email exists
        const existing = await User.findOne({ email });
        if (existing) {
            req.flash('error', 'Email already in use.');
            return res.redirect('/admin/super/manage-admins');
        }

        const adminPerms = permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : [];

        const newAdmin = new User({
            name,
            email,
            password,
            role: 'admin',
            isSuperAdmin: isSuperAdminValue === 'true',
            adminPermissions: adminPerms,
            adminTitle: adminTitle || '',
            isVerified: true
        });

        await newAdmin.save();
        req.flash('success', 'Admin created successfully.');
        res.redirect('/admin/super/manage-admins');
    } catch (error) {
        console.error('Add Admin error:', error);
        req.flash('error', 'Failed to create admin.');
        res.redirect('/admin/super/add-admin');
    }
});

// GET edit admin form
router.get('/edit-admin/:id', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
    try {
        // Restriction: No admin can edit themselves in this panel
        if (req.params.id === req.session.user.id) {
            req.flash('error', 'You cannot edit your own configuration here. Use profile settings.');
            return res.redirect('/admin/super/manage-admins');
        }

        const adminUser = await User.findById(req.params.id);
        if (!adminUser || adminUser.role !== 'admin') {
            req.flash('error', 'Admin not found.');
            return res.redirect('/admin/super/manage-admins');
        }

        // Restriction: Standard admins cannot edit Super Admins
        if (adminUser.isSuperAdmin && !req.session.user.isSuperAdmin) {
            req.flash('error', 'Standard admins cannot edit Super Admin accounts.');
            return res.redirect('/admin/super/manage-admins');
        }

        res.render('admin/super/edit-admin', {
            layout: 'admin',
            title: 'Edit Admin',
            currentPath: '/admin/super/manage-admins',
            admin: adminUser,
            PERMISSION_GROUPS
        });
    } catch (error) {
        console.error('Error fetching admin:', error);
        req.flash('error', 'Failed to load admin details');
        res.redirect('/admin/super/manage-admins');
    }
});

// Update admin
router.post('/edit-admin/:id', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
    try {
        const { name, email, newPassword, isSuperAdminValue, permissions, adminTitle } = req.body;

        // Restriction: No admin can edit themselves
        if (req.params.id === req.session.user.id) {
            req.flash('error', 'You cannot edit your own configuration.');
            return res.redirect('/admin/super/manage-admins');
        }

        const adminUser = await User.findById(req.params.id);

        if (!adminUser) {
            req.flash('error', 'Admin not found.');
            return res.redirect('/admin/super/manage-admins');
        }

        // Restriction: Standard admins cannot edit Super Admins
        if (adminUser.isSuperAdmin && !req.session.user.isSuperAdmin) {
            req.flash('error', 'Only Super Admins can modify other Super Admin accounts.');
            return res.redirect('/admin/super/manage-admins');
        }

        // Restriction: Standard admins cannot grant/revoke Super Admin privileges
        if (isSuperAdminValue !== undefined && (adminUser.isSuperAdmin !== (isSuperAdminValue === 'true')) && !req.session.user.isSuperAdmin) {
            req.flash('error', 'Only Super Admins can change Super Admin privileges.');
            return res.redirect('/admin/super/manage-admins');
        }

        // Prevent self-demotion from super admin to avoid losing ALL super admins
        if (adminUser._id.toString() === req.session.user.id && isSuperAdminValue !== 'true') {
            req.flash('error', 'You cannot remove your own Super Admin access.');
            return res.redirect('/admin/super/manage-admins');
        }

        adminUser.name = name;
        adminUser.email = email;
        adminUser.adminTitle = adminTitle || '';
        adminUser.isSuperAdmin = isSuperAdminValue === 'true';
        adminUser.adminPermissions = permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : [];

        if (newPassword && newPassword.trim().length >= 6) {
            adminUser.password = newPassword; // Will be hashed by pre-save hook
        }

        await adminUser.save();
        req.flash('success', 'Admin updated successfully.');
        res.redirect('/admin/super/manage-admins');
    } catch (error) {
        console.error('Edit Admin error:', error);
        req.flash('error', 'Failed to update admin.');
        res.redirect(`/admin/super/edit-admin/${req.params.id}`);
    }
});

// Delete Admin
router.post('/delete-admin/:id', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
    try {
        if (req.params.id === req.session.user.id) {
            req.flash('error', 'You cannot delete yourself.');
            return res.redirect('/admin/super/manage-admins');
        }

        const adminUser = await User.findById(req.params.id);
        if (!adminUser) {
            req.flash('error', 'Admin not found.');
            return res.redirect('/admin/super/manage-admins');
        }

        // Restriction: Standard admins cannot delete Super Admins
        if (adminUser.isSuperAdmin && !req.session.user.isSuperAdmin) {
            req.flash('error', 'Only Super Admins can delete other Super Admin accounts.');
            return res.redirect('/admin/super/manage-admins');
        }

        await User.findByIdAndDelete(req.params.id);
        req.flash('success', 'Admin deleted successfully.');
        res.redirect('/admin/super/manage-admins');
    } catch (error) {
        console.error('Delete Admin error:', error);
        req.flash('error', 'Failed to delete admin.');
        res.redirect('/admin/super/manage-admins');
    }
});

module.exports = router;
