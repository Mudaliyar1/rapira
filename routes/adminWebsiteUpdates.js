const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const WebsiteUpdate = require('../models/WebsiteUpdate');
const User = require('../models/User');

// GET /admin/website-updates - Show all website updates
router.get('/', isLoggedIn, hasAdminPermission('manage_website_updates'), async (req, res) => {
  try {
    const updates = await WebsiteUpdate.find()
      .populate('author', 'name email')
      .sort({ timestamp: -1 });

    res.render('admin/website-updates', {
      layout: 'admin',
      title: 'Website Updates',
      currentPath: '/admin/website-updates',
      updates
    });
  } catch (error) {
    console.error('Error loading website updates:', error);
    req.flash('error', 'Failed to load website updates');
    res.redirect('/admin');
  }
});

// GET /admin/website-updates/new - Show form to create new update
router.get('/new', isLoggedIn, hasAdminPermission('manage_website_updates'), (req, res) => {
  res.render('admin/website-updates-form', {
    layout: 'admin',
    title: 'Create Website Update',
    currentPath: '/admin/website-updates/new',
    update: null,
    isEdit: false
  });
});

// POST /admin/website-updates - Create new website update
router.post('/', isLoggedIn, hasAdminPermission('manage_website_updates'), async (req, res) => {
  try {
    const { title, description, content, priority, tags } = req.body;

    // Validate required fields
    if (!title || !description || !content) {
      req.flash('error', 'Title, description, and content are required');
      return res.redirect('/admin/website-updates/new');
    }

    const update = new WebsiteUpdate({
      title,
      description,
      content,
      priority: priority || 'medium',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      author: req.session.user.id
    });

    await update.save();

    req.flash('success', 'Website update created successfully');
    res.redirect('/admin/website-updates');
  } catch (error) {
    console.error('Error creating website update:', error);
    req.flash('error', 'Failed to create website update');
    res.redirect('/admin/website-updates/new');
  }
});

// GET /admin/website-updates/:id/edit - Show edit form
router.get('/:id/edit', isLoggedIn, hasAdminPermission('manage_website_updates'), async (req, res) => {
  try {
    const update = await WebsiteUpdate.findById(req.params.id);

    if (!update) {
      req.flash('error', 'Website update not found');
      return res.redirect('/admin/website-updates');
    }

    res.render('admin/website-updates-form', {
      layout: 'admin',
      title: 'Edit Website Update',
      currentPath: `/admin/website-updates/${req.params.id}/edit`,
      update,
      isEdit: true
    });
  } catch (error) {
    console.error('Error loading website update for edit:', error);
    req.flash('error', 'Failed to load website update');
    res.redirect('/admin/website-updates');
  }
});

// POST /admin/website-updates/:id - Update website update
router.post('/:id', isLoggedIn, hasAdminPermission('manage_website_updates'), async (req, res) => {
  try {
    const { title, description, content, priority, tags, isActive } = req.body;

    // Validate required fields
    if (!title || !description || !content) {
      req.flash('error', 'Title, description, and content are required');
      return res.redirect(`/admin/website-updates/${req.params.id}/edit`);
    }

    const update = await WebsiteUpdate.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        content,
        priority: priority || 'medium',
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        isActive: isActive === 'on',
        author: req.session.user.id
      },
      { new: true }
    );

    if (!update) {
      req.flash('error', 'Website update not found');
      return res.redirect('/admin/website-updates');
    }

    req.flash('success', 'Website update updated successfully');
    res.redirect('/admin/website-updates');
  } catch (error) {
    console.error('Error updating website update:', error);
    req.flash('error', 'Failed to update website update');
    res.redirect(`/admin/website-updates/${req.params.id}/edit`);
  }
});

// POST /admin/website-updates/:id/delete - Delete website update
router.post('/:id/delete', isLoggedIn, hasAdminPermission('manage_website_updates'), async (req, res) => {
  try {
    const update = await WebsiteUpdate.findByIdAndDelete(req.params.id);

    if (!update) {
      req.flash('error', 'Website update not found');
      return res.redirect('/admin/website-updates');
    }

    req.flash('success', 'Website update deleted successfully');
    res.redirect('/admin/website-updates');
  } catch (error) {
    console.error('Error deleting website update:', error);
    req.flash('error', 'Failed to delete website update');
    res.redirect('/admin/website-updates');
  }
});

module.exports = router;