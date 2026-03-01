const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const DistributorApplication = require('../models/DistributorApplication');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const { uploadFileToCloudinary } = require('../utils/mediaService');
const { sendEmail } = require('../utils/brevoEmailService');
const WebsiteSettings = require('../models/WebsiteSettings');
const { createOrder, verifyPayment } = require('../utils/paymentService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = /image\/jpeg|image\/jpg|image\/png/.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only JPG and PNG files are allowed'));
    }
});

async function ensureDistributorRole(adminUserId = null) {
    let role = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
    if (!role) {
        role = new Role({
            name: 'Distributor',
            description: 'Music distributor role for managing music distribution to platforms',
            icon: 'bi-broadcast',
            createdBy: adminUserId
        });
        await role.save();
    }
    return role;
}

async function sendDistributorStatusEmail(user, status, adminNotes = '') {
    const isApproved = status === 'approved';
    const subject = isApproved
        ? 'Your Distributor Application Has Been Approved'
        : 'Your Distributor Application Has Been Rejected';

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
      <h2>${isApproved ? 'Distributor Application Approved' : 'Distributor Application Rejected'}</h2>
      <p>Hello ${user.name},</p>
      <p>Your music distributor application on Rapira has been <strong>${status}</strong>.</p>
      ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      <p>${isApproved ? 'You can now access your Distributor Dashboard and set up your distribution packages.' : 'You can update your details and apply again later.'}</p>
      <p>Regards,<br/>Rapira Team</p>
    </div>
  `;

    const textContent = `Hello ${user.name}, your distributor application has been ${status}. ${adminNotes ? `Admin notes: ${adminNotes}` : ''}`;

    try {
        await sendEmail({
            to: user.email,
            toName: user.name,
            subject,
            htmlContent,
            textContent
        });
    } catch (error) {
        console.error('Failed to send distributor status email:', error.message);
    }
}

router.get('/apply', isLoggedIn, async (req, res) => {
    try {
        const distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
        const hasDistributorRole = distributorRole
            ? await UserRole.exists({ user: req.session.user.id, role: distributorRole._id })
            : false;

        if (hasDistributorRole) {
            req.flash('info', 'You already have distributor access.');
            return res.redirect('/distributor/dashboard');
        }

        const pendingApplication = await DistributorApplication.findOne({
            user: req.session.user.id,
            status: 'pending'
        });

        if (pendingApplication) {
            req.flash('info', 'You already have a pending distributor application.');
            return res.redirect('/distributor-applications/status');
        }

        const websiteSettings = await WebsiteSettings.getSettings();

        res.render('distributor-applications/apply', {
            title: 'Apply as Distributor',
            websiteSettings
        });
    } catch (error) {
        console.error('Distributor apply page error:', error);
        req.flash('error', 'Failed to load distributor application form');
        res.redirect('/users/job-portal');
    }
});

router.post('/apply', isLoggedIn, upload.single('idProofFile'), async (req, res) => {
    try {
        const {
            companyName,
            mobileNumber,
            website,
            instagramLink,
            experience,
            platforms,
            state,
            city,
            idProofType,
            agreedToTerms
        } = req.body;

        let location = req.body.location;
        if (!location && city && state) {
            location = `${city}, ${state}`;
        }

        if (!companyName) { req.flash('error', 'Company name is required'); return res.redirect('/distributor-applications/apply'); }
        if (!mobileNumber) { req.flash('error', 'Mobile number is required'); return res.redirect('/distributor-applications/apply'); }
        if (!experience) { req.flash('error', 'Experience details are required'); return res.redirect('/distributor-applications/apply'); }
        if (!platforms) { req.flash('error', 'Please select at least one platform'); return res.redirect('/distributor-applications/apply'); }
        if (!location) { req.flash('error', 'Location (City & State) is required'); return res.redirect('/distributor-applications/apply'); }
        if (!idProofType) { req.flash('error', 'ID proof type is required'); return res.redirect('/distributor-applications/apply'); }

        if (!req.file) {
            req.flash('error', 'Please upload an ID proof file');
            return res.redirect('/distributor-applications/apply');
        }

        if (agreedToTerms !== 'on') {
            req.flash('error', 'You must agree to terms and conditions');
            return res.redirect('/distributor-applications/apply');
        }

        const { media } = await uploadFileToCloudinary(req.file, {
            module: 'distributorApplication',
            ownerType: 'user',
            ownerId: req.session.user.id,
            folder: 'rapira/distributor-applications/proofs'
        });

        const settings = await WebsiteSettings.getSettings();
        const fee = settings.registrationFees ? settings.registrationFees.distributorRegistrationFee : 0;

        const application = new DistributorApplication({
            user: req.session.user.id,
            companyName,
            mobileNumber,
            website: website || '',
            instagramLink: instagramLink || '',
            experience,
            platforms: Array.isArray(platforms) ? platforms : [platforms],
            location,
            idProofType,
            idProofUrl: media.secure_url,
            idProofMedia: media._id,
            registrationFee: fee,
            paymentStatus: fee > 0 ? 'pending' : 'n/a',
            status: 'pending'
        });

        await application.save();

        if (fee > 0) {
            return res.redirect(`/distributor-applications/payment/${application._id}`);
        }

        req.flash('success', 'Distributor application submitted successfully. We will review it shortly.');
        res.redirect('/distributor-applications/status');
    } catch (error) {
        console.error('Distributor apply post error:', error);
        req.flash('error', 'Failed to submit application');
        res.redirect('/distributor-applications/apply');
    }
});

router.get('/status', isLoggedIn, async (req, res) => {
    try {
        const applications = await DistributorApplication.find({ user: req.session.user.id })
            .sort({ createdAt: -1 });

        res.render('distributor-applications/status', {
            title: 'Distributor Application Status',
            applications
        });
    } catch (error) {
        console.error('Distributor status error:', error);
        req.flash('error', 'Failed to load application status');
        res.redirect('/users/job-portal');
    }
});

// Payment routes for Distributor Application
router.get('/payment/:id', isLoggedIn, async (req, res) => {
    try {
        const application = await DistributorApplication.findById(req.params.id);

        if (!application || application.user.toString() !== req.session.user.id) {
            req.flash('error', 'Application not found');
            return res.redirect('/distributor-applications/status');
        }

        if (application.paymentStatus === 'paid') {
            req.flash('info', 'Payment already completed');
            return res.redirect('/distributor-applications/status');
        }

        const orderResult = await createOrder({
            amount: application.registrationFee,
            receipt: `dist_reg_${application._id}`,
            notes: {
                applicationId: application._id.toString(),
                type: 'distributor_registration',
                userId: req.session.user.id
            }
        });

        if (!orderResult.success) {
            req.flash('error', 'Failed to create payment order. Please try again.');
            return res.redirect('/distributor-applications/status');
        }

        application.razorpayOrderId = orderResult.data.id;
        await application.save();

        res.render('distributor-applications/payment', {
            layout: false,
            application,
            order: orderResult.data,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentUser: req.session.user
        });
    } catch (error) {
        console.error('Error loading distributor payment page:', error);
        req.flash('error', 'Failed to load payment page');
        res.redirect('/distributor-applications/status');
    }
});

router.post('/verify-payment/:id', isLoggedIn, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const application = await DistributorApplication.findById(req.params.id);

        if (!application) {
            req.flash('error', 'Application not found');
            return res.redirect('/distributor-applications/status');
        }

        const verification = verifyPayment({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        });

        if (verification.success) {
            application.paymentStatus = 'paid';
            application.razorpayPaymentId = razorpay_payment_id;
            application.razorpaySignature = razorpay_signature;
            await application.save();

            // Log the transaction for admin payments page
            const { logTransaction } = require('../utils/transactionLogger');
            await logTransaction({
                user: application.user,
                type: 'registration',
                amount: application.registrationFee,
                platformFee: 0,
                paymentId: application.razorpayPaymentId,
                orderId: application.razorpayOrderId,
                sourceModel: 'DistributorApplication',
                sourceId: application._id,
                description: `Distributor registration fee`
            });

            req.flash('success', 'Payment successful! Your application is now under review.');
            return res.redirect('/distributor-applications/status');
        } else {
            application.paymentStatus = 'failed';
            await application.save();
            req.flash('error', 'Payment verification failed. Please try again.');
            return res.redirect(`/distributor-applications/payment/${application._id}`);
        }
    } catch (error) {
        console.error('Error verifying distributor payment:', error);
        req.flash('error', 'Payment verification error. Please contact support.');
        res.redirect('/distributor-applications/status');
    }
});

// GET - Cancel Payment: Delete application and go back to form
router.get('/cancel-payment/:id', isLoggedIn, async (req, res) => {
    try {
        const application = await DistributorApplication.findById(req.params.id);

        if (application && application.user.toString() === req.session.user.id && application.paymentStatus !== 'paid') {
            await DistributorApplication.findByIdAndDelete(req.params.id);
            console.log(`Deleted cancelled distributor application: ${req.params.id}`);
        }

        req.flash('info', 'Payment was cancelled. You can fill the form again when ready.');
        res.redirect('/distributor-applications/apply');
    } catch (error) {
        console.error('Error cancelling distributor payment:', error);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/distributor-applications/apply');
    }
});

// Admin routes
router.get('/admin', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const { status = 'all', search = '', city = '', state = '', date = '' } = req.query;
        let query = {};

        // Status Filter
        if (status !== 'all') {
            query.status = status;
        }

        // Search Filter (Company, Name, Email)
        if (search) {
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { user: { $in: userIds } }
            ];
        }

        // City Filter
        if (city) {
            query.location = { $regex: new RegExp('^' + city + ',', 'i') };
        }

        // State Filter
        if (state) {
            query.location = query.location
                ? { $regex: new RegExp('^' + city + ',.*' + state + '$', 'i') }
                : { $regex: new RegExp(', ' + state + '$', 'i') };
        }

        // Date Filter
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            query.createdAt = { $gte: start, $lt: end };
        }

        const applications = await DistributorApplication.find(query)
            .populate('user', 'name email profileImage')
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 });

        // Get unique cities and states from ALL applications for filters
        const allApplications = await DistributorApplication.find({}, 'location');
        const uniqueStates = [...new Set(allApplications.map(app => {
            const parts = app.location.split(', ');
            return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean))].sort();

        const uniqueCities = [...new Set(allApplications.map(app => {
            const parts = app.location.split(', ');
            return parts[0];
        }).filter(Boolean))].sort();

        const stats = {
            total: await DistributorApplication.countDocuments(),
            pending: await DistributorApplication.countDocuments({ status: 'pending' }),
            approved: await DistributorApplication.countDocuments({ status: 'approved' }),
            rejected: await DistributorApplication.countDocuments({ status: 'rejected' })
        };

        res.render('admin/distributor-applications', {
            layout: 'admin',
            title: 'Distributor Applications',
            currentPath: '/distributor-applications/admin',
            applications,
            stats,
            selectedStatus: status,
            filters: { search, city, state, date },
            uniqueStates,
            uniqueCities
        });
    } catch (error) {
        console.error('Admin distributor applications error:', error);
        req.flash('error', 'Failed to load distributor applications');
        res.redirect('/admin');
    }
});

// GET - Admin: View Active Distributors List
router.get('/admin/list', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const { search = '', city = '', state = '' } = req.query;
        const Role = require('../models/Role');
        const UserRole = require('../models/UserRole');
        const User = require('../models/User');
        const DistributorApplication = require('../models/DistributorApplication');

        const distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
        if (!distributorRole) {
            return res.render('admin/distributors', {
                layout: 'admin',
                distributors: [],
                filters: { search, city, state },
                uniqueCities: [],
                uniqueStates: [],
                title: 'Active Distributors'
            });
        }

        // Find all users with distributor role
        let query = { role: distributorRole._id };
        const distributorUserRoles = await UserRole.find(query).populate('user');

        // Filter out null users and apply search if provided
        let distributors = await Promise.all(distributorUserRoles.map(async (ur) => {
            if (!ur.user) return null;

            // Get their approved application for more details
            const application = await DistributorApplication.findOne({
                user: ur.user._id,
                status: 'approved'
            }).sort({ updatedAt: -1 });

            return {
                ...ur.user.toObject(),
                application: application || null,
                detailsUrl: `/distributor-applications/admin/user/${ur.user._id}`
            };
        }));

        distributors = distributors.filter(Boolean);

        // Get unique cities and states for filters
        const allApprovedApps = await DistributorApplication.find({ status: 'approved' }, 'location');
        const uniqueCities = [...new Set(allApprovedApps.map(app => {
            const parts = app.location.split(', ');
            return parts[0];
        }).filter(Boolean))].sort();

        const uniqueStates = [...new Set(allApprovedApps.map(app => {
            const parts = app.location.split(', ');
            return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean))].sort();

        // Apply filters
        if (search) {
            const searchLower = search.toLowerCase();
            distributors = distributors.filter(d =>
                d.name.toLowerCase().includes(searchLower) ||
                d.email.toLowerCase().includes(searchLower) ||
                (d.application && d.application.companyName && d.application.companyName.toLowerCase().includes(searchLower)) ||
                (!d.application && "individual".includes(searchLower))
            );
        }

        if (city) {
            const cityLower = city.toLowerCase();
            distributors = distributors.filter(d =>
                (d.city && d.city.toLowerCase() === cityLower) ||
                (d.application && d.application.location && d.application.location.toLowerCase().includes(cityLower))
            );
        }

        if (state) {
            const stateLower = state.toLowerCase();
            distributors = distributors.filter(d =>
                (d.state && d.state.toLowerCase() === stateLower) ||
                (d.application && d.application.location && d.application.location.toLowerCase().endsWith(stateLower))
            );
        }

        res.render('admin/distributors', {
            layout: 'admin',
            distributors,
            title: 'Active Distributors',
            filters: { search, city, state },
            uniqueCities,
            uniqueStates,
            currentPath: '/distributor-applications/admin/list'
        });
    } catch (error) {
        console.error('Error fetching distributors list:', error);
        req.flash('error', 'Failed to load distributors');
        res.redirect('/admin');
    }
});

// POST - Admin: Revoke Distributor Role
router.post('/admin/revoke/:id', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const Role = require('../models/Role');
        const UserRole = require('../models/UserRole');

        const distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
        if (!distributorRole) {
            req.flash('error', 'Distributor role not found');
            return res.redirect('/distributor-applications/admin/list');
        }

        await UserRole.findOneAndDelete({
            user: req.params.id,
            role: distributorRole._id
        });

        // Optionally update the application status back to pending or something?
        // For now just removing role is enough to "delete" them from active list

        req.flash('success', 'Distributor role revoked successfully');
        res.redirect('/distributor-applications/admin/list');
    } catch (error) {
        console.error('Revoke distributor error:', error);
        req.flash('error', 'Failed to revoke distributor role');
        res.redirect('/distributor-applications/admin/list');
    }
});

// GET - Admin: View Distributor Details by User ID (Handles Manual Additions)
router.get('/admin/user/:userId', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.params.userId);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/distributor-applications/admin/list');
        }

        let application = await DistributorApplication.findOne({ user: user._id }).sort({ createdAt: -1 })
            .populate('user', 'name email profileImage')
            .populate('reviewedBy', 'name email');

        if (!application) {
            // Create a virtual application object for manual distributors
            application = {
                user: user,
                companyName: 'Individual / Manual Entry',
                mobileNumber: 'Not Provided',
                location: user.city || 'India',
                experience: 'This distributor was manually added by an Administrator.',
                platforms: ['All Standard Platforms'],
                status: 'approved',
                paymentStatus: 'n/a',
                registrationFee: 0,
                idProofUrl: user.profileImage || '/images/default-profile.svg',
                idProofType: 'Not Required (Admin Verified)',
                isManual: true,
                createdAt: user.createdAt
            };
        }

        res.render('admin/distributor-application-details', {
            layout: 'admin',
            title: 'Distributor Details',
            currentPath: '/distributor-applications/admin/list',
            application
        });
    } catch (error) {
        console.error('Error viewing distributor user details:', error);
        req.flash('error', 'Failed to load distributor details');
        res.redirect('/distributor-applications/admin/list');
    }
});

// GET - Admin: View Distributor Application Details (By App ID)
router.get('/admin/:id', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const application = await DistributorApplication.findById(req.params.id)
            .populate('user', 'name email profileImage')
            .populate('reviewedBy', 'name email');

        if (!application) {
            req.flash('error', 'Application not found');
            return res.redirect('/distributor-applications/admin');
        }

        res.render('admin/distributor-application-details', {
            layout: 'admin',
            title: 'Distributor Details',
            currentPath: '/distributor-applications/admin',
            application
        });
    } catch (error) {
        console.error('Admin view distributor details error:', error);
        req.flash('error', 'Failed to load application details');
        res.redirect('/distributor-applications/admin');
    }
});

router.post('/admin/:id/approve', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const { adminNotes } = req.body;
        const application = await DistributorApplication.findById(req.params.id).populate('user');

        if (!application) {
            req.flash('error', 'Application not found');
            return res.redirect('/distributor-applications/admin');
        }

        const distributorRole = await ensureDistributorRole(req.session.user.id);
        await UserRole.findOneAndUpdate(
            { user: application.user._id, role: distributorRole._id },
            { user: application.user._id, role: distributorRole._id },
            { upsert: true }
        );

        application.status = 'approved';
        application.adminNotes = adminNotes || '';
        application.reviewedBy = req.session.user.id;
        application.reviewedAt = new Date();
        await application.save();

        await sendDistributorStatusEmail(application.user, 'approved', application.adminNotes);

        req.flash('success', 'Distributor application approved successfully');
        res.redirect('/distributor-applications/admin');
    } catch (error) {
        console.error('Approve distributor error:', error);
        req.flash('error', 'Failed to approve application');
        res.redirect('/distributor-applications/admin');
    }
});

router.post('/admin/:id/reject', isLoggedIn, hasAdminPermission('manage_distributor_applications'), async (req, res) => {
    try {
        const { adminNotes } = req.body;
        const application = await DistributorApplication.findById(req.params.id).populate('user');

        if (!application) {
            req.flash('error', 'Application not found');
            return res.redirect('/distributor-applications/admin');
        }

        application.status = 'rejected';
        application.adminNotes = adminNotes || '';
        application.reviewedBy = req.session.user.id;
        application.reviewedAt = new Date();
        await application.save();

        await sendDistributorStatusEmail(application.user, 'rejected', application.adminNotes);

        req.flash('success', 'Distributor application rejected');
        res.redirect('/distributor-applications/admin');
    } catch (error) {
        console.error('Reject distributor error:', error);
        req.flash('error', 'Failed to reject application');
        res.redirect('/distributor-applications/admin');
    }
});

module.exports = router;
