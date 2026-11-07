const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product');

async function reorder() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  await Product.collection.updateOne(
    { name: 'RAPIRA Classic T-Shirt' },
    { $set: { createdAt: new Date('2026-11-07T16:00:00Z') } }
  );
  await Product.collection.updateOne(
    { name: 'RAPIRA Hoodie' },
    { $set: { createdAt: new Date('2026-11-07T15:59:00Z') } }
  );
  await Product.collection.updateOne(
    { name: 'RAPIRA Tote Bag' },
    { $set: { createdAt: new Date('2026-11-07T15:58:00Z') } }
  );
  await Product.collection.updateOne(
    { name: 'RAPIRA Cap' },
    { $set: { createdAt: new Date('2026-11-07T15:57:00Z') } }
  );
  
  const items = await Product.find({ isActive: true }).sort({ createdAt: -1 }).lean();
  console.log('New product order:');
  items.forEach((item, idx) => console.log(`  ${idx + 1}. ${item.name} (₹${item.price})`));
  process.exit(0);
}

reorder().catch(err => {
  console.error(err);
  process.exit(1);
});

