const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Public routes

// View a page by slug
router.get('/:slug', async (req, res) => {
  try {
    const page = await Page.findOne({ 
      slug: req.params.slug,
      status: 'published'
    });
    
    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/');
    }
    
    res.render('pages/show', { page });
  } catch (error) {
    console.error('View page error:', error);
    req.flash('error', 'Failed to load page');
    res.redirect('/');
  }
});

// Admin routes

// List all pages (admin)
router.get('/admin/pages', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const pages = await Page.find().sort({ order: 1, title: 1 });
    res.render('admin/pages/index', { pages, path: '/admin/pages' });
  } catch (error) {
    console.error('List pages error:', error);
    req.flash('error', 'Failed to load pages');
    res.redirect('/admin');
  }
});

// Add page form (admin)
router.get('/admin/pages/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/pages/add', { path: '/admin/pages' });
});

// Add page process (admin)
router.post('/admin/pages/add', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { title, slug, content, metaTitle, metaDescription, status, featured, order } = req.body;
    
    // Validate input
    if (!title || !slug || !content) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/pages/add');
    }
    
    // Check if slug already exists
    const existingPage = await Page.findOne({ slug });
    if (existingPage) {
      req.flash('error', 'A page with this slug already exists');
      return res.redirect('/admin/pages/add');
    }
    
    // Create page
    const newPage = new Page({
      title,
      slug,
      content,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || '',
      status: status || 'published',
      featured: featured === 'on',
      order: order || 0,
      createdBy: req.session.user.id
    });
    
    await newPage.save();
    
    req.flash('success', 'Page created successfully');
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('Add page error:', error);
    req.flash('error', 'Failed to create page');
    res.redirect('/admin/pages/add');
  }
});

// Edit page form (admin)
router.get('/admin/pages/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    
    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/admin/pages');
    }
    
    res.render('admin/pages/edit', { page, path: '/admin/pages' });
  } catch (error) {
    console.error('Edit page error:', error);
    req.flash('error', 'Failed to load page');
    res.redirect('/admin/pages');
  }
});

// Update page (admin)
router.post('/admin/pages/:id/update', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { title, slug, content, metaTitle, metaDescription, status, featured, order } = req.body;
    
    // Validate input
    if (!title || !slug || !content) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/admin/pages/${req.params.id}/edit`);
    }
    
    // Find page
    const page = await Page.findById(req.params.id);
    
    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/admin/pages');
    }
    
    // Check if slug already exists (if changed)
    if (slug !== page.slug) {
      const existingPage = await Page.findOne({ slug });
      if (existingPage) {
        req.flash('error', 'A page with this slug already exists');
        return res.redirect(`/admin/pages/${req.params.id}/edit`);
      }
    }
    
    // Update page
    page.title = title;
    page.slug = slug;
    page.content = content;
    page.metaTitle = metaTitle || title;
    page.metaDescription = metaDescription || '';
    page.status = status || 'published';
    page.featured = featured === 'on';
    page.order = order || 0;
    page.updatedBy = req.session.user.id;
    
    await page.save();
    
    req.flash('success', 'Page updated successfully');
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('Update page error:', error);
    req.flash('error', 'Failed to update page');
    res.redirect(`/admin/pages/${req.params.id}/edit`);
  }
});

// Delete page (admin)
router.post('/admin/pages/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    
    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/admin/pages');
    }
    
    await Page.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Page deleted successfully');
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('Delete page error:', error);
    req.flash('error', 'Failed to delete page');
    res.redirect('/admin/pages');
  }
});

module.exports = router;
