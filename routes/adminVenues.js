const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Concert = require('../models/Concert');
const Media = require('../models/Media');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

// Configure multer for venue image uploads (memory → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
  }
});

// GET /admin/venues - List all venues
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, city, state, type, active, verified, sortBy, sortOrder } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};

    // Search filter
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    // City filter
    if (city && city !== 'all') {
      filter.city = new RegExp(city, 'i');
    }

    // State filter
    if (state && state !== 'all') {
      filter.state = new RegExp(state, 'i');
    }

    // Type filter
    if (type && type !== 'all') {
      filter.venueType = type;
    }

    // Active filter
    if (active && active !== 'all') {
      filter.isActive = active === 'true';
    }

    // Verified filter
    if (verified && verified !== 'all') {
      filter.isVerified = verified === 'true';
    }

    // Build sort options
    let sortOptions = {};
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    } else {
      sortOptions = { createdAt: -1 };
    }

    // Execute query
    const venues = await Venue.find(filter)
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalVenues = await Venue.countDocuments(filter);
    const totalPages = Math.ceil(totalVenues / limit);

    // Get stats for dashboard
    const totalCount = await Venue.countDocuments();
    const activeCount = await Venue.countDocuments({ isActive: true });
    const verifiedCount = await Venue.countDocuments({ isVerified: true });

    // Get unique cities and states for filter dropdowns
    const allCities = await Venue.distinct('city');
    const allStates = await Venue.distinct('state');

    console.log('Venues found for admin:', venues.length);
    venues.forEach((venue, index) => {
      console.log(`Venue ${index + 1}:`, {
        id: venue._id,
        name: venue.name,
        isActive: venue.isActive,
        city: venue.city
      });
    });

    res.render('admin/venues/index', {
      layout: 'admin',
      currentPath: '/admin/venues',
      title: 'Venue Management',
      venues,
      pagination: {
        current: page,
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        next: page + 1,
        prev: page - 1
      },
      searchParams: {
        search: search || '',
        city: city || 'all',
        state: state || 'all',
        type: type || 'all',
        active: active || 'all',
        verified: verified || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalCount,
        active: activeCount,
        verified: verifiedCount,
        filtered: totalVenues
      },
      filterOptions: {
        cities: allCities.sort(),
        states: allStates.sort(),
        types: ['Indoor Hall', 'Outdoor Venue', 'Auditorium', 'Stadium', 'Club', 'Restaurant', 'Hotel', 'Community Center', 'Other']
      }
    });
  } catch (error) {
    console.error('List venues error:', error);
    req.flash('error', 'Failed to load venues');
    res.redirect('/admin');
  }
});

// GET /admin/venues/add - Add venue form
router.get('/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/venues/add', {
    layout: 'admin',
    currentPath: '/admin/venues',
    title: 'Add New Venue'
  });
});

// POST /admin/venues/add - Create new venue
router.post('/add', isLoggedIn, isAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const {
      name, address, city, state, pincode, capacity, venueType,
      facilities, contactName, contactPhone, contactEmail,
      priceRange, description, googleMapsLink, website,
      minimumHours, commissionPercentage, advanceAmount,
      minimumTicketPrice, suggestedTicketPrice
    } = req.body;

    // Validate required fields
    if (!name || !address || !city || !state || !pincode) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/venues/add');
    }

    // Process uploaded images
    const images = [];
    const imageMedia = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const { media } = await uploadFileToCloudinary(file, {
            module: 'venueMedia',
            ownerType: 'venue',
            folder: 'rapira/venues/images'
          });
          if (media) {
            images.push(media.secure_url);
            imageMedia.push(media._id);
          }
        } catch (err) {
          console.error('Error uploading venue image:', err.message);
          req.flash('warning', `Failed to upload one image: ${err.message}`);
        }
      }
    }

    // Process facilities (convert to array if it's a string)
    let facilitiesArray = [];
    if (facilities) {
      if (Array.isArray(facilities)) {
        facilitiesArray = facilities;
      } else {
        facilitiesArray = [facilities];
      }
    }

    // Process hourly rates with commission (1-24 hours)
    const hourlyRates = [];
    for (let i = 1; i <= 24; i++) {
      const rateKey = `hourlyRate_${i}`;
      const commissionKey = `commissionPercentage_${i}`;
      const rate = req.body[rateKey];
      const commissionPercentage = req.body[commissionKey];
      
      // Only add if both rate and commission are provided
      if (rate && parseFloat(rate) > 0 && commissionPercentage && parseFloat(commissionPercentage) >= 0) {
        const rateValue = parseFloat(rate);
        const commissionValue = parseFloat(commissionPercentage);
        const commissionAmount = (rateValue * commissionValue) / 100;
        
        hourlyRates.push({
          hours: i,
          rate: rateValue,
          commissionPercentage: commissionValue,
          commissionAmount: commissionAmount
        });
      }
    }

    // Create venue
    const venue = new Venue({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode ? pincode.trim() : '',
      capacity: capacity ? parseInt(capacity) : null,
      venueType: venueType || 'Indoor Hall',
      facilities: facilitiesArray,
      contactPerson: {
        name: contactName ? contactName.trim() : '',
        phone: contactPhone ? contactPhone.trim() : '',
        email: contactEmail ? contactEmail.trim().toLowerCase() : ''
      },
      priceRange: priceRange || 'Mid-Range',
      pricing: {
        hourlyRates: hourlyRates,
        minimumHours: minimumHours ? parseInt(minimumHours) : 1,
        currency: 'INR',
        ticketPricing: {
          minimumPrice: minimumTicketPrice ? parseFloat(minimumTicketPrice) : 0,
          suggestedPrice: suggestedTicketPrice ? parseFloat(suggestedTicketPrice) : 100
        }
      },
      description: description ? description.trim() : '',
      images: images,
      imageMedia: imageMedia,
      googleMapsLink: googleMapsLink ? googleMapsLink.trim() : '',
      website: website ? website.trim() : '',
      createdBy: req.session.user.id,
      lastUpdatedBy: req.session.user.id
    });

    await venue.save();

    req.flash('success', 'Venue added successfully');
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Add venue error:', error);
    req.flash('error', 'Failed to add venue. Please try again.');
    res.redirect('/admin/venues/add');
  }
});

// GET /admin/venues/:id/details - View venue details
router.get('/:id/details', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email');

    if (!venue) {
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    // Get concert count for this venue
    const concertCount = await Concert.countDocuments({ venue: venue._id });

    res.render('admin/venues/details', {
      layout: 'admin',
      currentPath: '/admin/venues',
      title: `${venue.name} - Details`,
      venue,
      concertCount
    });
  } catch (error) {
    console.error('View venue details error:', error);
    req.flash('error', 'Failed to load venue details');
    res.redirect('/admin/venues');
  }
});

// GET /admin/venues/:id/gallery - View venue image gallery
router.get('/:id/gallery', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    const startIndex = parseInt(req.query.index) || 0;

    res.render('admin/venues/gallery', {
      layout: 'admin',
      currentPath: '/admin/venues',
      title: `${venue.name} - Gallery`,
      venue,
      startIndex
    });
  } catch (error) {
    console.error('View venue gallery error:', error);
    req.flash('error', 'Failed to load venue gallery');
    res.redirect('/admin/venues');
  }
});

// GET /admin/venues/:id/edit - Edit venue form
router.get('/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const WebsiteSettings = require('../models/WebsiteSettings');
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    // Get website settings for commission defaults
    const settings = await WebsiteSettings.getSettings();
    const defaultCommissionPercentage = settings.venueSettings?.defaultCommissionPercentage || 10;
    const allowUserCommissionEdit = settings.venueSettings?.allowUserCommissionEdit || false;

    res.render('admin/venues/edit', {
      layout: 'admin',
      currentPath: '/admin/venues',
      title: `Edit ${venue.name}`,
      venue,
      defaultCommissionPercentage,
      allowUserCommissionEdit
    });
  } catch (error) {
    console.error('Edit venue form error:', error);
    req.flash('error', 'Failed to load venue for editing');
    res.redirect('/admin/venues');
  }
});

// POST /admin/venues/:id/edit - Update venue
router.post('/:id/edit', isLoggedIn, isAdmin, upload.array('images', 5), async (req, res) => {
  console.log('=== VENUE EDIT REQUEST START ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.originalUrl);
  console.log('Venue ID:', req.params.id);
  console.log('User session:', req.session.user ? req.session.user.id : 'No session');
  console.log('Form data keys:', Object.keys(req.body));
  console.log('Sample form data:', {
    name: req.body.name,
    city: req.body.city,
    hourlyRate1: req.body.hourlyRate1,
    hourlyRate2: req.body.hourlyRate2,
    hourlyRate3: req.body.hourlyRate3
  });
  
  try {
    const WebsiteSettings = require('../models/WebsiteSettings');
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      console.log('❌ Venue not found with ID:', req.params.id);
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    console.log('✅ Venue found:', venue.name);

    // Get website settings for commission defaults
    const settings = await WebsiteSettings.getSettings();
    const defaultCommissionPercentage = settings.venueSettings?.defaultCommissionPercentage || 10;
    const allowUserCommissionEdit = settings.venueSettings?.allowUserCommissionEdit || false;

    console.log('Commission settings - Default:', defaultCommissionPercentage, 'Allow Edit:', allowUserCommissionEdit);

    const {
      name, address, city, state, pincode, capacity, venueType,
      facilities, contactName, contactPhone, contactEmail,
      priceRange, description, googleMapsLink, website, removeImages,
      minimumHours, commissionPercentage, advanceAmount, 
      minTicketPrice, suggestedTicketPrice
    } = req.body;

    // Validate required fields
    if (!name || !address || !city || !state || !pincode) {
      console.log('Validation failed - missing required fields:', { name: !!name, address: !!address, city: !!city, state: !!state, pincode: !!pincode });
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/admin/venues/${req.params.id}/edit`);
    }
    
    console.log('Validation passed for venue edit');

    // Process facilities (convert to array if it's a string)
    let facilitiesArray = [];
    if (facilities) {
      if (Array.isArray(facilities)) {
        facilitiesArray = facilities;
      } else {
        facilitiesArray = [facilities];
      }
    }

    // Process hourly rates with commission for hours 1-24
    const hourlyRatesArray = [];
    let hasAnyRates = false;
    
    for (let i = 1; i <= 24; i++) {
      // Try both possible field name formats for robustness
      const hourlyRateValue = req.body[`hourlyRate${i}`] || req.body[`hourlyRate_${i}`];
      let commissionValue = req.body[`commissionPercentage${i}`] || req.body[`commissionPercentage_${i}`];
      
      // If user commission edit is disabled, use admin default
      if (!allowUserCommissionEdit) {
        commissionValue = defaultCommissionPercentage;
      }
      
      // Only add if rate is provided (commission will always be provided now)
      if (hourlyRateValue && parseFloat(hourlyRateValue) > 0 && 
          commissionValue && parseFloat(commissionValue) >= 0) {
        const rateVal = parseFloat(hourlyRateValue);
        const commissionVal = parseFloat(commissionValue);
        const commissionAmount = (rateVal * commissionVal) / 100;
        
        hourlyRatesArray.push({
          hours: i,
          rate: rateVal,
          commissionPercentage: commissionVal,
          commissionAmount: commissionAmount
        });
        hasAnyRates = true;
        console.log(`Found hourly rate for hour ${i}: ₹${hourlyRateValue}, Commission: ${commissionValue}%`);
      }
    }
    
    console.log(`Processing ${hourlyRatesArray.length} hourly rates, hasAnyRates: ${hasAnyRates}`);

    // Handle image removal
    let currentImages = venue.images || [];
    let currentImageMedia = venue.imageMedia || [];
    if (removeImages) {
      const imagesToRemove = Array.isArray(removeImages) ? removeImages : [removeImages];
      currentImages = currentImages.filter(img => !imagesToRemove.includes(img));
      // Also remove corresponding media docs
      const mediaToDelete = venue.imageMedia || [];
      for (const mediaId of mediaToDelete) {
        try {
          const mediaDoc = await Media.findById(mediaId);
          if (mediaDoc) {
            await deleteMedia(mediaDoc);
          }
        } catch (err) {
          console.error('Error deleting media:', err.message);
        }
      }
      currentImageMedia = [];
    }

    // Process new uploaded images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const { media } = await uploadFileToCloudinary(file, {
            module: 'venueMedia',
            ownerType: 'venue',
            ownerId: venue._id,
            folder: 'rapira/venues/images'
          });
          if (media) {
            currentImages.push(media.secure_url);
            currentImageMedia.push(media._id);
          }
        } catch (err) {
          console.error('Error uploading venue image:', err.message);
          req.flash('warning', `Failed to upload one image: ${err.message}`);
        }
      }
    }

    // Update venue
    venue.name = name.trim();
    venue.address = address.trim();
    venue.city = city.trim();
    venue.state = state.trim();
    venue.pincode = pincode.trim();
    venue.capacity = capacity ? parseInt(capacity) : null;
    venue.venueType = venueType || 'Indoor Hall';
    venue.facilities = facilitiesArray;
    venue.contactPerson = {
      name: contactName ? contactName.trim() : '',
      phone: contactPhone ? contactPhone.trim() : '',
      email: contactEmail ? contactEmail.trim().toLowerCase() : ''
    };
    venue.priceRange = priceRange || 'Mid-Range';
    venue.images = currentImages;
    venue.imageMedia = currentImageMedia;
    
    // Update pricing structure with new format
    const existingPricing = venue.pricing || {};
    
    // Update venue pricing
    if (!venue.pricing) {
      venue.pricing = {};
    }
    
    venue.pricing.hourlyRates = hasAnyRates ? hourlyRatesArray : (existingPricing.hourlyRates || []);
    venue.pricing.minimumHours = minimumHours ? parseInt(minimumHours) : (existingPricing.minimumHours || 1);
    venue.pricing.currency = 'INR';
    
    // Update ticket pricing
    if (!venue.pricing.ticketPricing) {
      venue.pricing.ticketPricing = {};
    }
    venue.pricing.ticketPricing.minimumPrice = minTicketPrice ? parseFloat(minTicketPrice) : (existingPricing.ticketPricing?.minimumPrice || 0);
    venue.pricing.ticketPricing.suggestedPrice = suggestedTicketPrice ? parseFloat(suggestedTicketPrice) : (existingPricing.ticketPricing?.suggestedPrice || 100);
    
    // Keep legacy hourlyRate for backward compatibility
    venue.pricing.hourlyRate = existingPricing.hourlyRate || (hourlyRatesArray.length > 0 ? hourlyRatesArray[0].rate : 0);
    
    venue.description = description ? description.trim() : '';
    venue.images = currentImages;
    venue.googleMapsLink = googleMapsLink ? googleMapsLink.trim() : '';
    venue.website = website ? website.trim() : '';
    venue.lastUpdatedBy = req.session.user.id;

    console.log('About to save venue with data:', {
      name: venue.name,
      city: venue.city,
      hourlyRatesCount: venue.pricing?.hourlyRates?.length || 0,
      minimumHours: venue.pricing?.minimumHours,
      commission: venue.pricing?.adminCommission?.percentage,
      hourlyRatesArrayLength: hourlyRatesArray?.length || 0
    });

    // Use findByIdAndUpdate for better error handling and validation control
    const updateData = {
      name: venue.name,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      pincode: venue.pincode,
      capacity: venue.capacity,
      venueType: venue.venueType,
      facilities: venue.facilities,
      contactPerson: venue.contactPerson,
      priceRange: venue.priceRange,
      pricing: venue.pricing,
      description: venue.description,
      images: venue.images,
      googleMapsLink: venue.googleMapsLink,
      website: venue.website,
      lastUpdatedBy: req.session.user.id
    };

    console.log('Update data prepared:', Object.keys(updateData));

    const savedVenue = await Venue.findByIdAndUpdate(
      req.params.id,
      updateData,
      { 
        new: true, 
        runValidators: true,
        context: 'query' // This helps with some validation issues
      }
    );

    if (!savedVenue) {
      throw new Error('Failed to update venue - venue not found after update');
    }

    console.log('Venue updated successfully with ID:', savedVenue._id);

    req.flash('success', 'Venue updated successfully');
    console.log('=== VENUE EDIT REQUEST END - SUCCESS ===');
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('=== VENUE EDIT REQUEST END - ERROR ===');
    console.error('Update venue error details:', {
      message: error.message,
      stack: error.stack,
      venueId: req.params.id
    });
    req.flash('error', `Failed to update venue: ${error.message}`);
    res.redirect(`/admin/venues/${req.params.id}/edit`);
  }
});

// POST /admin/venues/:id/toggle-active - Toggle venue active status
router.post('/:id/toggle-active', isLoggedIn, isAdmin, async (req, res) => {
  try {
    console.log('Toggle active route hit for venue ID:', req.params.id);
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      console.log('Venue not found:', req.params.id);
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    const oldStatus = venue.isActive;
    const newStatus = !venue.isActive;
    
    console.log(`Venue ${venue.name} status changing from ${oldStatus} to ${newStatus}`);
    
    // Use updateOne to avoid full document validation
    await Venue.updateOne(
      { _id: req.params.id },
      { 
        isActive: newStatus,
        lastUpdatedBy: req.session.user.id 
      }
    );
    
    console.log('Venue status updated successfully');

    req.flash('success', `Venue ${newStatus ? 'activated' : 'deactivated'} successfully`);
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Toggle venue active error:', error);
    req.flash('error', 'Failed to update venue status');
    res.redirect('/admin/venues');
  }
});

// POST /admin/venues/:id/toggle-verified - Toggle venue verified status
router.post('/:id/toggle-verified', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    const newVerifiedStatus = !venue.isVerified;
    
    // Use updateOne to avoid full document validation
    await Venue.updateOne(
      { _id: req.params.id },
      { 
        isVerified: newVerifiedStatus,
        lastUpdatedBy: req.session.user.id 
      }
    );

    req.flash('success', `Venue ${newVerifiedStatus ? 'verified' : 'unverified'} successfully`);
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Toggle venue verified error:', error);
    req.flash('error', 'Failed to update venue verification status');
    res.redirect('/admin/venues');
  }
});

// POST /admin/venues/:id/delete - Delete venue
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      req.flash('error', 'Venue not found');
      return res.redirect('/admin/venues');
    }

    // Check if venue is used in any concerts
    const concertCount = await Concert.countDocuments({ venue: venue._id });

    if (concertCount > 0) {
      req.flash('error', `Cannot delete venue. It is used in ${concertCount} concert(s). Please deactivate instead.`);
      return res.redirect('/admin/venues');
    }

    await Venue.findByIdAndDelete(req.params.id);

    req.flash('success', 'Venue deleted successfully');
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Delete venue error:', error);
    req.flash('error', 'Failed to delete venue');
    res.redirect('/admin/venues');
  }
});

// GET /admin/venues/export - Export venues to CSV
router.get('/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const venues = await Venue.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Create CSV content
    const csvHeader = 'Name,Address,City,State,Pincode,Type,Capacity,Price Range,Active,Verified,Created Date,Created By\n';
    const csvRows = venues.map(venue => {
      return [
        venue.name,
        venue.address,
        venue.city,
        venue.state,
        venue.pincode,
        venue.venueType,
        venue.capacity || 'N/A',
        venue.priceRange,
        venue.isActive ? 'Yes' : 'No',
        venue.isVerified ? 'Yes' : 'No',
        venue.createdAt.toLocaleDateString(),
        venue.createdBy ? venue.createdBy.name : 'Unknown'
      ].map(field => `"${field}"`).join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="venues-${new Date().toISOString().split('T')[0]}.csv"`);

    res.send(csvContent);
  } catch (error) {
    console.error('Export venues error:', error);
    req.flash('error', 'Failed to export venues');
    res.redirect('/admin/venues');
  }
});

module.exports = router;
