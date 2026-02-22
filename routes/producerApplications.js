const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ProducerApplication = require('../models/ProducerApplication');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { uploadFileToCloudinary } = require('../utils/mediaService');
const { sendEmail } = require('../utils/brevoEmailService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /image\/jpeg|image\/jpg|image\/png|application\/pdf/.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, and PDF files are allowed'));
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
      status: 'pending'
    });

    await application.save();

    const user = await User.findById(req.session.user.id);
    if (user) {
      await notifyAdminsAboutProducerApplication(user);
    }

    req.flash('success', 'Producer application submitted successfully. You will receive an email after review.');
    res.redirect('/producer-applications/status');
  } catch (error) {
    console.error('Producer apply submit error:', error);
    req.flash('error', 'Failed to submit producer application');
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

router.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
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

router.get('/admin/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const application = await ProducerApplication.findById(req.params.id)
      .populate('user', 'name email profileImage')
      .populate('reviewedBy', 'name email');

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

router.post('/admin/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
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

router.post('/admin/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
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

module.exports = router;
