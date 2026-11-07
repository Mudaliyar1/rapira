const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product');

async function getProducts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find({ name: { $in: ['RAPIRA Classic T-Shirt', 'RAPIRA Tote Bag'] } }).lean();
  console.log(JSON.stringify(products.map(p => ({
    id: p._id,
    name: p.name,
    price: p.price,
    comparePrice: p.comparePrice,
    images: p.images
  })), null, 2));
  process.exit(0);
}
getProducts();

