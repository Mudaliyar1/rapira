const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ProducerApplication = require('../models/ProducerApplication');
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

async function ensureProducerRole(adminUserId = null) {
  let role = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
  if (!role) {
    role = new Role({
      name: 'Producer',
      description: 'Music producer role with artist messaging access',
      icon: 'bi-mic-fill',
      createdBy: adminUserId
    });
    await role.save();
  }
  return role;
}

async function sendProducerStatusEmail(user, status, adminNotes = '') {
  const isApproved = status === 'approved';
  const subject = isApproved
    ? 'Your Producer Application Has Been Approved'
    : 'Your Producer Application Has Been Rejected';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
      <h2>${isApproved ? 'Producer Application Approved' : 'Producer Application Rejected'}</h2>
      <p>Hello ${user.name},</p>
      <p>Your producer application on Rapira has been <strong>${status}</strong>.</p>
      ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      <p>${isApproved ? 'You can now access your Producer Dashboard and message artists.' : 'You can update your details and apply again later.'}</p>
      <p>Regards,<br/>Rapira Team</p>
    </div>
  `;

  const textContent = `Hello ${user.name}, your producer application has been ${status}. ${adminNotes ? `Admin notes: ${adminNotes}` : ''}`;

  try {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject,
      htmlContent,
      textContent
    });
  } catch (error) {
    console.error('Failed to send producer status email:', error.message);
  }
}

async function notifyAdminsAboutProducerApplication(user) {
  // Admin notifications disabled as requested
  /*
  try {
    const admins = await User.find({ role: 'admin' }).select('email name');
    if (!admins.length) return;

    const baseUrl = process.env.BASE_URL || '';
    const reviewUrl = `${baseUrl}/producer-applications/admin`;

    await Promise.all(admins.map((admin) => sendEmail({
      to: admin.email,
      toName: admin.name,
      subject: 'New Producer Application Submitted',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
          <h2>New Producer Application</h2>
          <p><strong>${user.name}</strong> (${user.email}) submitted a new producer application.</p>
          <p><a href="${reviewUrl}">Review Applications</a></p>
        </div>
      `,
      textContent: `New producer application submitted by ${user.name} (${user.email}). Review at ${reviewUrl}`
    })));
  } catch (error) {
    console.error('Failed to notify admins for producer application:', error.message);
  }
  */
}

router.get('/apply', isLoggedIn, async (req, res) => {
  try {
    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const hasProducerRole = producerRole
      ? await UserRole.exists({ user: req.session.user.id, role: producerRole._id })
      : false;

    if (hasProducerRole) {
      req.flash('info', 'You already have producer access.');
      return res.redirect('/producer-dashboard');
    }

    const pendingApplication = await ProducerApplication.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (pendingApplication) {
      req.flash('info', 'You already have a pending producer application.');
      return res.redirect('/producer-applications/status');
    }

    res.render('producer-applications/apply', {
      title: 'Apply as Producer'
    });
  } catch (error) {
    console.error('Producer apply page error:', error);
    req.flash('error', 'Failed to load producer application form');
    res.redirect('/users/profile');
  }
});

router.post('/apply', isLoggedIn, upload.single('idProofFile'), async (req, res) => {
  try {
    const {
      mobileNumber,
      yearsOfExperience,
      instagramLink,
      youtubeLink,
      skills,
      services,
      location,
      idProofType,
      agreedToTerms
    } = req.body;

    if (!mobileNumber || !yearsOfExperience || !skills || !services || !location || !idProofType) {
      req.flash('error', 'Please fill all required fields');
      return res.redirect('/producer-applications/apply');
    }

    if (!/^\d{10}$/.test(mobileNumber)) {
      req.flash('error', 'Mobile number must be exactly 10 digits');
      return res.redirect('/producer-applications/apply');
    }

    if (!req.file) {
      req.flash('error', 'Please upload one ID proof file');
      return res.redirect('/producer-applications/apply');
    }

    if (agreedToTerms !== 'on') {
      req.flash('error', 'You must agree to terms and conditions');
      return res.redirect('/producer-applications/apply');
    }

    const existingPending = await ProducerApplication.findOne({
      user: req.session.user.id,
      status: 'pending'
    });

    if (existingPending) {
      req.flash('info', 'You already have a pending producer application.');
      return res.redirect('/producer-applications/status');
    }

    const { media } = await uploadFileToCloudinary(req.file, {
      module: 'producerApplication',
      ownerType: 'user',
      ownerId: req.session.user.id,
      folder: 'rapira/producer-applications/proofs'
    });
    // Get registration fee from settings
    const settings = await WebsiteSettings.getSettings();
    const fee = settings.registrationFees ? settings.registrationFees.producerRegistrationFee : 0;

    const application = new ProducerApplication({
      user: req.session.user.id,
      mobileNumber,
      yearsOfExperience: Number(yearsOfExperience),
      instagramLink: instagramLink || '',
      youtubeLink: youtubeLink || '',
      skills,
      services,
      location,
      idProofType,
      idProofUrl: media.secure_url,
      idProofMedia: media._id,
      agreedToTerms: true,
      status: 'pending',
      registrationFee: fee,
      paymentStatus: fee > 0 ? 'pending' : 'n/a'
    });

    await application.save();

    // If fee required, redirect to payment page
    if (fee > 0) {
      return res.redirect(`/producer-applications/payment/${application._id}`);
    }

    // No fee — notify and go to status
    try {
      const user = await User.findById(req.session.user.id);
      if (user) {
        await notifyAdminsAboutProducerApplication(user);
      }
    } catch (e) { console.error('Notification error:', e); }

    req.flash('success', 'Producer application submitted successfully. You will receive an email after review.');
    res.redirect('/producer-applications/status');
  } catch (error) {
    console.error('Producer apply submit error:', error);
    req.flash('error', 'Failed to submit producer application');
    res.redirect('/producer-applications/apply');
  }
});

// Payment page for producer registration (standalone - no layout)
router.get('/payment/:id', isLoggedIn, async (req, res) => {
  try {
    const application = await ProducerApplication.findById(req.params.id);

    if (!application || application.user.toString() !== req.session.user.id) {
      req.flash('error', 'Application not found');
      return res.redirect('/producer-applications/status');
    }

    if (application.paymentStatus === 'paid') {
      req.flash('info', 'Payment already completed');
      return res.redirect('/producer-applications/status');
    }

    const orderResult = await createOrder({
      amount: application.registrationFee,
      receipt: `prod_reg_${application._id}`,
      notes: {
        applicationId: application._id.toString(),
        type: 'producer_registration',
        userId: req.session.user.id
      }
    });

    if (!orderResult.success) {
      req.flash('error', 'Failed to create payment order. Please try again.');
      return res.redirect('/producer-applications/status');
    }

    application.razorpayOrderId = orderResult.data.id;
    await application.save();

    res.render('producer-applications/payment', {
      layout: false,
      application,
      order: orderResult.data,
      keyId: process.env.RAZORPAY_KEY_ID,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Error loading payment page:', error);
    req.flash('error', 'Failed to load payment page');
    res.redirect('/producer-applications/status');
  }
});

// Verify producer registration payment
router.post('/verify-payment/:id', isLoggedIn, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const application = await ProducerApplication.findById(req.params.id);

    if (!application) {
      req.flash('error', 'Application not found');
      return res.redirect('/producer-applications/status');
    }

    const verification = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (verification.success) {
      application.paymentStatus = 'paid';
      application.razorpayPaymentId = razorpay_payment_id;
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
        sourceModel: 'ProducerApplication',
        sourceId: application._id,
        description: `Producer registration fee`
      });

      try {
        const user = await User.findById(req.session.user.id);
        if (user) {
          await notifyAdminsAboutProducerApplication(user);
        }
      } catch (e) { console.error('Post-payment notification error:', e); }

      req.flash('success', 'Payment successful! Your application is now under review.');
      return res.redirect('/producer-applications/status');
    } else {
      application.paymentStatus = 'failed';
      await application.save();
      req.flash('error', 'Payment verification failed. Please try again.');
      return res.redirect(`/producer-applications/payment/${application._id}`);
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    req.flash('error', 'Payment verification error. Please contact support.');
    res.redirect('/producer-applications/status');
  }
});

// Cancel payment - delete unpaid application and go back to apply form
router.get('/cancel-payment/:id', isLoggedIn, async (req, res) => {
  try {
    const application = await ProducerApplication.findById(req.params.id);

    if (application && application.user.toString() === req.session.user.id && application.paymentStatus !== 'paid') {
      await ProducerApplication.findByIdAndDelete(req.params.id);
      console.log(`Deleted unpaid producer application: ${req.params.id}`);
    }

    req.flash('error', 'Payment was cancelled. Please fill the form and try again.');
    res.redirect('/producer-applications/apply');
  } catch (error) {
    console.error('Error cancelling payment:', error);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/producer-applications/apply');
  }
});

router.get('/status', isLoggedIn, async (req, res) => {
  try {
    const applications = await ProducerApplication.find({ user: req.session.user.id })
      .sort({ createdAt: -1 });

    res.render('producer-applications/status', {
      title: 'Producer Application Status',
      applications
    });
  } catch (error) {
    console.error('Producer status error:', error);
    req.flash('error', 'Failed to load producer application status');
    res.redirect('/users/profile');
  }
});

router.get('/admin', isLoggedIn, hasAdminPermission('manage_producer_applications'), async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const filter = status === 'all' ? {} : { status };

    const applications = await ProducerApplication.find(filter)
      .populate('user', 'name email profileImage')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    const stats = {
      total: await ProducerApplication.countDocuments(),
      pending: await ProducerApplication.countDocuments({ status: 'pending' }),
      approved: await ProducerApplication.countDocuments({ status: 'approved' }),
      rejected: await ProducerApplication.countDocuments({ status: 'rejected' })
    };

    res.render('admin/producer-applications', {
      layout: 'admin',
      title: 'Producer Applications',
      currentPath: '/producer-applications/admin',
      applications,
      stats,
      selectedStatus: status
    });
  } catch (error) {
    console.error('Admin producer applications error:', error);
    req.flash('error', 'Failed to load producer applications');
    res.redirect('/admin');
  }
});

router.post('/admin/delete-all', isLoggedIn, hasAdminPermission('manage_producer_applications'), async (req, res) => {
  try {
    const result = await ProducerApplication.deleteMany({});
    req.flash('success', `Deleted ${result.deletedCount} producer application record(s)`);
    res.redirect('/producer-applications/admin');
  } catch (error) {
    console.error('Delete all producer applications error:', error);
    req.flash('error', 'Failed to delete producer application history');
    res.redirect('/producer-applications/admin');
  }
});

router.get('/admin/:id', isLoggedIn, hasAdminPermission('manage_producer_applications'), async (req, res) => {
  try {
    const application = await ProducerApplication.findById(req.params.id)
      .populate('user', 'name email profileImage phone')
      .populate('reviewedBy', 'name email')
      .populate('idProofMedia');

    if (!application) {
      req.flash('error', 'Producer application not found');
      return res.redirect('/producer-applications/admin');
    }

    res.render('admin/producer-application-details', {
      layout: 'admin',
      title: 'Producer Application Details',
      currentPath: '/producer-applications/admin',
      application
    });
  } catch (error) {
    console.error('Admin producer application details error:', error);
    req.flash('error', 'Failed to load producer application details');
    res.redirect('/producer-applications/admin');
  }
});

router.post('/admin/:id/approve', isLoggedIn, hasAdminPermission('manage_producer_applications'), async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const application = await ProducerApplication.findById(req.params.id).populate('user');

    if (!application) {
      req.flash('error', 'Producer application not found');
      return res.redirect('/producer-applications/admin');
    }

    if (application.status !== 'pending') {
      req.flash('error', 'This application has already been processed');
      return res.redirect(`/producer-applications/admin/${application._id}`);
    }

    const producerRole = await ensureProducerRole(req.session.user.id);
    await UserRole.findOneAndUpdate(
      { user: application.user._id, role: producerRole._id },
      { user: application.user._id, role: producerRole._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    application.status = 'approved';
    application.adminNotes = adminNotes || '';
    application.reviewedBy = req.session.user.id;
    application.reviewedAt = new Date();
    await application.save();

    await sendProducerStatusEmail(application.user, 'approved', application.adminNotes);

    req.flash('success', 'Producer application approved successfully');
    res.redirect('/producer-applications/admin');
  } catch (error) {
    console.error('Approve producer application error:', error);
    req.flash('error', 'Failed to approve producer application');
    res.redirect(`/producer-applications/admin/${req.params.id}`);
  }
});

router.post('/admin/:id/reject', isLoggedIn, hasAdminPermission('manage_producer_applications'), async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const application = await ProducerApplication.findById(req.params.id).populate('user');

    if (!application) {
      req.flash('error', 'Producer application not found');
      return res.redirect('/producer-applications/admin');
    }

    if (application.status !== 'pending') {
      req.flash('error', 'This application has already been processed');
      return res.redirect(`/producer-applications/admin/${application._id}`);
    }

    if (!adminNotes || !adminNotes.trim()) {
      req.flash('error', 'Please add a rejection reason in admin notes');
      return res.redirect(`/producer-applications/admin/${application._id}`);
    }

    application.status = 'rejected';
    application.adminNotes = adminNotes.trim();
    application.reviewedBy = req.session.user.id;
    application.reviewedAt = new Date();
    await application.save();

    await sendProducerStatusEmail(application.user, 'rejected', application.adminNotes);

    req.flash('success', 'Producer application rejected successfully');
    res.redirect('/producer-applications/admin');
  } catch (error) {
    console.error('Reject producer application error:', error);
    req.flash('error', 'Failed to reject producer application');
    res.redirect(`/producer-applications/admin/${req.params.id}`);
  }
});

router.post('/admin/:id/delete', isLoggedIn, hasAdminPermission('manage_producer_applications'), async (req, res) => {
  try {
    const deletedApplication = await ProducerApplication.findByIdAndDelete(req.params.id);

    if (!deletedApplication) {
      req.flash('error', 'Producer application not found');
      return res.redirect('/producer-applications/admin');
    }

    req.flash('success', 'Producer application record deleted successfully');
    res.redirect('/producer-applications/admin');
  } catch (error) {
    console.error('Delete producer application error:', error);
    req.flash('error', 'Failed to delete producer application record');
    res.redirect('/producer-applications/admin');
  }
});

module.exports = router;
