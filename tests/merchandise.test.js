const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const User = require('../models/User');

// Test database connection
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/rapira_test';

describe('Merchandise System Tests', () => {
  let testUser;
  let testProduct;

  let authCookie;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_TEST_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Coupon.deleteMany({});

    // Create test user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      isVerified: true
    });
    await testUser.save();

    // Create test product
    testProduct = new Product({
      name: 'Test T-Shirt',
      description: 'A comfortable test t-shirt',
      category: 'Clothing',
      price: 999,
      images: ['/uploads/test-image.jpg'],
      sizes: [
        { size: 'M', stock: 10 },
        { size: 'L', stock: 5 }
      ],
      isActive: true,
      createdBy: testUser._id
    });
    await testProduct.save();



    // Login user to get auth cookie
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authCookie = loginResponse.headers['set-cookie'];
  });

  afterAll(async () => {
    // Clean up and close connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe('Product Management', () => {
    test('Should browse products', async () => {
      const response = await request(app)
        .get('/shop')
        .expect(200);

      expect(response.text).toContain('Test T-Shirt');
    });

    test('Should view product details', async () => {
      const response = await request(app)
        .get(`/shop/product/${testProduct._id}`)
        .expect(200);

      expect(response.text).toContain('Test T-Shirt');
      expect(response.text).toContain('A comfortable test t-shirt');
    });

    test('Should filter products by category', async () => {
      const response = await request(app)
        .get('/shop?category=Clothing')
        .expect(200);

      expect(response.text).toContain('Test T-Shirt');
    });

    test('Should search products', async () => {
      const response = await request(app)
        .get('/shop?search=t-shirt')
        .expect(200);

      expect(response.text).toContain('Test T-Shirt');
    });
  });

  describe('Shopping Cart', () => {
    test('Should add product to cart', async () => {
      const response = await request(app)
        .post('/shop/cart/add')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cartCount).toBe(2);
    });

    test('Should view cart', async () => {
      // Add item to cart first
      await request(app)
        .post('/shop/cart/add')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 1
        });

      const response = await request(app)
        .get('/shop/cart')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.text).toContain('Test T-Shirt');
    });

    test('Should update cart item quantity', async () => {
      // Add item to cart first
      await request(app)
        .post('/shop/cart/add')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 1
        });

      const response = await request(app)
        .put('/shop/cart/update')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cartCount).toBe(3);
    });

    test('Should remove item from cart', async () => {
      // Add item to cart first
      await request(app)
        .post('/shop/cart/add')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 1
        });

      const response = await request(app)
        .delete('/shop/cart/remove')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cartCount).toBe(0);
    });



    test('Should get cart count', async () => {
      // Add item to cart first
      await request(app)
        .post('/shop/cart/add')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 2
        });

      const response = await request(app)
        .get('/shop/cart/count')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
    });
  });

  describe('Product Model', () => {
    test('Should calculate total stock correctly', async () => {
      expect(testProduct.totalStock).toBe(15); // 10 + 5
    });

    test('Should check availability correctly', async () => {
      expect(testProduct.checkAvailability('M', 5)).toBe(true);
      expect(testProduct.checkAvailability('M', 15)).toBe(false);
      expect(testProduct.checkAvailability('XL', 1)).toBe(false);
    });

    test('Should update stock correctly', async () => {
      testProduct.updateStock([{ size: 'M', quantity: 3 }]);
      
      const mSize = testProduct.sizes.find(s => s.size === 'M');
      expect(mSize.stock).toBe(7); // 10 - 3
      expect(testProduct.totalStock).toBe(12); // 7 + 5
      expect(testProduct.totalSales).toBe(3);
    });
  });

  describe('Cart Model', () => {
    test('Should add item to cart correctly', async () => {
      const cart = new Cart({ user: testUser._id, items: [] });
      
      cart.addItem(testProduct._id, 'M', 2, testProduct.price);
      
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.totalItems).toBe(2);
      expect(cart.totalAmount).toBe(testProduct.price * 2);
    });

    test('Should update item quantity correctly', async () => {
      const cart = new Cart({ user: testUser._id, items: [] });
      
      cart.addItem(testProduct._id, 'M', 2, testProduct.price);
      cart.updateItemQuantity(testProduct._id, 'M', 5);
      
      expect(cart.items[0].quantity).toBe(5);
      expect(cart.totalItems).toBe(5);
    });

    test('Should remove item correctly', async () => {
      const cart = new Cart({ user: testUser._id, items: [] });
      
      cart.addItem(testProduct._id, 'M', 2, testProduct.price);
      cart.addItem(testProduct._id, 'L', 1, testProduct.price);
      cart.removeItem(testProduct._id, 'M');
      
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].size).toBe('L');
      expect(cart.totalItems).toBe(1);
    });


  });



  describe('Error Handling', () => {
    test('Should handle invalid product ID', async () => {
      const response = await request(app)
        .get('/shop/product/invalid-id')
        .expect(302); // Redirect to shop page
    });

    test('Should require authentication for cart operations', async () => {
      const response = await request(app)
        .post('/shop/cart/add')
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 1
        })
        .expect(302); // Redirect to login
    });

    test('Should handle insufficient stock', async () => {
      const response = await request(app)
        .post('/shop/cart/add')
        .set('Cookie', authCookie)
        .send({
          productId: testProduct._id,
          size: 'M',
          quantity: 20 // More than available stock
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient stock');
    });


  });
});

module.exports = {
  testUser,
  testProduct
};
