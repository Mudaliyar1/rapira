const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TeamMember = require('../models/TeamMember');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Configure multer for team member image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads/team');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'team-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Apply middleware to all routes
router.use(isLoggedIn);
router.use(isAdmin);

// List all team members
router.get('/', async (req, res) => {
  try {
    const teamMembers = await TeamMember.find().sort({ order: 1, createdAt: 1 });
    res.render('admin/about/team-members', {
      teamMembers,
      title: 'Manage Team Members',
      layout: 'admin',
      currentPath: '/admin/about'
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    req.flash('error', 'Failed to load team members');
    res.redirect('/admin');
  }
});

// Show add team member form
router.get('/add', (req, res) => {
  res.render('admin/about/add-team-member', {
    title: 'Add Team Member',
    layout: 'admin',
    currentPath: '/admin/about'
  });
});

// Add new team member
router.post('/add', upload.single('image'), async (req, res) => {
  try {
    const { name, position, bio, linkedin, twitter, instagram, email, order } = req.body;

    // Validate required fields
    if (!name || !position || !bio) {
      req.flash('error', 'Name, position, and bio are required');
      return res.redirect('/admin/about/add');
    }

    const teamMemberData = {
      name,
      position,
      bio,
      socialLinks: {
        linkedin: linkedin || '',
        twitter: twitter || '',
        instagram: instagram || '',
        email: email || ''
      },
      order: parseInt(order) || 0
    };

    // Add image path if uploaded
    if (req.file) {
      teamMemberData.image = '/uploads/team/' + req.file.filename;
    }

    const teamMember = new TeamMember(teamMemberData);
    await teamMember.save();

    req.flash('success', 'Team member added successfully');
    res.redirect('/admin/about');
  } catch (error) {
    console.error('Error adding team member:', error);
    req.flash('error', 'Failed to add team member');
    res.redirect('/admin/about/add');
  }
});

// Show edit team member form
router.get('/edit/:id', async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    if (!teamMember) {
      req.flash('error', 'Team member not found');
      return res.redirect('/admin/about');
    }

    res.render('admin/about/edit-team-member', {
      teamMember,
      title: 'Edit Team Member',
      layout: 'layouts/admin',
      currentPath: '/admin/about'
    });
  } catch (error) {
    console.error('Error fetching team member:', error);
    req.flash('error', 'Failed to load team member');
    res.redirect('/admin/about');
  }
});

// Update team member
router.post('/edit/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, position, bio, linkedin, twitter, instagram, email, order } = req.body;
    const teamMember = await TeamMember.findById(req.params.id);

    if (!teamMember) {
      req.flash('error', 'Team member not found');
      return res.redirect('/admin/about');
    }

    // Validate required fields
    if (!name || !position || !bio) {
      req.flash('error', 'Name, position, and bio are required');
      return res.redirect(`/admin/about/edit/${req.params.id}`);
    }

    // Update fields
    teamMember.name = name;
    teamMember.position = position;
    teamMember.bio = bio;
    teamMember.socialLinks = {
      linkedin: linkedin || '',
      twitter: twitter || '',
      instagram: instagram || '',
      email: email || ''
    };
    teamMember.order = parseInt(order) || 0;

    // Update image if new one uploaded
    if (req.file) {
      // Delete old image if it's not the default
      if (teamMember.image && teamMember.image !== '/images/default-profile.jpg') {
        const oldImagePath = path.join(__dirname, '../public', teamMember.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      teamMember.image = '/uploads/team/' + req.file.filename;
    }

    await teamMember.save();

    req.flash('success', 'Team member updated successfully');
    res.redirect('/admin/about');
  } catch (error) {
    console.error('Error updating team member:', error);
    req.flash('error', 'Failed to update team member');
    res.redirect(`/admin/about/edit/${req.params.id}`);
  }
});

// Delete team member
router.post('/delete/:id', async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    if (!teamMember) {
      req.flash('error', 'Team member not found');
      return res.redirect('/admin/about');
    }

    // Delete image file if it's not the default
    if (teamMember.image && teamMember.image !== '/images/default-profile.jpg') {
      const imagePath = path.join(__dirname, '../public', teamMember.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await TeamMember.findByIdAndDelete(req.params.id);

    req.flash('success', 'Team member deleted successfully');
    res.redirect('/admin/about');
  } catch (error) {
    console.error('Error deleting team member:', error);
    req.flash('error', 'Failed to delete team member');
    res.redirect('/admin/about');
  }
});

// Toggle team member status
router.post('/toggle/:id', async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    if (!teamMember) {
      req.flash('error', 'Team member not found');
      return res.redirect('/admin/about');
    }

    teamMember.isActive = !teamMember.isActive;
    await teamMember.save();

    req.flash('success', `Team member ${teamMember.isActive ? 'activated' : 'deactivated'} successfully`);
    res.redirect('/admin/about');
  } catch (error) {
    console.error('Error toggling team member status:', error);
    req.flash('error', 'Failed to update team member status');
    res.redirect('/admin/about');
  }
});

module.exports = router;
