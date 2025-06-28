const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {
    type: String,
    required: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size']
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [CartItemSchema],
  totalItems: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },

  finalAmount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Index for faster user cart lookup
CartSchema.index({ user: 1 });

// Pre-save middleware to calculate totals
CartSchema.pre('save', function(next) {
  // Calculate total items and amount
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  
  this.finalAmount = this.totalAmount;
  next();
});

// Method to add item to cart
CartSchema.methods.addItem = function(productId, size, quantity, price) {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString() && item.size === size
  );
  
  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      size: size,
      quantity: quantity,
      price: price
    });
  }
};

// Method to update item quantity
CartSchema.methods.updateItemQuantity = function(productId, size, quantity) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString() && item.size === size
  );
  
  if (itemIndex > -1) {
    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
    }
  }
};

// Method to remove item from cart
CartSchema.methods.removeItem = function(productId, size) {
  this.items = this.items.filter(
    item => !(item.product.toString() === productId.toString() && item.size === size)
  );
};

// Method to clear cart
CartSchema.methods.clearCart = function() {
  this.items = [];
};

module.exports = mongoose.model('Cart', CartSchema);
