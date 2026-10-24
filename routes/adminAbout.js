const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const TeamMember = require('../models/TeamMember');
const Media = require('../models/Media');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');

// Configure multer for team member image uploads (memory storage → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Apply middleware to all routes
router.use(isLoggedIn);
router.use(hasAdminPermission('manage_website_settings'));

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

    // Upload to Cloudinary if provided
    if (req.file) {
      try {
        const { media } = await uploadFileToCloudinary(req.file, {
          module: 'adminTeam',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: 'rapira/admin/team'
        });
        teamMemberData.media = media._id;
        teamMemberData.image = media.secure_url; // Cloud-first, legacy field for fallback
      } catch (err) {
        console.error('Cloud upload failed (team add):', err);
        req.flash('error', 'Image upload failed');
        return res.redirect('/admin/about/add');
      }
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
      try {
        // Remove previous Cloudinary asset if it exists
        if (teamMember.media) {
          const previous = await Media.findById(teamMember.media);
          await deleteMedia(previous);
        }

        const { media } = await uploadFileToCloudinary(req.file, {
          module: 'adminTeam',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: 'rapira/admin/team'
        });

        teamMember.media = media._id;
        teamMember.image = media.secure_url;
      } catch (err) {
        console.error('Cloud upload failed (team update):', err);
        req.flash('error', 'Image upload failed');
        return res.redirect(`/admin/about/edit/${req.params.id}`);
      }
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

    // Delete Cloudinary asset if present
    if (teamMember.media) {
      const media = await Media.findById(teamMember.media);
      await deleteMedia(media);
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
