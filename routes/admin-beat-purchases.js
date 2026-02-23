const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const BeatPurchase = require('../models/BeatPurchase');
const User = require('../models/User');
const Artist = require('../models/Artist');
const ProducerBeat = require('../models/ProducerBeat');

// GET - List artists who have purchased beats
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { email, startDate, endDate } = req.query;

        // Build base query for BeatPurchase
        const purchaseQuery = { status: 'completed' };
        if (startDate || endDate) {
            purchaseQuery.createdAt = {};
            if (startDate) purchaseQuery.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                purchaseQuery.createdAt.$lte = end;
            }
        }

        // Find all unique artist IDs from successful beat purchases (filtered by date if provided)
        const purchasedArtistIds = await BeatPurchase.distinct('artist', purchaseQuery);

        // Build query for Users
        const userQuery = { _id: { $in: purchasedArtistIds } };
        if (email) {
            userQuery.email = { $regex: email, $options: 'i' };
        }

        // Fetch User details for these IDs
        const artists = await User.find(userQuery).select('name email profileImage');

        // Attach purchase counts and totals
        const artistsWithStats = await Promise.all(artists.map(async (user) => {
            // Re-use the purchaseQuery (which includes the date filter) to get counts and totals
            const itemQuery = { ...purchaseQuery, artist: user._id };

            const count = await BeatPurchase.countDocuments({ ...itemQuery, isDeletedByArtist: { $ne: true } });
            const totalSpentAgg = await BeatPurchase.aggregate([
                { $match: itemQuery },
                { $group: { _id: null, total: { $sum: '$totalAmountPaid' } } }
            ]);

            return {
                ...user.toObject(),
                purchaseCount: count,
                totalSpent: totalSpentAgg.length > 0 ? totalSpentAgg[0].total : 0
            };
        }));

        res.render('admin/artist-beat-purchases', {
            layout: 'layouts/admin',
            title: 'Artist Beat Purchases',
            artists: artistsWithStats,
            filters: { email, startDate, endDate },
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        console.error('Error in admin artist beat purchases:', error);
        req.flash('error', 'Failed to load artist list');
        res.redirect('/admin/dashboard');
    }
});

// GET - View all beats purchased by a specific artist
router.get('/artist/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const artistUser = await User.findById(req.params.id);

        if (!artistUser) {
            req.flash('error', 'Artist not found');
            return res.redirect('/admin/artist-beat-purchases');
        }

        // Build query
        const query = { artist: req.params.id, status: 'completed' };
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const purchases = await BeatPurchase.find(query)
            .populate('beat')
            .populate('producer', 'name email')
            .sort({ createdAt: -1 });

        res.render('admin/artist-beat-details', {
            layout: 'layouts/admin',
            title: `Purchases by ${artistUser.name}`,
            artistUser,
            purchases,
            filters: { startDate, endDate },
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        console.error('Error fetching artist beat details:', error);
        req.flash('error', 'Failed to load purchase details');
        res.redirect('/admin/artist-beat-purchases');
    }
});

// POST - Delete a beat purchase record
router.post('/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const purchase = await BeatPurchase.findById(req.params.id);
        if (!purchase) {
            req.flash('error', 'Purchase record not found');
            return res.redirect('back');
        }

        const artistId = purchase.artist;
        await BeatPurchase.findByIdAndDelete(req.params.id);

        req.flash('success', 'Purchase record deleted successfully');
        res.redirect(`/admin/artist-beat-purchases/artist/${artistId}`);
    } catch (error) {
        console.error('Error deleting purchase record:', error);
        req.flash('error', 'Failed to delete purchase record');
        res.redirect('back');
    }
});

module.exports = router;
