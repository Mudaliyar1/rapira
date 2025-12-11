const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Media = require('../models/Media');
const ProductReview = require('../models/ProductReview');
const { isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

// Configure multer for product image uploads (memory → Cloudinary)
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
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Products management dashboard
router.get('/products', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Build filter
    let filter = {};
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    if (req.query.status && req.query.status !== 'all') {
      filter.isActive = req.query.status === 'active';
    }
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    
    // Sort options
    let sort = { createdAt: -1 };
    if (req.query.sort === 'name') sort = { name: 1 };
    if (req.query.sort === 'price') sort = { price: 1 };
    if (req.query.sort === 'stock') sort = { totalStock: -1 };
    if (req.query.sort === 'sales') sort = { totalSales: -1 };
    
    const products = await Product.find(filter)
      .populate('createdBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get categories for filter
    const categories = await Product.distinct('category');

    res.render('admin/merchandise/products', {
      title: 'Product Management',
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      filters: req.query,
      currentPath: req.originalUrl.split('?')[0], // Use originalUrl and remove query params
      layout: 'layouts/admin'
    });
    
  } catch (error) {
    console.error('Admin products error:', error);
    req.flash('error', 'Error loading products');
    res.redirect('/admin');
  }
});

// Add product page
router.get('/products/add', isAdmin, async (req, res) => {
  try {
    res.render('admin/merchandise/add-product', {
      title: 'Add Product',
      currentPath: req.originalUrl.split('?')[0],
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Add product page error:', error);
    req.flash('error', 'Error loading add product page');
    res.redirect('/admin/merchandise/products');
  }
});

// Create product
router.post('/products/add', isAdmin, upload.array('images', 5), async (req, res) => {
  try {
    console.log('🚀 CREATE PRODUCT ROUTE HIT!');
    console.log('📝 Add Product Request Body:', req.body);
    console.log('📁 Files received:', req.files ? req.files.length : 0);
    console.log('📋 Request body keys:', Object.keys(req.body));
    const {
      name,
      description,
      category,
      price,
      comparePrice,
      tags,
      weight,
      sku,
      paymentMethods,
      sizes,
      dimensions
    } = req.body;
    
    // Validate required fields
    console.log('🔍 Validating required fields...');
    console.log('Name:', name);
    console.log('Description:', description);
    console.log('Category:', category);
    console.log('Price:', price);

    if (!name || !description || !category || !price) {
      console.log('❌ Required field validation failed');
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/merchandise/products/add');
    }
    console.log('✅ Required fields validation passed');

    // Validate payment methods
    console.log('🔍 Validating payment methods...');
    console.log('Payment methods received:', paymentMethods);
    console.log('Payment methods type:', typeof paymentMethods);
    console.log('Payment methods array?', Array.isArray(paymentMethods));

    if (!paymentMethods || (Array.isArray(paymentMethods) && paymentMethods.length === 0)) {
      console.log('❌ Payment methods validation failed');
      req.flash('error', 'Please select at least one payment method');
      return res.redirect('/admin/merchandise/products/add');
    }
    console.log('✅ Payment methods validation passed');
    
    // Process uploaded images
    console.log('🔍 Processing uploaded images...');
    // Process uploaded images → Cloudinary
    console.log('Files array:', req.files);
    const images = [];
    const mediaRefs = [];
    
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          const { media } = await uploadFileToCloudinary(file, {
            module: 'adminMerchandise',
            ownerType: 'admin',
            ownerId: req.session.user.id,
            folder: 'rapira/admin/merchandise/products'
          });
          images.push(media.secure_url);
          mediaRefs.push(media._id);
        }
      } catch (err) {
        console.error('Cloud upload failed (product images):', err);
        req.flash('error', 'Image upload failed');
        return res.redirect('/admin/merchandise/products/add');
      }
    }
    console.log('Processed images:', images);

    if (images.length === 0) {
      console.log('❌ Images validation failed - no images uploaded');
      req.flash('error', 'At least one product image is required');
      return res.redirect('/admin/merchandise/products/add');
    }
    console.log('✅ Images validation passed');
    
    // Process sizes
    console.log('🔍 Processing sizes...');
    console.log('Sizes received:', sizes);
    console.log('Sizes type:', typeof sizes);
    console.log('Sizes is array?', Array.isArray(sizes));

    let productSizes = [];
    if (sizes && Array.isArray(sizes)) {
      // Filter out empty items and process each size
      productSizes = sizes
        .filter(size => size && size.size && size.stock !== undefined)
        .map(size => {
          // Handle case where size.size and size.stock might be arrays
          const sizeValue = Array.isArray(size.size) ? size.size[0] : size.size;
          const stockValue = Array.isArray(size.stock) ? size.stock[0] : size.stock;

          return {
            size: sizeValue,
            stock: parseInt(stockValue) || 0
          };
        });
    } else if (sizes && typeof sizes === 'object') {
      // Handle case where sizes is an object with arrays
      if (sizes.size && sizes.stock) {
        const sizeArray = Array.isArray(sizes.size) ? sizes.size : [sizes.size];
        const stockArray = Array.isArray(sizes.stock) ? sizes.stock : [sizes.stock];

        // Create size objects by pairing size and stock arrays
        for (let i = 0; i < sizeArray.length; i++) {
          if (sizeArray[i] && stockArray[i] !== undefined) {
            productSizes.push({
              size: sizeArray[i],
              stock: parseInt(stockArray[i]) || 0
            });
          }
        }
      }
    }
    console.log('Processed sizes:', productSizes);
    
    // Process payment methods
    const processedPaymentMethods = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];

    // Process dimensions
    const productDimensions = {
      length: dimensions && dimensions.length ? parseFloat(dimensions.length) : 0,
      width: dimensions && dimensions.width ? parseFloat(dimensions.width) : 0,
      height: dimensions && dimensions.height ? parseFloat(dimensions.height) : 0
    };

    // Create product
    console.log('🔍 Creating product object...');
    const productData = {
      name: name.trim(),
      description: description.trim(),
      category,
      price: parseFloat(price),
      comparePrice: comparePrice ? parseFloat(comparePrice) : null,
      images,
      sizes: productSizes,
      paymentMethods: processedPaymentMethods,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      weight: weight ? parseFloat(weight) : 0,
      dimensions: productDimensions,
      sku: sku ? sku.trim() : undefined,
      createdBy: req.session.user.id,
      images: images,
      imageMedia: mediaRefs
    };

    console.log('Product data to save:', productData);

    const product = new Product(productData);
    console.log('🔍 Saving product to database...');

    await product.save();
    console.log('✅ Product saved successfully with ID:', product._id);

    req.flash('success', 'Product added successfully');
    console.log('🔄 Redirecting to products page...');
    res.redirect('/admin/merchandise/products');
    
  } catch (error) {
    console.error('❌ Add product error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    req.flash('error', 'Error adding product: ' + error.message);
    res.redirect('/admin/merchandise/products/add');
  }
});

// Edit product page
router.get('/products/edit/:id', isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin/merchandise/products');
    }

    res.render('admin/merchandise/edit-product', {
      title: 'Edit Product',
      product,
      currentPath: req.originalUrl.split('?')[0],
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Edit product page error:', error);
    req.flash('error', 'Error loading product');
    res.redirect('/admin/merchandise/products');
  }
});

// Update product
router.post('/products/edit/:id', isAdmin, upload.array('newImages', 5), async (req, res) => {
  try {
    console.log('📝 Edit Product Request Body:', Object.keys(req.body));
    console.log('📁 Files received:', req.files ? req.files.length : 0);
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin/merchandise/products');
    }
    
    const {
      name,
      description,
      category,
      price,
      comparePrice,
      tags,
      weight,
      sku,
      sizes,
      isActive,
      isFeatured,
      paymentMethods,
      existingImages,
      dimensions
    } = req.body;

    // Debug: Log checkbox values
    console.log('Checkbox values received:', {
      isActive: isActive,
      isFeatured: isFeatured,
      isActiveType: typeof isActive,
      isFeaturedType: typeof isFeatured
    });

    // Update basic fields
    product.name = name.trim();
    product.description = description.trim();
    product.category = category;
    product.price = parseFloat(price);
    product.comparePrice = comparePrice ? parseFloat(comparePrice) : null;
    product.tags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    product.weight = weight ? parseFloat(weight) : 0;
    product.sku = sku ? sku.trim() : undefined;

    // Update dimensions
    if (dimensions) {
      product.dimensions = {
        length: dimensions.length ? parseFloat(dimensions.length) : 0,
        width: dimensions.width ? parseFloat(dimensions.width) : 0,
        height: dimensions.height ? parseFloat(dimensions.height) : 0
      };
    }

    // Handle checkbox values properly
    product.isActive = isActive === 'on' || isActive === true || isActive === 'true';
    product.isFeatured = isFeatured === 'on' || isFeatured === true || isFeatured === 'true';

    // Handle payment methods
    if (paymentMethods) {
      product.paymentMethods = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];
    } else {
      product.paymentMethods = ['online']; // Default to online if none selected
    }
    
    // Update sizes
    if (sizes && Array.isArray(sizes)) {
      // Filter out empty items and process each size
      product.sizes = sizes
        .filter(size => size && size.size && size.stock !== undefined)
        .map(size => {
          // Handle case where size.size and size.stock might be arrays
          const sizeValue = Array.isArray(size.size) ? size.size[0] : size.size;
          const stockValue = Array.isArray(size.stock) ? size.stock[0] : size.stock;

          return {
            size: sizeValue,
            stock: parseInt(stockValue) || 0
          };
        });
    } else if (sizes && typeof sizes === 'object') {
      // Handle case where sizes is an object with arrays
      if (sizes.size && sizes.stock) {
        const sizeArray = Array.isArray(sizes.size) ? sizes.size : [sizes.size];
        const stockArray = Array.isArray(sizes.stock) ? sizes.stock : [sizes.stock];

        product.sizes = [];
        // Create size objects by pairing size and stock arrays
        for (let i = 0; i < sizeArray.length; i++) {
          if (sizeArray[i] && stockArray[i] !== undefined) {
            product.sizes.push({
              size: sizeArray[i],
              stock: parseInt(stockArray[i]) || 0
            });
          }
        }
      }
    }
    
    // Handle images - ROBUST METHOD
    console.log('🖼️ Processing images...');
    console.log('Existing images from form:', existingImages);
    console.log('Current product images:', product.images);
    console.log('New files uploaded:', req.files ? req.files.length : 0);

    let updatedImages = [];

    // Method 1: Use existing images from form (if any)
    if (existingImages) {
      if (Array.isArray(existingImages)) {
        updatedImages = [...existingImages];
        console.log('✅ Using existing images from form (array):', updatedImages);
      } else {
        updatedImages = [existingImages];
        console.log('✅ Using existing images from form (single):', updatedImages);
      }
    } else {
      // Method 2: Fallback to current product images if no form data
      console.log('⚠️ No existing images in form, using current product images');
      updatedImages = product.images ? [...product.images] : [];
      console.log('✅ Using current product images:', updatedImages);
    }

    // Add new images if any via Cloudinary
    if (req.files && req.files.length > 0) {
      const mediaRefs = [];
      for (const file of req.files) {
        try {
          const { media } = await uploadFileToCloudinary(file, {
            module: 'product',
            ownerType: 'admin',
            ownerId: req.session.user.id,
            folder: 'rapira/products/images'
          });
          updatedImages.push(media.secure_url);
          mediaRefs.push(media._id);
          console.log('✅ Uploaded image to Cloudinary:', media.secure_url);
        } catch (err) {
          console.error('Error uploading product image:', err);
          req.flash('warning', `Failed to upload image: ${file.originalname}`);
        }
      }
      if (mediaRefs.length > 0) {
        product.imageMedia = [...(product.imageMedia || []), ...mediaRefs];
      }
      console.log('✅ Added new images from Cloudinary:', updatedImages);
    }

    // Ensure we always have at least the original images if nothing else
    if (updatedImages.length === 0 && product.images && product.images.length > 0) {
      updatedImages = [...product.images];
      console.log('🔄 Fallback: Preserving original images:', updatedImages);
    }

    product.images = updatedImages;
    console.log('✅ Final product images set to:', product.images);
    
    await product.save();

    req.flash('success', 'Product updated successfully');
    res.redirect('/admin/merchandise/products');
    
  } catch (error) {
    console.error('Update product error:', error);
    req.flash('error', 'Error updating product');
    res.redirect(`/admin/merchandise/products/edit/${req.params.id}`);
  }
});

// Delete product confirmation page
router.get('/products/:id/delete', isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin/merchandise/products');
    }

    // Check if product has orders and their status
    const totalOrders = await Order.countDocuments({
      'items.product': product._id
    });

    const pendingOrders = await Order.countDocuments({
      'items.product': product._id,
      orderStatus: { $nin: ['delivered', 'cancelled', 'returned'] }
    });

    const canDelete = totalOrders === 0 || pendingOrders === 0;

    res.render('admin/merchandise/delete-product-confirm', {
      title: 'Delete Product',
      product,
      hasOrders: totalOrders > 0,
      hasPendingOrders: pendingOrders > 0,
      canDelete: canDelete,
      totalOrders: totalOrders,
      pendingOrders: pendingOrders,
      currentPath: req.originalUrl.split('?')[0],
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Delete product confirmation page error:', error);
    req.flash('error', 'Error loading product');
    res.redirect('/admin/merchandise/products');
  }
});

// Delete product
router.delete('/products/:id', isAdmin, async (req, res) => {
  try {
    console.log('🗑️ Delete product route hit for ID:', req.params.id);

    const product = await Product.findById(req.params.id);

    if (!product) {
      console.log('❌ Product not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log('✅ Product found:', product.name);

    // Check if product has pending orders (not delivered, cancelled, or returned)
    const pendingOrders = await Order.countDocuments({
      'items.product': product._id,
      orderStatus: { $nin: ['delivered', 'cancelled', 'returned'] }
    });

    if (pendingOrders > 0) {
      // Don't delete, just deactivate
      console.log('⚠️ Product has pending orders, deactivating instead of deleting');
      product.isActive = false;
      await product.save();

      return res.json({
        success: true,
        message: `Product deactivated (has ${pendingOrders} pending orders that need to be completed first)`
      });
    }

    // Delete product images
    product.images.forEach(imagePath => {
      const fullPath = path.join(__dirname, '../public', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    await Product.findByIdAndDelete(req.params.id);
    console.log('✅ Product deleted successfully');

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product: ' + error.message
    });
  }
});

// Bulk delete products
router.post('/products/bulk-delete', isAdmin, async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products selected'
      });
    }

    let deletedCount = 0;
    let deactivatedCount = 0;

    for (const productId of productIds) {
      try {
        const product = await Product.findById(productId);

        if (!product) {
          continue;
        }

        // Check if product has pending orders (not delivered, cancelled, or returned)
        const pendingOrders = await Order.countDocuments({
          'items.product': product._id,
          orderStatus: { $nin: ['delivered', 'cancelled', 'returned'] }
        });

        if (pendingOrders > 0) {
          // Don't delete, just deactivate
          product.isActive = false;
          await product.save();
          deactivatedCount++;
        } else {
          // Delete product images
          product.images.forEach(imagePath => {
            const fullPath = path.join(__dirname, '../public', imagePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          });

          await Product.findByIdAndDelete(productId);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error processing product ${productId}:`, error);
      }
    }

    let message = '';
    if (deletedCount > 0 && deactivatedCount > 0) {
      message = `${deletedCount} products deleted and ${deactivatedCount} products deactivated (had existing orders)`;
    } else if (deletedCount > 0) {
      message = `${deletedCount} products deleted successfully`;
    } else if (deactivatedCount > 0) {
      message = `${deactivatedCount} products deactivated (had existing orders)`;
    } else {
      message = 'No products were processed';
    }

    res.json({
      success: true,
      message,
      deletedCount,
      deactivatedCount
    });

  } catch (error) {
    console.error('Bulk delete products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting products'
    });
  }
});

// Toggle product status
router.post('/products/:id/toggle', isAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isActive = isActive;
    await product.save();

    res.json({
      success: true,
      message: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: product.isActive
    });

  } catch (error) {
    console.error('Toggle product status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product status'
    });
  }
});

// Bulk update product status
router.post('/products/bulk-update-status', isAdmin, async (req, res) => {
  try {
    const { productIds, isActive } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products selected'
      });
    }

    await Product.updateMany(
      { _id: { $in: productIds } },
      { isActive }
    );

    res.json({
      success: true,
      message: `${productIds.length} products ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Bulk update product status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product status'
    });
  }
});

// Orders management
router.get('/orders', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.orderStatus = req.query.status;
    }
    if (req.query.payment && req.query.payment !== 'all') {
      filter.paymentStatus = req.query.payment;
    }
    if (req.query.search) {
      filter.$or = [
        { orderNumber: { $regex: req.query.search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get order statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.render('admin/merchandise/orders', {
      title: 'Order Management',
      orders,
      stats,
      currentPage: page,
      totalPages,
      totalOrders,
      filters: req.query,
      currentPath: req.originalUrl.split('?')[0], // Use originalUrl and remove query params
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Admin orders error:', error);
    req.flash('error', 'Error loading orders');
    res.redirect('/admin');
  }
});

// Order details
router.get('/orders/:id', isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name category')
      .lean();

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/admin/merchandise/orders');
    }

    res.render('admin/merchandise/order-details', {
      title: `Order ${order.orderNumber}`,
      order,
      currentPath: req.originalUrl.split('?')[0],
      layout: 'layouts/admin'
    });

  } catch (error) {
    console.error('Admin order details error:', error);
    req.flash('error', 'Error loading order details');
    res.redirect('/admin/merchandise/orders');
  }
});

// Update order status (Form submission)
router.post('/orders/:id/status', isAdmin, async (req, res) => {
  try {
    console.log('=== STATUS UPDATE REQUEST ===');
    console.log('Order ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('User:', req.session.user?.email);

    const { status, trackingNumber, notes, expectedDelivery, expectedDeliveryDate, expectedDeliveryTime } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!status || !validStatuses.includes(status)) {
      req.flash('error', 'Invalid order status selected');
      return res.redirect(`/admin/merchandise/orders/${req.params.id}`);
    }

    // Find order
    const order = await Order.findById(req.params.id);
    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/admin/merchandise/orders');
    }

    console.log('📊 Updating status from:', order.orderStatus, 'to:', status);

    // Update order status using the model method
    order.updateStatus(status, notes);

    // Handle notes - allow clearing notes
    if (notes !== undefined) {
      if (notes.trim()) {
        order.notes = notes.trim();
        console.log('📝 Notes updated:', notes.trim());
      } else {
        // If notes field is empty, clear the notes
        order.notes = null;
        console.log('📝 Notes cleared (set to null)');
      }
    }

    if (trackingNumber && trackingNumber.trim()) {
      order.trackingNumber = trackingNumber.trim();
    }

    // Handle expected delivery date and time
    if (expectedDeliveryDate && expectedDeliveryDate.trim()) {
      const deliveryTime = expectedDeliveryTime && expectedDeliveryTime.trim() ? expectedDeliveryTime : '18:00';
      const deliveryDateTime = new Date(`${expectedDeliveryDate}T${deliveryTime}:00`);

      if (!isNaN(deliveryDateTime.getTime())) {
        order.estimatedDelivery = deliveryDateTime;
        console.log('📅 Expected delivery date and time set:', deliveryDateTime);
      }
    } else if (expectedDelivery && expectedDelivery.trim()) {
      // Fallback for old single datetime input (if still used)
      const deliveryDate = new Date(expectedDelivery);
      if (!isNaN(deliveryDate.getTime())) {
        order.estimatedDelivery = deliveryDate;
        console.log('📅 Expected delivery date set (fallback):', deliveryDate);
      }
    }

    // Auto-calculate estimated delivery for shipped orders if not manually set
    if (status === 'shipped' && !order.estimatedDelivery && (!expectedDeliveryDate || !expectedDeliveryDate.trim()) && (!expectedDelivery || !expectedDelivery.trim())) {
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + 7);
      estimatedDate.setHours(18, 0, 0, 0); // Set default time to 6:00 PM
      order.estimatedDelivery = estimatedDate;
      console.log('📅 Auto-calculated delivery date and time:', estimatedDate);
    }

    // Save the order
    await order.save();

    console.log('✅ Order status updated successfully');
    console.log('📊 New status:', order.orderStatus);
    console.log('📦 Order number:', order.orderNumber);

    // Set success message
    req.flash('success', `Order status updated to "${status.toUpperCase()}" successfully!`);

    // Redirect back to order details page
    res.redirect(`/admin/merchandise/orders/${req.params.id}`);

  } catch (error) {
    console.error('❌ Update order status error:', error);
    req.flash('error', 'Error updating order status: ' + error.message);
    res.redirect(`/admin/merchandise/orders/${req.params.id}`);
  }
});

// Debug route to check order status
router.get('/orders/:id/debug', isAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG REQUEST for order:', req.params.id);

    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const debugInfo = {
      success: true,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        user: order.user
      },
      timestamp: new Date().toISOString()
    };

    console.log('📊 Debug info:', debugInfo);
    res.json(debugInfo);

  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching debug info: ' + error.message
    });
  }
});





module.exports = router;
