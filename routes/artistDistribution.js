const express = require('express');
const router = express.Router();
const { isLoggedIn, isArtist } = require('../middleware/auth');
const DistributionPackage = require('../models/DistributionPackage');
const DistributionRequest = require('../models/DistributionRequest');
const WebsiteSettings = require('../models/WebsiteSettings');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const Artist = require('../models/Artist');
const DistributorApplication = require('../models/DistributorApplication');
const { createOrder, verifyPayment } = require('../utils/paymentService');
const multer = require('multer');
const { uploadFileToCloudinary } = require('../utils/mediaService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

router.get('/distributors', isLoggedIn, isArtist, async (req, res) => {
    try {
        const { platform, state, city, search } = req.query;
        const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');
        if (!artist) {
            req.flash('error', 'Artist profile not found');
            return res.redirect('/users/profile');
        }

        const distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
        if (!distributorRole) {
            return res.render('users/artist-distribution', { layout: false, title: 'Music Distribution Hub', distributorProfiles: [], uniquePlatforms: [], uniqueStates: [], uniqueCities: [], currentUser: req.session.user, artist, currentPath: '/artist-distribution/distributors', filters: req.query });
        }

        // Find all users with the distributor role
        const distributorUserRoles = await UserRole.find({ role: distributorRole._id }).populate('user');
        const validDistributorUsers = distributorUserRoles.map(ur => ur.user).filter(u => u && u._id);
        const validUserIds = validDistributorUsers.map(u => u._id);

        // Get apps for metadata (even if not 'approved', assuming if they have role they are legit)
        const apps = await DistributorApplication.find({ user: { $in: validUserIds } }).populate('user', 'name profileImage email');
        const appMap = new Map();
        apps.forEach(app => appMap.set(app.user._id.toString(), app));

        const activePackages = await DistributionPackage.find({ distributor: { $in: validUserIds }, isActive: true }).populate('distributor');

        const distributorProfiles = [];
        const uniquePlatforms = new Set();
        const uniqueStates = new Set();
        const uniqueCities = new Set();

        for (const pkg of activePackages) {
            let user = validDistributorUsers.find(u => u._id.toString() === (pkg.distributor._id ? pkg.distributor._id.toString() : pkg.distributor.toString()));
            if (!user && pkg.distributor && pkg.distributor._id) user = pkg.distributor;
            if (!user) continue;

            let app = appMap.get(user._id.toString());

            let packagePlatforms = pkg.platforms && pkg.platforms.length > 0 ? pkg.platforms : (app ? app.platforms : ['Spotify', 'Apple Music', 'YouTube Music']);
            let location = app ? app.location : 'Global';
            let companyName = app ? app.companyName : user.name;

            // Populate unique filters from ALL active packages
            packagePlatforms.forEach(p => uniquePlatforms.add(p));
            if (location !== 'Global') {
                const parts = location.split(', ');
                if (parts.length > 1) uniqueStates.add(parts[1]);
                uniqueCities.add(parts[0]);
            }

            // Apply search filters
            let match = true;
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = user.name && user.name.toLowerCase().includes(searchLower);
                const emailMatch = user.email && user.email.toLowerCase().includes(searchLower);
                const compMatch = companyName && companyName.toLowerCase().includes(searchLower);
                const pkgMatch = pkg.name && pkg.name.toLowerCase().includes(searchLower);
                if (!nameMatch && !emailMatch && !compMatch && !pkgMatch) match = false;
            }

            if (state) {
                if (location === 'Global') match = false;
                else {
                    const appState = location.split(', ').pop();
                    if (appState.toLowerCase() !== state.toLowerCase()) match = false;
                }
            }
            if (city) {
                if (location === 'Global') match = false;
                else {
                    const appCity = location.split(', ')[0];
                    if (appCity.toLowerCase() !== city.toLowerCase()) match = false;
                }
            }
            if (platform) {
                if (!packagePlatforms.includes(platform)) match = false;
            }

            if (match) {
                distributorProfiles.push({
                    user: user,
                    packages: [pkg], // Only put THIS package in the array so it formats as a single package card
                    location: location,
                    platforms: packagePlatforms,
                    companyName: companyName
                });
            }
        }

        res.render('users/artist-distribution', {
            layout: false,
            title: 'Music Distribution Hub',
            distributorProfiles,
            uniquePlatforms: Array.from(uniquePlatforms).sort(),
            uniqueStates: Array.from(uniqueStates).sort(),
            uniqueCities: Array.from(uniqueCities).sort(),
            currentUser: req.session.user,
            artist,
            currentPath: '/artist-distribution/distributors',
            filters: req.query
        });
    } catch (error) {
        console.error('Artist distribution list error:', error);
        req.flash('error', 'Failed to load distributors');
        res.redirect('/users/profile');
    }
});

router.get('/history', isLoggedIn, isArtist, async (req, res) => {
    try {
        const { status, distributorSearch } = req.query;
        let query = {
            artist: req.session.user.id,
            deletedByArtist: { $ne: true }
        };

        if (status && status !== 'all') {
            query.status = status;
        }

        if (req.query.billSearch) {
            query.receiptNumber = { $regex: new RegExp(req.query.billSearch.trim(), 'i') };
        }

        const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');
        let requests = await DistributionRequest.find(query)
            .populate('distributor', 'name email profileImage')
            .populate('package', 'name price packageType maxAudioFiles maxVideoFiles')
            .sort({ createdAt: -1 });

        if (distributorSearch) {
            const searchLower = distributorSearch.toLowerCase();
            requests = requests.filter(req => {
                const nameMatch = req.distributor && req.distributor.name && req.distributor.name.toLowerCase().includes(searchLower);
                return nameMatch;
            });
        }

        res.render('users/artist-distribution-history', {
            layout: false,
            title: 'Distribution History',
            requests,
            artist,
            currentUser: req.session.user,
            currentPath: '/artist-distribution/history',
            filters: {
                status: status || 'all',
                distributorSearch: distributorSearch || '',
                billSearch: req.query.billSearch || ''
            }
        });
    } catch (error) {
        console.error('History error:', error);
        req.flash('error', 'Failed to load history');
        res.redirect('/artist-distribution/distributors');
    }
});

router.post('/history/:id/delete', isLoggedIn, isArtist, async (req, res) => {
    try {
        const request = await DistributionRequest.findOne({ _id: req.params.id, artist: req.session.user.id });
        if (!request) {
            req.flash('error', 'History record not found.');
            return res.redirect('/artist-distribution/history');
        }

        request.deletedByArtist = true;
        await request.save();

        req.flash('success', 'Distribution history record removed successfully.');
        res.redirect('/artist-distribution/history');
    } catch (error) {
        console.error('Delete history error:', error);
        req.flash('error', 'Failed to remove history record.');
        res.redirect('/artist-distribution/history');
    }
});

router.get('/cancel-request/:id', isLoggedIn, isArtist, async (req, res) => {
    try {
        const request = await DistributionRequest.findOne({
            _id: req.params.id,
            artist: req.session.user.id,
            paymentStatus: 'pending'
        });

        if (request) {
            await DistributionRequest.deleteOne({ _id: request._id });
            req.flash('info', 'Distribution request cancelled.');
        }

        res.redirect('/artist-distribution/distributors');
    } catch (error) {
        console.error('Cancel request error:', error);
        res.redirect('/artist-distribution/distributors');
    }
});

router.get('/package/:packageId', isLoggedIn, isArtist, async (req, res) => {
    try {
        const pkg = await DistributionPackage.findById(req.params.packageId).populate('distributor');
        if (!pkg || !pkg.isActive) {
            req.flash('error', 'Package not found or inactive');
            return res.redirect('/artist-distribution/distributors');
        }

        const WebsiteSettings = require('../models/WebsiteSettings');
        const settings = await WebsiteSettings.getSettings();
        const commissionPerc = settings.distributorCommissionSettings ? settings.distributorCommissionSettings.percentage : 5;
        const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');

        res.render('users/artist-distribution-package', {
            layout: false,
            title: pkg.name,
            currentPath: '/artist-distribution/distributors',
            cartPackage: pkg,
            artist,
            artistUser: req.session.user,
            commissionPerc
        });
    } catch (error) {
        console.error('Package details error:', error);
        req.flash('error', 'Failed to load package details');
        res.redirect('/artist-distribution/distributors');
    }
});

router.post('/request/:packageId', isLoggedIn, isArtist, upload.fields([{ name: 'audioFiles', maxCount: 10 }, { name: 'videoFiles', maxCount: 10 }, { name: 'posterImage', maxCount: 1 }]), async (req, res) => {
    try {
        const pkg = await DistributionPackage.findById(req.params.packageId).populate('distributor');
        if (!pkg || !pkg.isActive) {
            req.flash('error', 'Package not found or inactive');
            return res.redirect('/artist-distribution/distributors');
        }

        const {
            contentTitle,
            primaryArtist,
            featuredArtists,
            genre,
            language,
            releaseDate,
            explicitContent,
            recordLabel,
            copyrightYear,
            copyrightOwner
        } = req.body;

        if (!contentTitle || !primaryArtist || !genre || !releaseDate) {
            req.flash('error', 'Please fill in all required fields (Title, Primary Artist, Genre, Release Date)');
            return res.redirect(`/artist-distribution/package/${pkg._id}`);
        }

        const audioFiles = req.files.audioFiles || [];

        if (audioFiles.length === 0) {
            req.flash('error', 'Please upload at least one music file');
            return res.redirect(`/artist-distribution/package/${pkg._id}`);
        }

        if (pkg.maxAudioFiles > 0 && audioFiles.length > pkg.maxAudioFiles) {
            req.flash('error', `Maximum ${pkg.maxAudioFiles} audio files allowed.`);
            return res.redirect(`/artist-distribution/package/${pkg._id}`);
        }

        let totalUploadedFiles = [];

        // Upload Audio Files
        for (const file of audioFiles) {
            const upRes = await uploadFileToCloudinary(file, {
                module: 'distribution',
                ownerType: 'artist',
                ownerId: req.session.user.id,
                folder: 'rapira/distribution/files/audio'
            });
            totalUploadedFiles.push({
                fileUrl: upRes.media.secure_url,
                fileMedia: upRes.media._id,
                fileType: 'audio',
                originalName: file.originalname
            });
        }



        // Upload poster if exists
        let posterRes = null;
        if (req.files.posterImage) {
            posterRes = await uploadFileToCloudinary(req.files.posterImage[0], {
                module: 'distribution',
                ownerType: 'artist',
                ownerId: req.session.user.id,
                folder: 'rapira/distribution/posters'
            });
        }

        const settings = await WebsiteSettings.getSettings();
        const commissionPerc = settings.distributorCommissionSettings ? settings.distributorCommissionSettings.percentage : 5;
        const commissionAmount = (pkg.price * commissionPerc) / 100;
        const totalAmount = pkg.price + commissionAmount;

        const crypto = require('crypto');
        const receiptNum = 'RAPIRA-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        const request = new DistributionRequest({
            receiptNumber: receiptNum,
            artist: req.session.user.id,
            distributor: pkg.distributor._id,
            package: pkg._id,
            contentTitle,
            primaryArtist,
            featuredArtists,
            genre,
            language,
            releaseDate: new Date(releaseDate),
            explicitContent: explicitContent === 'on',
            recordLabel,
            copyrightYear: parseInt(copyrightYear) || new Date().getFullYear(),
            copyrightOwner,
            contentType: 'audio',
            files: totalUploadedFiles,
            posterUrl: posterRes ? posterRes.media.secure_url : '',
            posterMedia: posterRes ? posterRes.media._id : null,
            price: pkg.price,
            commissionAmount,
            totalPaid: totalAmount,
            paymentStatus: totalAmount > 0 ? 'pending' : 'free',
            status: 'pending'
        });

        await request.save();

        if (totalAmount > 0) {
            return res.redirect(`/artist-distribution/payment/${request._id}`);
        }

        req.flash('success', 'Distribution request submitted successfully!');
        res.redirect('/artist-distribution/history');
    } catch (error) {
        console.error('Artist distribution request error:', error);
        req.flash('error', 'Failed to submit request');
        res.redirect('/artist-distribution/distributors');
    }
});

router.get('/payment/:id', isLoggedIn, isArtist, async (req, res) => {
    try {
        const request = await DistributionRequest.findById(req.params.id).populate('package').populate('distributor');

        if (!request || request.artist.toString() !== req.session.user.id) {
            req.flash('error', 'Request not found');
            return res.redirect('/artist-distribution/distributors');
        }

        if (request.paymentStatus === 'paid') {
            req.flash('info', 'Payment already completed');
            return res.redirect('/artist-distribution/distributors');
        }

        const amount = request.totalPaid;
        const orderResult = await createOrder({
            amount: amount,
            receipt: `dist_req_${request._id}`,
            notes: {
                requestId: request._id.toString(),
                type: 'distribution_purchase',
                userId: req.session.user.id
            }
        });

        if (!orderResult.success) {
            req.flash('error', 'Failed to create payment order. Please try again.');
            return res.redirect('/artist-distribution/distributors');
        }

        request.razorpayOrderId = orderResult.data.id;
        await request.save();

        res.render('users/distribution-payment', {
            layout: false,
            request,
            order: orderResult.data,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentUser: req.session.user
        });
    } catch (error) {
        console.error('Error loading distribution payment:', error);
        req.flash('error', 'Failed to load payment page');
        res.redirect('/artist-distribution/distributors');
    }
});

router.post('/verify-payment/:id', isLoggedIn, isArtist, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const request = await DistributionRequest.findById(req.params.id);

        const verification = verifyPayment({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        });

        if (verification.success) {
            request.paymentStatus = 'paid';
            request.razorpayPaymentId = razorpay_payment_id;
            request.razorpaySignature = razorpay_signature;
            await request.save();

            req.flash('success', 'Payment successful! Your distribution request is now with the distributor.');
            return res.redirect('/artist-distribution/distributors');
        } else {
            request.paymentStatus = 'failed';
            await request.save();
            req.flash('error', 'Payment verification failed.');
            return res.redirect(`/artist-distribution/payment/${request._id}`);
        }
    } catch (error) {
        console.error('Error verifying distribution payment:', error);
        req.flash('error', 'Payment verification error.');
        res.redirect('/artist-distribution/distributors');
    }
});

router.get('/request-details/:id', isLoggedIn, isArtist, async (req, res) => {
    try {
        const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');
        const request = await DistributionRequest.findById(req.params.id)
            .populate('distributor', 'name email profileImage')
            .populate('package');

        if (!request || request.artist.toString() !== req.session.user.id) {
            req.flash('error', 'Request not found');
            return res.redirect('/artist-distribution/history');
        }

        res.render('users/artist-distribution-details', {
            layout: false,
            title: 'Distribution Details',
            request,
            artist,
            currentUser: req.session.user,
            currentPath: '/artist-distribution/history'
        });
    } catch (error) {
        console.error('Details error:', error);
        req.flash('error', 'Failed to load details');
        res.redirect('/artist-distribution/history');
    }
});

router.get('/receipt/:id', isLoggedIn, isArtist, async (req, res) => {
    try {
        const request = await DistributionRequest.findById(req.params.id)
            .populate('distributor', 'name email profileImage')
            .populate('package')
            .populate('artist', 'name email');

        if (!request || request.artist._id.toString() !== req.session.user.id) {
            req.flash('error', 'Receipt not found');
            return res.redirect('/artist-distribution/history');
        }

        res.render('users/distribution-receipt', {
            layout: false,
            request,
            currentUser: req.session.user
        });
    } catch (error) {
        console.error('Receipt error:', error);
        req.flash('error', 'Failed to load receipt');
        res.redirect('/artist-distribution/history');
    }
});

module.exports = router;
