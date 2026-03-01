const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');

// GET - All payments list
router.get('/', isLoggedIn, hasAdminPermission('manage_payments'), async (req, res) => {
    try {
        const { type, status, payoutStatus, search, startDate, endDate } = req.query;

        let query = {};

        if (type && type !== 'all') query.type = type;
        if (status && status !== 'all') query.status = status;
        if (payoutStatus && payoutStatus !== 'all') query.payoutStatus = payoutStatus;

        if (search) {
            // Find users matching search term for user/payee search
            const User = require('../models/User');
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const matchingUserIds = matchingUsers.map(u => u._id);

            query.$or = [
                { paymentId: { $regex: search, $options: 'i' } },
                { orderId: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { user: { $in: matchingUserIds } },
                { payee: { $in: matchingUserIds } }
            ];
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const transactions = await Transaction.find(query)
            .populate('user', 'name email')
            .populate('payee', 'name email')
            .sort({ createdAt: -1 });

        // Calculate aggregated stats
        const stats = {
            totalRevenue: await Transaction.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).then(res => res[0]?.total || 0),
            platformFees: await Transaction.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$platformFee' } } }
            ]).then(res => res[0]?.total || 0),
            pendingPayouts: await Transaction.aggregate([
                { $match: { payoutStatus: 'pending', status: 'success' } },
                { $group: { _id: null, total: { $sum: '$netAmount' } } }
            ]).then(res => res[0]?.total || 0)
        };

        res.render('admin/payments/index', {
            layout: 'admin',
            title: 'Payment Management',
            currentPath: '/admin/payments',
            transactions,
            stats,
            filters: req.query
        });
    } catch (error) {
        console.error('Error loading payments:', error);
        req.flash('error', 'Failed to load payments');
        res.redirect('/admin');
    }
});

// POST - Update payout status
router.post('/:id/payout-status', isLoggedIn, hasAdminPermission('manage_payments'), async (req, res) => {
    try {
        const { payoutStatus } = req.body;
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            req.flash('error', 'Transaction not found');
            return res.redirect('/admin/payments');
        }

        transaction.payoutStatus = payoutStatus;
        await transaction.save();

        req.flash('success', 'Payout status updated successfully');
        res.redirect('/admin/payments');
    } catch (error) {
        console.error('Error updating payout status:', error);
        req.flash('error', 'Failed to update payout status');
        res.redirect('/admin/payments');
    }
});

// GET - View transaction details
router.get('/view/:id', isLoggedIn, hasAdminPermission('manage_payments'), async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('user')
            .populate('payee');

        if (!transaction) {
            req.flash('error', 'Transaction not found');
            return res.redirect('/admin/payments');
        }

        res.render('admin/payments/show', {
            layout: 'admin',
            title: 'Transaction Details',
            currentPath: '/admin/payments',
            tx: transaction
        });
    } catch (error) {
        console.error('Error viewing transaction:', error);
        req.flash('error', 'Failed to load transaction details');
        res.redirect('/admin/payments');
    }
});

module.exports = router;
