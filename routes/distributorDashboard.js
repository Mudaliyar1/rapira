const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const UserRole = require('../models/UserRole');
const Artist = require('../models/Artist');
const ArtistPost = require('../models/ArtistPost');
const DistributionPackage = require('../models/DistributionPackage');
const DistributionRequest = require('../models/DistributionRequest');
const User = require('../models/User');

const requireDistributorRole = async (req, res, next) => {
    try {
        const userRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
        const hasDistributorRole = userRoles.some((entry) => entry.role && entry.role.name && entry.role.name.toLowerCase() === 'distributor');

        if (!hasDistributorRole) {
            req.flash('error', 'You do not have distributor access.');
            return res.redirect('/distributor-applications/apply');
        }

        const dbUser = await User.findById(req.session.user.id);
        if (dbUser && dbUser.isBlocked) {
            req.flash('error', 'Your account is blocked. Please contact support.');
            return res.redirect('/users/profile');
        }

        next();
    } catch (error) {
        console.error('Distributor role middleware error:', error);
        req.flash('error', 'Failed to verify distributor access');
        res.redirect('/users/profile');
    }
};

router.get('/', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const artists = await Artist.find()
            .populate('user', 'name profileImage email')
            .sort({ createdAt: -1 })
            .limit(20);

        const pendingRequestsCount = await DistributionRequest.countDocuments({
            distributor: req.session.user.id,
            status: 'pending'
        });

        const activePackagesCount = await DistributionPackage.countDocuments({
            distributor: req.session.user.id,
            isActive: true
        });

        const lifetimeData = await DistributionRequest.find({
            distributor: req.session.user.id,
            paymentStatus: { $in: ['paid', 'free'] }
        }).populate('package', 'price');

        const lifetimeTotal = lifetimeData.reduce((sum, req) => {
            return sum + (req.price || 0);
        }, 0);

        res.render('distributor/dashboard', {
            layout: false,
            title: 'Distributor Dashboard',
            currentPath: '/distributor-dashboard',
            artists,
            stats: {
                pendingRequests: pendingRequestsCount,
                activePackages: activePackagesCount,
                lifetimeEarned: lifetimeTotal
            },
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Distributor dashboard error:', error);
        req.flash('error', 'Failed to load distributor dashboard');
        res.redirect('/users/profile');
    }
});

// Package Management
router.get('/packages', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const packages = await DistributionPackage.find({ distributor: req.session.user.id })
            .sort({ createdAt: -1 });

        res.render('distributor/packages', {
            layout: false,
            title: 'Manage Distribution Packages',
            currentPath: '/distributor-dashboard/packages',
            packages,
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Error fetching packages:', error);
        req.flash('error', 'Failed to load packages');
        res.redirect('/distributor-dashboard');
    }
});

router.post('/packages', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const { name, platforms, price, features, description, packageType, maxAudioFiles, maxVideoFiles } = req.body;

        const newPackage = new DistributionPackage({
            distributor: req.session.user.id,
            name,
            platforms: Array.isArray(platforms) ? platforms : [platforms],
            price: parseFloat(price),
            features: features.split(',').map(f => f.trim()).filter(Boolean),
            description,
            packageType: packageType || 'mixed',
            maxAudioFiles: parseInt(maxAudioFiles) || 0,
            maxVideoFiles: parseInt(maxVideoFiles) || 0,
            isActive: true
        });

        await newPackage.save();
        req.flash('success', 'Package created successfully');
        res.redirect('/distributor-dashboard/packages');
    } catch (error) {
        console.error('Error creating package:', error);
        req.flash('error', 'Failed to create package');
        res.redirect('/distributor-dashboard/packages');
    }
});

router.post('/packages/:id/edit', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const { name, platforms, price, features, description, isActive, packageType, maxAudioFiles, maxVideoFiles } = req.body;
        const pkg = await DistributionPackage.findOne({ _id: req.params.id, distributor: req.session.user.id });

        if (!pkg) {
            req.flash('error', 'Package not found');
            return res.redirect('/distributor-dashboard/packages');
        }

        pkg.name = name;
        pkg.platforms = Array.isArray(platforms) ? platforms : [platforms];
        pkg.price = parseFloat(price);
        pkg.features = features.split(',').map(f => f.trim()).filter(Boolean);
        pkg.description = description;
        pkg.packageType = packageType || 'mixed';
        pkg.maxAudioFiles = parseInt(maxAudioFiles) || 0;
        pkg.maxVideoFiles = parseInt(maxVideoFiles) || 0;
        pkg.isActive = !!isActive;

        await pkg.save();
        req.flash('success', 'Package updated successfully');
        res.redirect('/distributor-dashboard/packages');
    } catch (error) {
        console.error('Error editing package:', error);
        req.flash('error', 'Failed to update package');
        res.redirect('/distributor-dashboard/packages');
    }
});

// Request Management
router.get('/requests', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const { status, email, state, billNumber } = req.query;
        let query = { distributor: req.session.user.id, deletedByDistributor: { $ne: true } };

        if (status && status !== 'all') {
            query.status = status;
        }

        if (billNumber) {
            query.receiptNumber = { $regex: new RegExp(billNumber.trim(), 'i') };
        }

        let requests = await DistributionRequest.find(query)
            .populate('artist', 'name email profileImage')
            .populate('package', 'name price')
            .sort({ createdAt: -1 });

        // Filter by email and state based on artist profile and user email
        const allArtists = await Artist.find().select('user state city').populate('user', 'email');
        const artistMap = {};
        allArtists.forEach(a => {
            if (a.user) artistMap[a.user._id.toString()] = a;
        });

        if (email) {
            const emailSearch = email.toLowerCase();
            requests = requests.filter(req => {
                if (req.artist && req.artist.email) {
                    return req.artist.email.toLowerCase().includes(emailSearch);
                }
                return false;
            });
        }

        if (state) {
            const stateSearch = state.toLowerCase();
            requests = requests.filter(req => {
                if (req.artist) {
                    const artistEntry = artistMap[req.artist._id.toString()];
                    if (artistEntry) {
                        const artistState = (artistEntry.state || '').toLowerCase();
                        const artistCity = (artistEntry.city || '').toLowerCase();
                        return artistState.includes(stateSearch) || artistCity.includes(stateSearch);
                    }
                }
                return false;
            });
        }

        const allStatesRaw = allArtists.map(a => a.state).filter(Boolean);
        const statesList = [...new Set(allStatesRaw)].sort();

        res.render('distributor/requests', {
            layout: false,
            title: 'Distribution Requests',
            currentPath: '/distributor-dashboard/requests',
            currentStatus: status || 'all',
            searchEmail: email || '',
            searchState: state || '',
            searchBill: billNumber || '',
            statesList,
            requests,
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        req.flash('error', 'Failed to load requests');
        res.redirect('/distributor-dashboard');
    }
});

router.post('/requests/:id/status', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const request = await DistributionRequest.findOne({ _id: req.params.id, distributor: req.session.user.id });

        if (!request) {
            req.flash('error', 'Request not found');
            return res.redirect('/distributor-dashboard/requests');
        }

        request.status = status;
        request.adminNotes = adminNotes;
        await request.save();

        req.flash('success', `Request marked as ${status}`);
        res.redirect('/distributor-dashboard/requests');
    } catch (error) {
        console.error('Error updating request status:', error);
        req.flash('error', 'Failed to update status');
        res.redirect('/distributor-dashboard/requests');
    }
});

// Artists List
router.get('/artists', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const { email, state } = req.query;

        // Find all artists
        let artists = await Artist.find()
            .populate('user', 'name profileImage email')
            .sort({ createdAt: -1 });

        // Apply filters
        if (email) {
            const emailSearch = email.toLowerCase();
            artists = artists.filter(a => a.user && a.user.email.toLowerCase().includes(emailSearch));
        }

        if (state) {
            const stateSearch = state.toLowerCase();
            artists = artists.filter(a => {
                const artistState = (a.state || '').toLowerCase();
                const artistCity = (a.city || '').toLowerCase();
                return artistState.includes(stateSearch) || artistCity.includes(stateSearch);
            });
        }

        const allStatesRaw = (await Artist.find().select('state')).map(a => a.state).filter(Boolean);
        const statesList = [...new Set(allStatesRaw)].sort();

        res.render('distributor/artists', {
            layout: false,
            title: 'Discover Artists',
            currentPath: '/distributor-dashboard/artists',
            searchEmail: email || '',
            searchState: state || '',
            statesList,
            artists,
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Error fetching artists:', error);
        req.flash('error', 'Failed to load artists directory');
        res.redirect('/distributor-dashboard');
    }
});

// Artist Inquiry
router.get('/artists/:id', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const artist = await Artist.findById(req.params.id).populate('user', 'name email profileImage');
        if (!artist) {
            req.flash('error', 'Artist not found');
            return res.redirect('/distributor-dashboard');
        }

        const posts = await ArtistPost.find({ artist: artist._id }).sort({ createdAt: -1 });

        res.render('distributor/artist-view', {
            layout: false,
            title: `${artist.user.name}'s Profile`,
            currentPath: '/distributor-dashboard',
            artist,
            posts,
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Error viewing artist:', error);
        req.flash('error', 'Failed to load artist details');
        res.redirect('/distributor-dashboard');
    }
});

// Earnings Management
router.get('/earnings', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const { dateFrom, dateTo, email, state, status, paymentStatus } = req.query;
        let query = {
            distributor: req.session.user.id,
            deletedByDistributor: { $ne: true }
        };

        if (paymentStatus && paymentStatus !== 'all') {
            query.paymentStatus = paymentStatus;
        } else {
            query.paymentStatus = { $in: ['paid', 'free'] };
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = toDate;
            }
        }

        let earningsData = await DistributionRequest.find(query)
            .populate('artist', 'name email profileImage')
            .populate('package', 'name price')
            .sort({ createdAt: -1 });

        const allArtists = await Artist.find().select('user state city').populate('user', 'email');
        const artistMap = {};
        allArtists.forEach(a => {
            if (a.user) artistMap[a.user._id.toString()] = a;
        });

        if (email) {
            const emailSearch = email.toLowerCase();
            earningsData = earningsData.filter(req => {
                if (req.artist && req.artist.email) {
                    return req.artist.email.toLowerCase().includes(emailSearch);
                }
                return false;
            });
        }

        if (state) {
            const stateSearch = state.toLowerCase();
            earningsData = earningsData.filter(req => {
                if (req.artist) {
                    const artistEntry = artistMap[req.artist._id.toString()];
                    if (artistEntry) {
                        const artistState = (artistEntry.state || '').toLowerCase();
                        const artistCity = (artistEntry.city || '').toLowerCase();
                        return artistState.includes(stateSearch) || artistCity.includes(stateSearch);
                    }
                }
                return false;
            });
        }

        const allStatesRaw = allArtists.map(a => a.state).filter(Boolean);
        const statesList = [...new Set(allStatesRaw)].sort();

        // Calculate totals
        const totalEarnings = earningsData.reduce((sum, req) => {
            return sum + (req.price || 0);
        }, 0);

        // Calculate lifetime (ignoring date filters)
        const lifetimeData = await DistributionRequest.find({
            distributor: req.session.user.id,
            paymentStatus: { $in: ['paid', 'free'] }
        }).populate('package', 'price');

        const lifetimeTotal = lifetimeData.reduce((sum, req) => {
            return sum + (req.price || 0);
        }, 0);

        res.render('distributor/earnings', {
            layout: false,
            title: 'Distribution Earnings',
            currentPath: '/distributor-dashboard/earnings',
            earningsData,
            totalEarnings,
            lifetimeTotal,
            statesList,
            filters: { dateFrom, dateTo, email, state, status: status || 'all', paymentStatus: paymentStatus || 'all' },
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Error fetching earnings:', error);
        req.flash('error', 'Failed to load earnings');
        res.redirect('/distributor-dashboard');
    }
});

// Distributor Request Details View
router.get('/request/:id', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const request = await DistributionRequest.findOne({ _id: req.params.id, distributor: req.session.user.id })
            .populate('distributor', 'name email profileImage')
            .populate('package')
            .populate('artist', 'name email profileImage');

        if (!request) {
            req.flash('error', 'Request not found');
            return res.redirect('/distributor-dashboard/requests');
        }

        res.render('distributor/request-details', {
            layout: false,
            request,
            currentPath: '/distributor-dashboard/requests',
            distributorUser: req.session.user
        });
    } catch (error) {
        console.error('Request details error:', error);
        req.flash('error', 'Failed to load request details');
        res.redirect('/distributor-dashboard/requests');
    }
});

// Distributor Receipt View
router.get('/receipt/:id', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const request = await DistributionRequest.findOne({ _id: req.params.id, distributor: req.session.user.id })
            .populate('distributor', 'name email profileImage')
            .populate('package')
            .populate('artist', 'name email');

        if (!request) {
            req.flash('error', 'Receipt not found');
            return res.redirect('/distributor-dashboard/earnings');
        }

        res.render('users/distribution-receipt', {
            layout: false,
            request,
            currentUser: req.session.user,
            backLink: req.query.back || '/distributor-dashboard/earnings'
        });
    } catch (error) {
        console.error('Receipt error:', error);
        req.flash('error', 'Failed to load receipt');
        res.redirect('/distributor-dashboard/earnings');
    }
});

router.post('/request/:id/delete', isLoggedIn, requireDistributorRole, async (req, res) => {
    try {
        const request = await DistributionRequest.findOne({ _id: req.params.id, distributor: req.session.user.id });
        if (!request) {
            req.flash('error', 'Record not found');
            return res.redirect('/distributor-dashboard/requests');
        }

        request.deletedByDistributor = true;
        await request.save();

        req.flash('success', 'Record removed from your dashboard successfully.');

        // Return back to wherever they came from (earnings or requests)
        const referer = req.get('Referrer') || '/distributor-dashboard/requests';
        res.redirect(referer);
    } catch (error) {
        console.error('Delete error:', error);
        req.flash('error', 'Failed to remove record');
        res.redirect('/distributor-dashboard/requests');
    }
});

module.exports = router;
