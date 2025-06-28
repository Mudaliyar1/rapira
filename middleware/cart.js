const Cart = require('../models/Cart');

// Middleware to add cart information to all requests
const cartMiddleware = async (req, res, next) => {
  try {
    // Initialize cart data
    res.locals.cartCount = 0;
    res.locals.cartItems = [];
    res.locals.cartTotal = 0;

    // Only get cart data if user is logged in
    if (req.session && req.session.user && req.session.user.id) {
      const cart = await Cart.findOne({ user: req.session.user.id })
        .populate('items.product', 'name images price')
        .lean();

      if (cart && cart.items.length > 0) {
        res.locals.cartCount = cart.totalItems || 0;
        res.locals.cartItems = cart.items;
        res.locals.cartTotal = cart.finalAmount || cart.totalAmount || 0;
      }
    }

    next();
  } catch (error) {
    console.error('Cart middleware error:', error);
    // Continue with default values
    res.locals.cartCount = 0;
    res.locals.cartItems = [];
    res.locals.cartTotal = 0;
    next();
  }
};

module.exports = cartMiddleware;
