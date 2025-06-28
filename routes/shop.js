const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const ProductReview = require('../models/ProductReview');
const UserAddress = require('../models/UserAddress');
const { isLoggedIn } = require('../middleware/auth');
const { createOrder, verifyPayment } = require('../utils/paymentService');
const { sendOrderConfirmationEmail } = require('../utils/brevoEmailService');

// Shop homepage - Browse all products
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    
    // Build filter query
    let filter = { isActive: true };
    
    // Category filter
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    
    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }
    
    // Search query
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    
    // In stock filter
    if (req.query.inStock === 'true') {
      filter.totalStock = { $gt: 0 };
    }
    
    // Sort options
    let sort = {};
    switch (req.query.sort) {
      case 'price_low':
        sort.price = 1;
        break;
      case 'price_high':
        sort.price = -1;
        break;
      case 'rating':
        sort.averageRating = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'popular':
        sort.totalSales = -1;
        break;
      default:
        sort.createdAt = -1;
    }
    
    // Get products with pagination
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    
    // Get categories for filter
    const categories = await Product.distinct('category', { isActive: true });
    
    // Cart functionality removed
    let cartCount = 0;
    
    res.render('shop/index', {
      title: 'Shop - RAPIRA Merchandise',
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      filters: req.query,
      cartCount,
      layout: 'layouts/main'
    });
    
  } catch (error) {
    console.error('Shop page error:', error);
    req.flash('error', 'Error loading shop page');
    res.redirect('/');
  }
});

// Product details page
router.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name')
      .lean();

    if (!product || !product.isActive) {
      req.flash('error', 'Product not found');
      return res.redirect('/shop');
    }

    // Get product reviews
    const reviews = await ProductReview.find({
      product: product._id,
      isApproved: true
    })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get related products (same category, excluding current product)
    const relatedProducts = await Product.find({
      category: product.category,
      isActive: true,
      _id: { $ne: product._id }
    })
      .limit(4)
      .lean();



    // Cart functionality removed
    let cartCount = 0;

    res.render('shop/product-details', {
      title: `${product.name} - RAPIRA Shop`,
      product,
      reviews,
      relatedProducts,
      cartCount,
      currentUser: req.session.user || null,
      layout: 'layouts/main'
    });

  } catch (error) {
    console.error('Product details error:', error);
    req.flash('error', 'Error loading product details');
    res.redirect('/shop');
  }
});

// Debug route to test authentication
router.get('/debug/auth', (req, res) => {
  res.json({
    session: !!req.session,
    user: req.session.user || null,
    sessionId: req.session.id || null
  });
});

// Buy Now Purchase Page (Same as subscription purchase page)
router.get('/buy-now/:productId', isLoggedIn, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product || !product.isActive) {
      req.flash('error', 'Product not found or inactive');
      return res.redirect('/shop');
    }

    // Get size and quantity from query params
    const { size, quantity } = req.query;

    if (!size || !quantity) {
      req.flash('error', 'Please select size and quantity');
      return res.redirect(`/shop/product/${product._id}`);
    }

    // Check availability
    if (!product.checkAvailability(size, parseInt(quantity))) {
      req.flash('error', 'Insufficient stock for selected size');
      return res.redirect(`/shop/product/${product._id}`);
    }

    // Calculate total amount
    const totalAmount = product.price * parseInt(quantity);

    res.render('shop/buy-now-purchase', {
      title: `Buy Now - ${product.name}`,
      product,
      selectedSize: size,
      selectedQuantity: parseInt(quantity),
      totalAmount: totalAmount,
      currentUser: req.session.user,
      layout: 'layouts/main'
    });

  } catch (error) {
    console.error('Error loading buy now purchase page:', error);
    req.flash('error', 'Failed to load purchase page');
    res.redirect('/shop');
  }
});

// Create Buy Now Order (Same as subscription create-order)
router.post('/create-buy-now-order', isLoggedIn, async (req, res) => {
  try {
    const {
      productId,
      size,
      quantity,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode
    } = req.body;

    console.log('Create buy now order request:', { productId, size, quantity, userId: req.session.user.id });

    // Validate input
    if (!productId || !size || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product data'
      });
    }

    // Validate address fields
    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      req.flash('error', 'Please fill in all required address fields');
      return res.redirect(`/shop/buy-now/${productId}?size=${size}&quantity=${quantity}`);
    }

    // Validate PIN code format
    if (!/^\d{6}$/.test(pincode)) {
      req.flash('error', 'Please enter a valid 6-digit PIN code');
      return res.redirect(`/shop/buy-now/${productId}?size=${size}&quantity=${quantity}`);
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check availability
    if (!product.checkAvailability(size, parseInt(quantity))) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for selected size'
      });
    }

    // Calculate total amount
    const totalAmount = product.price * parseInt(quantity);

    // Create Razorpay order (same as subscription)
    const { createOrder } = require('../utils/paymentService');
    const orderOptions = {
      amount: totalAmount, // Amount in rupees (paymentService will convert to paise)
      receipt: `buynow_${Date.now()}`,
      currency: 'INR',
      notes: {
        userId: req.session.user.id,
        type: 'merchandise_buynow',
        productId: productId,
        size: size,
        quantity: quantity.toString()
      }
    };

    const orderResult = await createOrder(orderOptions);

    if (!orderResult.success) {
      return res.status(500).json({
        success: false,
        message: orderResult.error || 'Failed to create payment order'
      });
    }

    // Store order data in session (same as subscription)
    req.session.buyNowOrderData = {
      productId,
      size,
      quantity: parseInt(quantity),
      totalAmount,
      razorpayOrderId: orderResult.data.id,
      shippingAddress: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2 ? addressLine2.trim() : '',
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: 'India'
      }
    };

    // Check if this is an AJAX request or form submission (same as subscription)
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      // Return JSON for AJAX requests
      return res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID,
        order: orderResult.data
      });
    } else {
      // For form submissions, render payment redirect page (same as subscription)
      return res.render('shop/buy-now-payment-redirect', {
        layout: false,
        order: orderResult.data,
        key: process.env.RAZORPAY_KEY_ID,
        product: product,
        selectedSize: size,
        selectedQuantity: parseInt(quantity),
        totalAmount: totalAmount,
        currentUser: req.session.user
      });
    }

  } catch (error) {
    console.error('Create buy now order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order'
    });
  }
});

// Verify Buy Now Payment (Same as subscription verify-payment)
router.post('/verify-buy-now-payment', isLoggedIn, async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      productId,
      size,
      quantity
    } = req.body;

    console.log('Verify buy now payment:', { razorpay_payment_id, razorpay_order_id, productId, size, quantity });

    // Verify payment with Razorpay (same as subscription)
    const { verifyPayment } = require('../utils/paymentService');
    const isValidPayment = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValidPayment) {
      req.flash('error', 'Payment verification failed');
      return res.redirect(`/shop/product/${productId}`);
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/shop');
    }

    // Get user and stored order data
    const user = await require('../models/User').findById(req.session.user.id);
    const orderData = req.session.buyNowOrderData;

    if (!orderData || !orderData.shippingAddress) {
      req.flash('error', 'Order data not found. Please try again.');
      return res.redirect(`/shop/product/${productId}`);
    }

    // Generate order number manually
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `RP${timestamp.slice(-8)}${random}`;

    // Create order with proper required fields and stored address
    const Order = require('../models/Order');
    const order = new Order({
      orderNumber: orderNumber,
      user: req.session.user.id,
      items: [{
        product: productId,
        productName: product.name,
        productImage: product.images && product.images.length > 0 ? product.images[0] : '/images/default-product.jpg',
        size: size,
        quantity: parseInt(quantity),
        price: product.price,
        totalPrice: product.price * parseInt(quantity)
      }],
      shippingAddress: {
        fullName: orderData.shippingAddress.fullName,
        phone: orderData.shippingAddress.phone,
        email: user.email,
        addressLine1: orderData.shippingAddress.addressLine1,
        addressLine2: orderData.shippingAddress.addressLine2,
        city: orderData.shippingAddress.city,
        state: orderData.shippingAddress.state,
        pincode: orderData.shippingAddress.pincode,
        country: orderData.shippingAddress.country
      },
      subtotal: orderData.subtotal || (product.price * parseInt(quantity)),
      shippingCost: 0,
      taxAmount: 0,
      discountAmount: orderData.discountAmount || 0,
      couponCode: null,
      totalAmount: orderData.totalAmount || (product.price * parseInt(quantity)),
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      paymentStatus: 'completed',
      orderStatus: 'confirmed'
    });

    // Calculate estimated delivery
    order.calculateEstimatedDelivery();
    await order.save();

    // Update product stock
    product.updateStock([{ size: size, quantity: parseInt(quantity) }]);
    await product.save();

    // Clear session data
    delete req.session.buyNowOrderData;

    // Send confirmation email (same as subscription)
    try {
      const { sendOrderConfirmationEmail } = require('../utils/brevoEmailService');
      await sendOrderConfirmationEmail(user.email, {
        orderNumber: order.orderNumber,
        customerName: user.name,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        estimatedDelivery: order.estimatedDelivery
      });
    } catch (emailError) {
      console.error('Order confirmation email error:', emailError);
    }

    // Redirect to order confirmation
    res.redirect(`/orders/confirmation/${order.orderNumber}`);

  } catch (error) {
    console.error('Verify buy now payment error:', error);
    req.flash('error', 'Error processing payment');
    res.redirect('/shop');
  }
});

// Buy Now - Direct purchase
router.post('/buy-now', isLoggedIn, async (req, res) => {
  try {
    const { productId, size, quantity } = req.body;

    console.log('Buy now request:', { productId, size, quantity, userId: req.session.user.id });

    // Validate input
    if (!productId || !size || !quantity || quantity < 1) {
      req.flash('error', 'Invalid product data');
      return res.redirect(`/shop/product/${productId}`);
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      req.flash('error', 'Product not found');
      return res.redirect('/shop');
    }

    // Check availability
    if (!product.checkAvailability(size, parseInt(quantity))) {
      req.flash('error', 'Insufficient stock for selected size');
      return res.redirect(`/shop/product/${productId}`);
    }

    // Create a temporary cart-like object for checkout
    const buyNowItem = {
      product: {
        _id: product._id,
        name: product.name,
        images: product.images,
        price: product.price,
        category: product.category
      },
      size: size,
      quantity: parseInt(quantity),
      price: product.price,
      totalPrice: product.price * parseInt(quantity)
    };

    const buyNowData = {
      items: [buyNowItem],
      totalItems: parseInt(quantity),
      totalAmount: product.price * parseInt(quantity),
      finalAmount: product.price * parseInt(quantity),
      isBuyNow: true
    };

    // Store buy now data in session
    req.session.buyNowData = buyNowData;

    // Redirect to buy now checkout
    res.redirect('/shop/buy-now-checkout');

  } catch (error) {
    console.error('Buy now error:', error);
    req.flash('error', 'Error processing buy now request');
    res.redirect('/shop');
  }
});

// Buy Now Checkout page
router.get('/buy-now-checkout', isLoggedIn, async (req, res) => {
  try {
    const buyNowData = req.session.buyNowData;

    if (!buyNowData || !buyNowData.items || buyNowData.items.length === 0) {
      req.flash('error', 'No items to purchase');
      return res.redirect('/shop');
    }

    // Get user addresses
    const UserAddress = require('../models/UserAddress');
    const addresses = await UserAddress.getUserAddresses(req.session.user.id);

    res.render('shop/buy-now-checkout', {
      title: 'Buy Now Checkout - RAPIRA',
      cart: buyNowData,
      addresses,
      layout: 'layouts/main'
    });

  } catch (error) {
    console.error('Buy now checkout error:', error);
    req.flash('error', 'Error loading checkout page');
    res.redirect('/shop');
  }
});

// Process Buy Now Checkout
router.post('/buy-now-checkout', isLoggedIn, async (req, res) => {
  try {
    const { addressId, newAddress } = req.body;
    const buyNowData = req.session.buyNowData;

    if (!buyNowData || !buyNowData.items || buyNowData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items to purchase'
      });
    }

    // Verify stock availability
    const item = buyNowData.items[0];
    const product = await Product.findById(item.product._id);
    if (!product || !product.checkAvailability(item.size, item.quantity)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${item.product.name} (${item.size})`
      });
    }

    // Get shipping address
    let shippingAddress;
    if (addressId) {
      const UserAddress = require('../models/UserAddress');
      const address = await UserAddress.findById(addressId);
      if (!address || address.user.toString() !== req.session.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address'
        });
      }
      shippingAddress = address.toShippingAddress();
    } else if (newAddress) {
      shippingAddress = newAddress;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Add user email to shipping address
    const user = await require('../models/User').findById(req.session.user.id);
    shippingAddress.email = user.email;

    // Create Razorpay order
    const { createOrder } = require('../utils/paymentService');
    const orderOptions = {
      amount: buyNowData.finalAmount, // Amount in rupees (paymentService will convert to paise)
      receipt: `buynow_${Date.now()}`,
      currency: 'INR',
      notes: {
        userId: req.session.user.id,
        type: 'merchandise_buynow',
        productId: item.product._id.toString(),
        size: item.size,
        quantity: item.quantity.toString()
      }
    };

    const razorpayOrder = await createOrder(orderOptions);

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: buyNowData.finalAmount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Buy now checkout process error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing checkout'
    });
  }
});

// Cart functionality removed as requested
/*
router.post('/cart/add', isLoggedIn, async (req, res) => {
  try {
    const { productId, size, quantity } = req.body;

    console.log('Add to cart request:', {
      productId,
      size,
      quantity,
      userId: req.session.user.id,
      sessionId: req.session.id
    });

    // Validate input
    if (!productId || !size || !quantity || quantity < 1) {
      console.log('Validation failed:', { productId, size, quantity });
      return res.status(400).json({
        success: false,
        message: 'Invalid product data'
      });
    }
    
    // Get product
    const product = await Product.findById(productId);
    console.log('Product found:', { productId, found: !!product, isActive: product?.isActive });

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check availability
    const availabilityCheck = product.checkAvailability(size, parseInt(quantity));
    console.log('Availability check:', { size, quantity, available: availabilityCheck });

    if (!availabilityCheck) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for selected size'
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.session.user.id });
    console.log('Existing cart:', { found: !!cart, cartId: cart?._id });

    if (!cart) {
      cart = new Cart({ user: req.session.user.id, items: [] });
      console.log('Created new cart for user:', req.session.user.id);
    }

    // Add item to cart
    console.log('Adding item to cart:', { productId, size, quantity: parseInt(quantity), price: product.price });
    cart.addItem(productId, size, parseInt(quantity), product.price);

    console.log('Cart before save:', {
      itemsCount: cart.items.length,
      items: cart.items.map(item => ({ product: item.product, size: item.size, quantity: item.quantity }))
    });

    await cart.save();

    console.log('Cart after save:', {
      cartId: cart._id,
      itemsCount: cart.items.length,
      totalItems: cart.totalItems
    });

    res.json({
      success: true,
      message: 'Product added to cart',
      cartCount: cart.totalItems
    });
    
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding product to cart' 
    });
  }
});
*/

// Cart routes commented out - functionality removed
/*
// View cart
router.get('/cart', isLoggedIn, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.session.user.id })
      .populate('items.product', 'name images price category')
      .lean();
    
    if (!cart || cart.items.length === 0) {
      return res.render('shop/cart', {
        title: 'Shopping Cart - RAPIRA',
        cart: null,
        layout: 'layouts/main'
      });
    }
    
    res.render('shop/cart', {
      title: 'Shopping Cart - RAPIRA',
      cart,
      layout: 'layouts/main'
    });
    
  } catch (error) {
    console.error('Cart view error:', error);
    req.flash('error', 'Error loading cart');
    res.redirect('/shop');
  }
});

// Update cart item quantity
router.put('/cart/update', isLoggedIn, async (req, res) => {
  try {
    const { productId, size, quantity } = req.body;
    
    const cart = await Cart.findOne({ user: req.session.user.id });
    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }
    
    // If quantity is 0, remove item
    if (quantity === 0) {
      cart.removeItem(productId, size);
    } else {
      // Check product availability
      const product = await Product.findById(productId);
      if (!product || !product.checkAvailability(size, quantity)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Insufficient stock' 
        });
      }
      
      cart.updateItemQuantity(productId, size, quantity);
    }
    
    await cart.save();
    
    res.json({ 
      success: true, 
      message: 'Cart updated',
      cartCount: cart.totalItems,
      finalAmount: cart.finalAmount
    });
    
  } catch (error) {
    console.error('Cart update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating cart' 
    });
  }
});

// Remove item from cart
router.delete('/cart/remove', isLoggedIn, async (req, res) => {
  try {
    const { productId, size } = req.body;
    
    const cart = await Cart.findOne({ user: req.session.user.id });
    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }
    
    cart.removeItem(productId, size);
    await cart.save();
    
    res.json({ 
      success: true, 
      message: 'Item removed from cart',
      cartCount: cart.totalItems
    });
    
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing item from cart' 
    });
  }
});



// Get cart count
router.get('/cart/count', async (req, res) => {
  try {
    // If user is not logged in, return 0
    if (!req.session || !req.session.user) {
      return res.json({
        success: true,
        count: 0
      });
    }

    const cart = await Cart.findOne({ user: req.session.user.id });
    const count = cart ? cart.totalItems : 0;

    res.json({
      success: true,
      count: count
    });

  } catch (error) {
    console.error('Cart count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cart count',
      count: 0
    });
  }
});
*/

// Checkout page
router.get('/checkout', isLoggedIn, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.session.user.id })
      .populate('items.product', 'name images price category')
      .lean();

    if (!cart || cart.items.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shop/cart');
    }

    // Get user addresses
    const addresses = await UserAddress.getUserAddresses(req.session.user.id);

    res.render('shop/checkout', {
      title: 'Checkout - RAPIRA',
      cart,
      addresses,
      layout: 'layouts/main'
    });

  } catch (error) {
    console.error('Checkout page error:', error);
    req.flash('error', 'Error loading checkout page');
    res.redirect('/shop/cart');
  }
});

// Process checkout
router.post('/checkout', isLoggedIn, async (req, res) => {
  try {
    const { addressId, newAddress } = req.body;

    // Get cart
    const cart = await Cart.findOne({ user: req.session.user.id })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Verify stock availability for all items
    for (const item of cart.items) {
      if (!item.product.checkAvailability(item.size, item.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name} (${item.size})`
        });
      }
    }

    // Get shipping address
    let shippingAddress;
    if (addressId) {
      const address = await UserAddress.findById(addressId);
      if (!address || address.user.toString() !== req.session.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address'
        });
      }
      shippingAddress = address.toShippingAddress();
    } else if (newAddress) {
      shippingAddress = newAddress;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Add user email to shipping address
    const user = await require('../models/User').findById(req.session.user.id);
    shippingAddress.email = user.email;

    // Create Razorpay order
    const orderOptions = {
      amount: cart.finalAmount, // Amount in rupees (paymentService will convert to paise)
      receipt: `order_${Date.now()}`,
      currency: 'INR',
      notes: {
        userId: req.session.user.id,
        cartId: cart._id.toString(),
        type: 'merchandise'
      }
    };

    const razorpayOrder = await createOrder(orderOptions);

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: cart.finalAmount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Checkout process error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing checkout'
    });
  }
});

// Debug route to check query parameters
router.get('/debug-params/:productId', (req, res) => {
  console.log('🔍 Debug route - Query params:', req.query);
  console.log('🔍 Debug route - Full URL:', req.originalUrl);
  res.json({
    productId: req.params.productId,
    queryParams: req.query,
    fullUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});



module.exports = router;
