const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');

// GET - All payments list
router.get('/', isLoggedIn, hasAdminPermission('manage_payments'), async (req, res) => {
    try {
        const { type, status, payoutStatus, search, startDate, endDate } = req.query;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 5), 100);
        const skip = (page - 1) * limit;

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

        const [transactions, filteredCount] = await Promise.all([
            Transaction.find(query)
            .populate('user', 'name email')
            .populate('payee', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
            Transaction.countDocuments(query)
        ]);

        const totalPages = Math.max(Math.ceil(filteredCount / limit), 1);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        // Calculate aggregated stats
        const [totalRevenueAgg, platformFeesAgg, pendingPayoutsAgg] = await Promise.all([
            Transaction.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$platformFee' } } }
            ]),
            Transaction.aggregate([
                { $match: { payoutStatus: 'pending', status: 'success' } },
                { $group: { _id: null, total: { $sum: '$netAmount' } } }
            ])
        ]);

        const stats = {
            totalRevenue: totalRevenueAgg[0]?.total || 0,
            platformFees: platformFeesAgg[0]?.total || 0,
            pendingPayouts: pendingPayoutsAgg[0]?.total || 0,
            totalTransactions: filteredCount
        };

        const buildPageUrl = (nextPage) => {
            const params = new URLSearchParams();
            if (type && type !== 'all') params.set('type', type);
            if (status && status !== 'all') params.set('status', status);
            if (payoutStatus && payoutStatus !== 'all') params.set('payoutStatus', payoutStatus);
            if (search) params.set('search', search);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            params.set('page', String(nextPage));
            params.set('limit', String(limit));
            return `/admin/payments?${params.toString()}`;
        };

        const pageStart = Math.max(1, page - 2);
        const pageEnd = Math.min(totalPages, page + 2);
        const pageUrls = [];
        for (let currentPage = pageStart; currentPage <= pageEnd; currentPage++) {
            pageUrls.push({
                page: currentPage,
                url: buildPageUrl(currentPage),
                isCurrent: currentPage === page
            });
        }

        res.render('admin/payments/index', {
            layout: 'admin',
            title: 'Payment Management',
            currentPath: '/admin/payments',
            transactions,
            stats,
            filters: req.query,
            pagination: {
                page,
                limit,
                totalPages,
                totalTransactions: filteredCount,
                hasPrev,
                hasNext,
                prevUrl: hasPrev ? buildPageUrl(page - 1) : null,
                nextUrl: hasNext ? buildPageUrl(page + 1) : null,
                pageUrls
            }
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
