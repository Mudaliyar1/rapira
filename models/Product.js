const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['Clothing', 'Accessories', 'Collectibles', 'Music', 'Merchandise', 'Other'],
    default: 'Merchandise'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  comparePrice: {
    type: Number,
    min: 0,
    default: null // For showing discounts
  },
  images: [{
    type: String,
    required: true
  }],
  sizes: [{
    size: {
      type: String,
      required: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size']
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  }],
  totalStock: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  weight: {
    type: Number,
    min: 0,
    default: 0 // in grams for shipping calculation
  },
  dimensions: {
    length: { type: Number, min: 0, default: 0 },
    width: { type: Number, min: 0, default: 0 },
    height: { type: Number, min: 0, default: 0 }
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true 
});

// Index for search and filtering
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ averageRating: -1 });
ProductSchema.index({ totalSales: -1 });
ProductSchema.index({ createdAt: -1 });

// Virtual for checking if product is in stock
ProductSchema.virtual('inStock').get(function() {
  return this.totalStock > 0;
});

// Pre-save middleware to calculate total stock
ProductSchema.pre('save', function(next) {
  if (this.sizes && this.sizes.length > 0) {
    this.totalStock = this.sizes.reduce((total, size) => total + size.stock, 0);
  }
  next();
});

// Method to update stock after purchase
ProductSchema.methods.updateStock = function(sizeOrders) {
  sizeOrders.forEach(order => {
    const sizeIndex = this.sizes.findIndex(s => s.size === order.size);
    if (sizeIndex !== -1) {
      this.sizes[sizeIndex].stock = Math.max(0, this.sizes[sizeIndex].stock - order.quantity);
    }
  });
  this.totalStock = this.sizes.reduce((total, size) => total + size.stock, 0);
  this.totalSales += sizeOrders.reduce((total, order) => total + order.quantity, 0);
};

// Method to check if specific size/quantity is available
ProductSchema.methods.checkAvailability = function(size, quantity) {
  const sizeObj = this.sizes.find(s => s.size === size);
  return sizeObj && sizeObj.stock >= quantity;
};

module.exports = mongoose.model('Product', ProductSchema);
