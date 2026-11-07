const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  // Check if any merchandise products already exist
  const existingCount = await Product.countDocuments();
  console.log('Current product count:', existingCount);

  if (existingCount === 0) {
    const adminId = new mongoose.Types.ObjectId('6818feae1161fb00d27a4b2c');

    const products = [
      {
        name: 'RAPIRA Classic T-Shirt',
        description: 'Premium heavyweight cotton streetwear t-shirt featuring the signature RAPIRA soundwave print in crimson and cream.',
        category: 'Clothing',
        price: 799,
        comparePrice: 999,
        images: ['/images/merchandise/rapira-tshirt.svg'],
        sizes: [
          { size: 'S', stock: 15 },
          { size: 'M', stock: 30 },
          { size: 'L', stock: 25 },
          { size: 'XL', stock: 10 }
        ],
        totalStock: 80,
        isActive: true,
        isFeatured: true,
        averageRating: 4.8,
        totalReviews: 120,
        totalSales: 340,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Hoodie',
        description: 'Ultra-soft fleece oversized pullover hoodie with kangaroo pocket, double-lined hood, and high-density embroidered RAPIRA logo.',
        category: 'Clothing',
        price: 1499,
        comparePrice: 1899,
        images: ['/images/merchandise/rapira-hoodie.svg'],
        sizes: [
          { size: 'S', stock: 10 },
          { size: 'M', stock: 20 },
          { size: 'L', stock: 18 },
          { size: 'XL', stock: 12 }
        ],
        totalStock: 60,
        isActive: true,
        isFeatured: true,
        averageRating: 4.9,
        totalReviews: 86,
        totalSales: 215,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Tote Bag',
        description: 'Durable 100% natural organic canvas tote bag with reinforced dual shoulder straps and bold RAPIRA typography.',
        category: 'Accessories',
        price: 499,
        comparePrice: 649,
        images: ['/images/merchandise/rapira-totebag.svg'],
        sizes: [
          { size: 'One Size', stock: 50 }
        ],
        totalStock: 50,
        isActive: true,
        isFeatured: true,
        averageRating: 4.7,
        totalReviews: 54,
        totalSales: 160,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Cap',
        description: 'Structured 6-panel low-profile curved brim dad hat in deep crimson with 3D white embroidered RAPIRA script and brass clasp.',
        category: 'Accessories',
        price: 599,
        comparePrice: 799,
        images: ['/images/merchandise/rapira-cap.svg'],
        sizes: [
          { size: 'One Size', stock: 45 }
        ],
        totalStock: 45,
        isActive: true,
        isFeatured: true,
        averageRating: 4.8,
        totalReviews: 73,
        totalSales: 190,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Street Bomber Jacket',
        description: 'Limited edition satin finish bomber jacket with crimson sleeve racing panels, ribbed cuffs, and custom metal zip pull.',
        category: 'Clothing',
        price: 2499,
        comparePrice: 2999,
        images: ['/images/merchandise/rapira-jacket.svg'],
        sizes: [
          { size: 'M', stock: 12 },
          { size: 'L', stock: 15 },
          { size: 'XL', stock: 8 }
        ],
        totalStock: 35,
        isActive: true,
        isFeatured: false,
        averageRating: 4.9,
        totalReviews: 42,
        totalSales: 95,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Ribbed Beanie',
        description: 'Warm acrylic knit cuff beanie with custom woven RAPIRA logo label. Snug comfortable fit for any season.',
        category: 'Accessories',
        price: 449,
        comparePrice: 599,
        images: ['/images/merchandise/rapira-beanie.svg'],
        sizes: [
          { size: 'One Size', stock: 40 }
        ],
        totalStock: 40,
        isActive: true,
        isFeatured: false,
        averageRating: 4.6,
        totalReviews: 38,
        totalSales: 110,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Debut LP • Vinyl Record',
        description: '180g heavyweight black vinyl featuring top underground hip-hop hits from RAPIRA artists. Includes gatefold art print.',
        category: 'Music',
        price: 1299,
        comparePrice: 1599,
        images: ['/images/merchandise/rapira-vinyl.svg'],
        sizes: [
          { size: 'One Size', stock: 30 }
        ],
        totalStock: 30,
        isActive: true,
        isFeatured: true,
        averageRating: 5.0,
        totalReviews: 67,
        totalSales: 145,
        createdBy: adminId
      },
      {
        name: 'RAPIRA Enamel Pin Collector Set',
        description: 'Set of 3 die-struck soft enamel pins with rubber clutch backings on custom branded art card.',
        category: 'Collectibles',
        price: 349,
        comparePrice: 499,
        images: ['/images/merchandise/rapira-pinset.svg'],
        sizes: [
          { size: 'One Size', stock: 65 }
        ],
        totalStock: 65,
        isActive: true,
        isFeatured: false,
        averageRating: 4.8,
        totalReviews: 29,
        totalSales: 88,
        createdBy: adminId
      }
    ];

    await Product.insertMany(products);
    console.log(`Successfully seeded ${products.length} RAPIRA merchandise products!`);
  } else {
    console.log('Products already exist, skipping seed.');
  }

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

