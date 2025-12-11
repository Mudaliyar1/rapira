const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const methodOverride = require('method-override');
const TeamUpdate = require('../models/TeamUpdate');
const TeamComment = require('../models/TeamComment');
const User = require('../models/User');
const Media = require('../models/Media');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

// Enable method override for PUT and DELETE requests
router.use(methodOverride('_method'));

// Configure multer for file uploads (memory → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow documents, images, and common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|xlsx|xls|ppt|pptx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only documents, images, and office files are allowed!'));
    }
  }
});

// GET /admin/team-updates - List all team updates
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const {
      type = 'all',
      category = 'all',
      priority = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    let filter = {};
    
    if (type !== 'all') filter.type = type;
    if (category !== 'all') filter.category = category;
    if (priority !== 'all') filter.priority = priority;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Get updates with pagination
    const updates = await TeamUpdate.find(filter)
      .populate('createdBy', 'name email profileImage')
      .populate('updatedBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limit);

    const totalUpdates = await TeamUpdate.countDocuments(filter);
    const totalPages = Math.ceil(totalUpdates / limit);

    // Get statistics
    const stats = await TeamUpdate.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
          pinned: { $sum: { $cond: ['$isPinned', 1, 0] } },
          thisWeek: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.render('admin/team-updates/index', {
      layout: 'admin',
      title: 'Team Updates',
      currentPath: '/admin/team-updates',
      updates,
      pagination: {
        current: page,
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        next: page + 1,
        prev: page - 1
      },
      filters: { type, category, priority, search, sortBy, sortOrder },
      stats: stats[0] || { total: 0, urgent: 0, pinned: 0, thisWeek: 0 },
      totalUpdates
    });
  } catch (error) {
    console.error('Team updates list error:', error);
    req.flash('error', 'Failed to load team updates');
    res.redirect('/admin');
  }
});

// GET /admin/team-updates/create - Show create form
router.get('/create', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all admin users for meeting attendees
    const adminUsers = await User.find({ 
      role: { $in: ['admin', 'superAdmin'] } 
    }).select('name email').sort({ name: 1 });

    res.render('admin/team-updates/create', {
      layout: 'admin',
      title: 'Create Team Update',
      currentPath: '/admin/team-updates',
      adminUsers
    });
  } catch (error) {
    console.error('Team updates create form error:', error);
    req.flash('error', 'Failed to load create form');
    res.redirect('/admin/team-updates');
  }
});

// POST /admin/team-updates - Create new team update
router.post('/', isLoggedIn, isAdmin, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      title,
      content,
      type,
      priority,
      category,
      tags,
      targetAudience,
      specificRoles,
      isPinned,
      expiresAt,
      meetingDate,
      meetingAttendees,
      actionItems,
      allowComments
    } = req.body;

    // Process attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const { media } = await uploadFileToCloudinary(file, {
            module: 'teamUpdates',
            ownerType: 'admin',
            ownerId: req.session.user.id,
            folder: 'rapira/admin/team-updates'
          });
          if (media) {
            attachments.push({
              filename: media.public_id,
              originalName: file.originalname,
              path: media.secure_url,
              size: file.size,
              mimetype: file.mimetype,
              mediaId: media._id
            });
          }
        } catch (err) {
          console.error('Error uploading team update attachment:', err.message);
          // Continue without blocking
        }
      }
    }

    // Process action items
    let processedActionItems = [];
    if (actionItems && Array.isArray(actionItems)) {
      processedActionItems = actionItems.map(item => ({
        task: item.task,
        assignedTo: item.assignedTo || null,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        status: 'pending'
      })).filter(item => item.task && item.task.trim());
    }

    const teamUpdate = new TeamUpdate({
      title,
      content,
      type,
      priority: priority || 'normal',
      category: category || 'company_wide',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      targetAudience: targetAudience || 'all_admins',
      specificRoles: specificRoles || [],
      isPinned: isPinned === 'on',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      meetingDate: meetingDate ? new Date(meetingDate) : null,
      meetingAttendees: meetingAttendees || [],
      actionItems: processedActionItems,
      allowComments: allowComments !== 'off',
      attachments,
      createdBy: req.session.user.id
    });

    await teamUpdate.save();

    req.flash('success', 'Team update created successfully!');
    res.redirect('/admin/team-updates');
  } catch (error) {
    console.error('Team update creation error:', error);
    req.flash('error', 'Failed to create team update: ' + error.message);
    res.redirect('/admin/team-updates/create');
  }
});

// GET /admin/team-updates/:id - View single update
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const update = await TeamUpdate.findById(req.params.id)
      .populate('createdBy', 'name email profileImage role')
      .populate('updatedBy', 'name email profileImage')
      .populate('meetingAttendees', 'name email profileImage')
      .populate('actionItems.assignedTo', 'name email profileImage')
      .populate('views.user', 'name email profileImage')
      .populate('reactions.user', 'name email profileImage');

    if (!update) {
      req.flash('error', 'Team update not found');
      return res.redirect('/admin/team-updates');
    }

    // Mark as read by current user
    await update.markAsRead(req.session.user.id);

    // Get comments
    const comments = await TeamComment.getCommentsForUpdate(update._id);

    res.render('admin/team-updates/view', {
      layout: 'admin',
      title: update.title,
      currentPath: '/admin/team-updates',
      update,
      comments,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Team update view error:', error);
    req.flash('error', 'Failed to load team update');
    res.redirect('/admin/team-updates');
  }
});

// POST /admin/team-updates/:id/react - Add reaction to update
router.post('/:id/react', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { reactionType } = req.body;
    const update = await TeamUpdate.findById(req.params.id);

    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    await update.addReaction(req.session.user.id, reactionType);

    res.json({ success: true, message: 'Reaction added successfully' });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// POST /admin/team-updates/:id/comments - Add comment to update
router.post('/:id/comments', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { content, parentComment } = req.body;

    const comment = new TeamComment({
      update: req.params.id,
      author: req.session.user.id,
      content,
      parentComment: parentComment || null
    });

    await comment.save();

    req.flash('success', 'Comment added successfully');
    res.redirect(`/admin/team-updates/${req.params.id}`);
  } catch (error) {
    console.error('Add comment error:', error);
    req.flash('error', 'Failed to add comment');
    res.redirect(`/admin/team-updates/${req.params.id}`);
  }
});

// PUT /admin/team-updates/:id/action-items/:actionId - Update action item status
router.put('/:id/action-items/:actionId', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const update = await TeamUpdate.findById(req.params.id);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    const actionItem = update.actionItems.id(req.params.actionId);
    if (!actionItem) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    actionItem.status = status;
    await update.save();

    res.json({ success: true, message: 'Action item updated successfully' });
  } catch (error) {
    console.error('Update action item error:', error);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// GET /admin/team-updates/:id/edit - Show edit form
router.get('/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const update = await TeamUpdate.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('meetingAttendees', 'name email')
      .populate('actionItems.assignedTo', 'name email');

    if (!update) {
      req.flash('error', 'Team update not found');
      return res.redirect('/admin/team-updates');
    }

    // Get all admin users for meeting attendees
    const adminUsers = await User.find({
      role: { $in: ['admin', 'superAdmin'] }
    }).select('name email').sort({ name: 1 });

    res.render('admin/team-updates/edit', {
      layout: 'admin',
      title: 'Edit Team Update',
      currentPath: '/admin/team-updates',
      update,
      adminUsers
    });
  } catch (error) {
    console.error('Team update edit form error:', error);
    req.flash('error', 'Failed to load edit form');
    res.redirect('/admin/team-updates');
  }
});

// PUT /admin/team-updates/:id - Update team update
router.put('/:id', isLoggedIn, isAdmin, upload.array('attachments', 5), async (req, res) => {
  try {
    const update = await TeamUpdate.findById(req.params.id);

    if (!update) {
      req.flash('error', 'Team update not found');
      return res.redirect('/admin/team-updates');
    }

    const {
      title,
      content,
      type,
      priority,
      category,
      tags,
      targetAudience,
      specificRoles,
      isPinned,
      expiresAt,
      meetingDate,
      meetingAttendees,
      actionItems,
      allowComments,
      removeAttachments
    } = req.body;

    // Process new attachments
    const newAttachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const { media } = await uploadFileToCloudinary(file, {
            module: 'teamUpdates',
            ownerType: 'admin',
            ownerId: req.session.user.id,
            folder: 'rapira/admin/team-updates'
          });
          if (media) {
            newAttachments.push({
              filename: media.public_id,
              originalName: file.originalname,
              path: media.secure_url,
              size: file.size,
              mimetype: file.mimetype,
              mediaId: media._id
            });
          }
        } catch (err) {
          console.error('Error uploading team update attachment:', err.message);
          // Continue without blocking
        }
      }
    }

    // Handle attachment removal
    let existingAttachments = update.attachments || [];
    if (removeAttachments && Array.isArray(removeAttachments)) {
      // Delete media from Cloudinary
      for (const attachmentId of removeAttachments) {
        const attachment = update.attachments.find(att => att._id.toString() === attachmentId);
        if (attachment && attachment.mediaId) {
          try {
            const mediaDoc = await Media.findById(attachment.mediaId);
            if (mediaDoc) {
              await deleteMedia(mediaDoc);
            }
          } catch (err) {
            console.error('Error deleting attachment media:', err.message);
          }
        }
      }
      
      existingAttachments = existingAttachments.filter(attachment =>
        !removeAttachments.includes(attachment._id.toString())
      );
    }

    // Process action items
    let processedActionItems = [];
    if (actionItems && Array.isArray(actionItems)) {
      processedActionItems = actionItems.map(item => ({
        task: item.task,
        assignedTo: item.assignedTo || null,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        status: item.status || 'pending',
        _id: item._id || undefined // Keep existing ID if updating
      })).filter(item => item.task && item.task.trim());
    }

    // Update the team update
    update.title = title;
    update.content = content;
    update.type = type;
    update.priority = priority || 'normal';
    update.category = category || 'company_wide';
    update.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    update.targetAudience = targetAudience || 'all_admins';
    update.specificRoles = specificRoles || [];
    update.isPinned = isPinned === 'on';
    update.expiresAt = expiresAt ? new Date(expiresAt) : null;
    update.meetingDate = meetingDate ? new Date(meetingDate) : null;
    update.meetingAttendees = meetingAttendees || [];
    update.actionItems = processedActionItems;
    update.allowComments = allowComments !== 'off';
    update.attachments = [...existingAttachments, ...newAttachments];
    update.updatedBy = req.session.user.id;

    await update.save();

    req.flash('success', 'Team update updated successfully!');
    res.redirect(`/admin/team-updates/${update._id}`);
  } catch (error) {
    console.error('Team update update error:', error);
    req.flash('error', 'Failed to update team update: ' + error.message);
    res.redirect(`/admin/team-updates/${req.params.id}/edit`);
  }
});

// DELETE /admin/team-updates/:id - Delete team update
router.delete('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const update = await TeamUpdate.findById(req.params.id);

    if (!update) {
      req.flash('error', 'Team update not found');
      return res.redirect('/admin/team-updates');
    }

    // Delete associated files
    if (update.attachments && update.attachments.length > 0) {
      update.attachments.forEach(attachment => {
        const filePath = path.join(__dirname, '../public', attachment.path);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    // Delete associated comments
    await TeamComment.deleteMany({ update: update._id });

    // Delete the update
    await TeamUpdate.findByIdAndDelete(req.params.id);

    req.flash('success', 'Team update deleted successfully!');
    res.redirect('/admin/team-updates');
  } catch (error) {
    console.error('Team update deletion error:', error);
    req.flash('error', 'Failed to delete team update: ' + error.message);
    res.redirect('/admin/team-updates');
  }
});

// GET /admin/team-updates/:id/delete - Show delete confirmation
router.get('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const update = await TeamUpdate.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!update) {
      req.flash('error', 'Team update not found');
      return res.redirect('/admin/team-updates');
    }

    res.render('admin/team-updates/delete', {
      layout: 'admin',
      title: 'Delete Team Update',
      currentPath: '/admin/team-updates',
      update
    });
  } catch (error) {
    console.error('Team update delete confirmation error:', error);
    req.flash('error', 'Failed to load delete confirmation');
    res.redirect('/admin/team-updates');
  }
});

// POST /admin/team-updates/:id/toggle-pin - Toggle pin status
router.post('/:id/toggle-pin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const update = await TeamUpdate.findById(req.params.id);

    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    update.isPinned = !update.isPinned;
    update.updatedBy = req.session.user.id;
    await update.save();

    res.json({
      success: true,
      isPinned: update.isPinned,
      message: update.isPinned ? 'Update pinned successfully' : 'Update unpinned successfully'
    });
  } catch (error) {
    console.error('Toggle pin error:', error);
    res.status(500).json({ error: 'Failed to toggle pin status' });
  }
});

// DELETE /admin/team-updates/:id/comments/:commentId - Delete comment
router.delete('/:id/comments/:commentId', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const comment = await TeamComment.findById(req.params.commentId);

    if (!comment) {
      req.flash('error', 'Comment not found');
      return res.redirect(`/admin/team-updates/${req.params.id}`);
    }

    // Check if user is the author or admin
    if (comment.author.toString() !== req.session.user.id && req.session.user.role !== 'superAdmin') {
      req.flash('error', 'You can only delete your own comments');
      return res.redirect(`/admin/team-updates/${req.params.id}`);
    }

    await comment.softDelete(req.session.user.id);

    req.flash('success', 'Comment deleted successfully');
    res.redirect(`/admin/team-updates/${req.params.id}`);
  } catch (error) {
    console.error('Delete comment error:', error);
    req.flash('error', 'Failed to delete comment');
    res.redirect(`/admin/team-updates/${req.params.id}`);
  }
});

module.exports = router;
