const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const ProductReview = require('../models/ProductReview');
const UserAddress = require('../models/UserAddress');
const User = require('../models/User');
const { isLoggedIn } = require('../middleware/auth');
const { verifyPayment } = require('../utils/paymentService');
const { sendOrderConfirmationEmail } = require('../utils/brevoEmailService');
const path = require('path');
const ejs = require('ejs');

// Verify payment and create order
router.post('/verify-payment', isLoggedIn, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
      newAddress,
      isBuyNow
    } = req.body;
    
    // Verify payment with Razorpay
    const isValidPayment = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });
    
    if (!isValidPayment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
    
    // Get cart or buy now data
    let cart;
    if (isBuyNow) {
      cart = req.session.buyNowData;
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No items to purchase'
        });
      }
    } else {
      cart = await Cart.findOne({ user: req.session.user.id })
        .populate('items.product');

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
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
      
      // Save new address if user wants to
      if (newAddress.saveAddress) {
        const userAddress = new UserAddress({
          user: req.session.user.id,
          label: newAddress.label || 'Home',
          fullName: newAddress.fullName,
          phone: newAddress.phone,
          addressLine1: newAddress.addressLine1,
          addressLine2: newAddress.addressLine2,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          country: newAddress.country || 'India'
        });
        await userAddress.save();
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Shipping address is required' 
      });
    }
    
    // Add user email to shipping address
    const user = await User.findById(req.session.user.id);
    shippingAddress.email = user.email;
    
    // Create order items
    let orderItems;
    if (isBuyNow) {
      orderItems = cart.items.map(item => ({
        product: item.product._id,
        productName: item.product.name,
        productImage: item.product.images[0],
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice
      }));
    } else {
      orderItems = cart.items.map(item => ({
        product: item.product._id,
        productName: item.product.name,
        productImage: item.product.images[0],
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity
      }));
    }
    
    // Create order
    const order = new Order({
      user: req.session.user.id,
      items: orderItems,
      shippingAddress,
      subtotal: cart.totalAmount,
      discountAmount: 0,
      couponCode: null,
      totalAmount: cart.finalAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      paymentStatus: 'completed',
      orderStatus: 'confirmed'
    });
    
    // Calculate estimated delivery
    order.calculateEstimatedDelivery();
    
    await order.save();
    
    // Update product stock and sales
    for (const item of cart.items) {
      let product;
      if (isBuyNow) {
        product = await Product.findById(item.product._id);
      } else {
        product = item.product;
      }

      if (product) {
        product.updateStock([{ size: item.size, quantity: item.quantity }]);
        await product.save();
      }
    }



    // Clear cart or buy now data
    if (isBuyNow) {
      delete req.session.buyNowData;
    } else {
      cart.clearCart();
      await cart.save();
    }
    
    // Send order confirmation email
    try {
      await sendOrderConfirmationEmail(user.email, {
        orderNumber: order.orderNumber,
        customerName: user.name,
        items: orderItems,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        estimatedDelivery: order.estimatedDelivery
      });
    } catch (emailError) {
      console.error('Order confirmation email error:', emailError);
      // Don't fail the order creation if email fails
    }
    
    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      orderNumber: order.orderNumber,
      orderId: order._id
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing payment' 
    });
  }
});

// Order confirmation page
router.get('/confirmation/:orderNumber', isLoggedIn, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.product', 'name images')
      .lean();

    if (!order || order.user.toString() !== req.session.user.id) {
      req.flash('error', 'Order not found');
      return res.redirect('/orders/my-orders');
    }
    
    res.render('shop/order-confirmation', {
      title: 'Order Confirmation - RAPIRA',
      order,
      layout: 'layouts/main'
    });
    
  } catch (error) {
    console.error('Order confirmation error:', error);
    req.flash('error', 'Error loading order confirmation');
    res.redirect('/orders/my-orders');
  }
});

// User orders list
router.get('/my-orders', isLoggedIn, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const orders = await Order.find({ user: req.session.user.id })
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalOrders = await Order.countDocuments({ user: req.session.user.id });
    const totalPages = Math.ceil(totalOrders / limit);
    
    res.render('shop/my-orders', {
      title: 'My Orders - RAPIRA',
      orders,
      currentPage: page,
      totalPages,
      layout: 'layouts/main'
    });
    
  } catch (error) {
    console.error('My orders error:', error);
    req.flash('error', 'Error loading orders');
    res.redirect('/users/profile');
  }
});

// Order details
router.get('/order/:orderNumber', isLoggedIn, async (req, res) => {
  try {
    const order = await Order.findOne({
      orderNumber: req.params.orderNumber,
      user: req.session.user.id
    })
      .populate('items.product', 'name images category')
      .lean();

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/orders/my-orders');
    }

    res.render('shop/order-details', {
      title: `Order ${order.orderNumber} - RAPIRA`,
      order,
      layout: 'layouts/main'
    });

  } catch (error) {
    console.error('Order details error:', error);
    req.flash('error', 'Error loading order details');
    res.redirect('/orders/my-orders');
  }
});

// Download invoice (redirects to HTML version)
router.get('/invoice/:orderId', isLoggedIn, async (req, res) => {
  try {
    // Redirect to HTML version for consistent behavior
    return res.redirect(`/orders/invoice/${req.params.orderId}/download-html`);
  } catch (error) {
    console.error('Download invoice error:', error);
    req.flash('error', 'Failed to generate invoice');
    res.redirect('/orders/my-orders');
  }
});

// Download invoice as HTML
router.get('/invoice/:orderId/download-html', isLoggedIn, async (req, res) => {
  try {
    console.log('Invoice HTML route hit for order ID:', req.params.orderId);
    console.log('User ID:', req.session.user.id);

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.session.user.id
    })
      .populate('items.product', 'name images category')
      .populate('user', 'name email phone')
      .lean();

    console.log('Order found:', order ? 'Yes' : 'No');

    if (!order) {
      console.log('Order not found or access denied');
      req.flash('error', 'Order not found');
      return res.redirect('/orders/my-orders');
    }

    // Check if user owns the order
    if (order.user._id.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to download this invoice');
      return res.redirect('/orders/my-orders');
    }

    console.log('Generating invoice for order:', order.orderNumber);

    // Render the invoice template with wrapper to HTML
    const invoiceHtml = await ejs.renderFile(
      path.join(__dirname, '../views/shop/invoice-wrapper.ejs'),
      { order, downloadMode: true }
    );

    console.log('Invoice HTML generated successfully');

    // Set response headers for download
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="RAPIRA_Invoice_${order.orderNumber}.html"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the HTML
    res.send(invoiceHtml);

  } catch (error) {
    console.error('Download invoice HTML error:', error);
    req.flash('error', 'Failed to generate invoice HTML');
    res.redirect('/orders/my-orders');
  }
});

// Cancel order
router.post('/cancel/:orderId', isLoggedIn, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.orderId);
    
    if (!order || order.user.toString() !== req.session.user.id) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    if (!order.canBeCancelled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order cannot be cancelled at this stage' 
      });
    }
    
    // Update order status
    order.updateStatus('cancelled', reason);
    order.cancellationReason = reason;
    await order.save();
    
    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock += item.quantity;
          product.totalStock += item.quantity;
          product.totalSales = Math.max(0, product.totalSales - item.quantity);
          await product.save();
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Order cancelled successfully' 
    });
    
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error cancelling order' 
    });
  }
});

module.exports = router;
