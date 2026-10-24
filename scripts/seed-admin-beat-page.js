const mongoose = require('mongoose');
require('dotenv').config();

// Force Node.js DNS to use Google DNS
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const AdminPage = require('../models/AdminPage');

async function seedAdminPage() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const pageData = {
            name: 'Artist Beat Purchases',
            slug: 'artist_beat_purchases',
            description: 'Monitor and manage beats purchased by artists',
            path: '/admin/artist-beat-purchases',
            icon: 'bi-cash-stack',
            category: 'user_management',
            displayOrder: 25,
            isActive: true,
            alwaysAccessible: false,
            superAdminOnly: false
        };

        const existing = await AdminPage.findOne({ slug: pageData.slug });
        if (existing) {
            console.log('Page already exists. Updating...');
            await AdminPage.updateOne({ slug: pageData.slug }, pageData);
        } else {
            console.log('Creating new AdminPage record...');
            await AdminPage.create(pageData);
        }

        console.log('Admin page seeded successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin page:', error);
        process.exit(1);
    }
}

seedAdminPage();
