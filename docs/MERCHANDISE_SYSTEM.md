# RAPIRA Merchandise eCommerce System

## Overview

The RAPIRA Merchandise eCommerce System is a comprehensive online shopping platform integrated into the RAPIRA digital entertainment platform. It allows users to browse, purchase, and review RAPIRA branded merchandise while providing administrators with powerful tools to manage products, orders, coupons, and customer reviews.

## Features

### Customer Features

#### Product Browsing & Search
- **Product Catalog**: Browse all available merchandise with filtering and sorting options
- **Advanced Search**: Search products by name, description, category, and tags
- **Category Filtering**: Filter products by categories (Clothing, Accessories, Collectibles, Music, etc.)
- **Price Range Filtering**: Filter products by price range
- **Stock Availability**: Filter to show only in-stock items
- **Product Details**: Detailed product pages with multiple images, descriptions, and specifications

#### Shopping Cart & Checkout
- **Shopping Cart**: Add products to cart with size and quantity selection
- **Cart Management**: Update quantities, remove items, and apply coupon codes
- **Secure Checkout**: Integrated with Razorpay for secure payment processing
- **Address Management**: Save multiple shipping addresses for quick checkout
- **Order Confirmation**: Email confirmations with order details and tracking information

#### Order Management
- **Order History**: View all past orders with detailed information
- **Order Tracking**: Track order status from confirmation to delivery
- **Order Cancellation**: Cancel orders within the allowed timeframe
- **Digital Receipts**: Download and print order receipts

#### Reviews & Ratings
- **Product Reviews**: Write detailed reviews for purchased products
- **Rating System**: 5-star rating system with helpful vote functionality
- **Verified Purchase**: Reviews marked as verified purchases for authenticity
- **Review Moderation**: All reviews are moderated before publication

### Admin Features

#### Product Management
- **Product Creation**: Add new products with multiple images, sizes, and inventory
- **Inventory Management**: Track stock levels across different sizes
- **Product Categories**: Organize products into categories
- **Featured Products**: Mark products as featured for homepage display
- **Bulk Operations**: Perform bulk actions on multiple products
- **Product Analytics**: View sales data and performance metrics

#### Order Management
- **Order Dashboard**: Comprehensive view of all orders with filtering options
- **Order Processing**: Update order status and add tracking information
- **Order Analytics**: View order statistics and revenue data
- **Customer Information**: Access customer details and shipping addresses
- **Refund Processing**: Handle refunds and cancellations



#### Review Management
- **Review Moderation**: Approve or reject customer reviews
- **Admin Responses**: Respond to customer reviews as an administrator
- **Review Analytics**: Monitor review trends and customer satisfaction
- **Bulk Moderation**: Approve or reject multiple reviews at once

## Technical Architecture

### Database Models

#### Product Model
```javascript
{
  name: String,
  description: String,
  category: String,
  price: Number,
  comparePrice: Number,
  images: [String],
  sizes: [{
    size: String,
    stock: Number
  }],
  tags: [String],
  isActive: Boolean,
  isFeatured: Boolean,
  averageRating: Number,
  totalReviews: Number,
  totalSales: Number
}
```

#### Order Model
```javascript
{
  orderNumber: String,
  user: ObjectId,
  items: [{
    product: ObjectId,
    productName: String,
    productImage: String,
    size: String,
    quantity: Number,
    price: Number,
    totalPrice: Number
  }],
  shippingAddress: Object,
  subtotal: Number,
  discountAmount: Number,
  totalAmount: Number,
  paymentStatus: String,
  orderStatus: String,
  trackingNumber: String
}
```

#### Cart Model
```javascript
{
  user: ObjectId,
  items: [{
    product: ObjectId,
    size: String,
    quantity: Number,
    price: Number
  }],
  totalItems: Number,
  totalAmount: Number,
  appliedCoupon: Object,
  finalAmount: Number
}
```

### API Endpoints

#### Shop Routes (`/shop`)
- `GET /` - Browse products with filtering and pagination
- `GET /product/:id` - Get product details
- `POST /cart/add` - Add item to cart
- `GET /cart` - View shopping cart
- `PUT /cart/update` - Update cart item quantity
- `DELETE /cart/remove` - Remove item from cart
- `POST /cart/apply-coupon` - Apply coupon code
- `GET /checkout` - Checkout page
- `POST /checkout` - Process checkout

#### Order Routes (`/orders`)
- `POST /verify-payment` - Verify payment and create order
- `GET /confirmation/:orderId` - Order confirmation page
- `GET /my-orders` - User's order history
- `GET /order/:orderNumber` - Order details
- `POST /cancel/:orderId` - Cancel order

#### Review Routes (`/reviews`)
- `POST /add` - Add product review
- `GET /product/:productId` - Get product reviews
- `POST /:reviewId/helpful` - Mark review as helpful
- `GET /my-reviews` - User's reviews

#### Admin Routes (`/admin/merchandise`)
- `GET /products` - Product management dashboard
- `POST /products/add` - Create new product
- `PUT /products/edit/:id` - Update product
- `DELETE /products/:id` - Delete product
- `GET /orders` - Order management dashboard
- `POST /orders/:id/status` - Update order status


### Payment Integration

The system integrates with Razorpay for secure payment processing:

1. **Order Creation**: Create Razorpay order with amount and currency
2. **Payment Gateway**: Redirect user to Razorpay checkout
3. **Payment Verification**: Verify payment signature on callback
4. **Order Confirmation**: Create order record and send confirmation email

### Email Notifications

Automated email notifications are sent for:
- Order confirmation with order details
- Order status updates (shipped, delivered)
- Refund confirmations
- Review approval notifications

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Razorpay account for payment processing
- Brevo account for email services

### Environment Variables
```env
# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email Service
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_sender_email
BREVO_SENDER_NAME=RAPIRA

# Application
BASE_URL=http://localhost:3000
```

### Database Setup
The system will automatically create the required collections and indexes when the application starts.

## Usage Guide

### For Customers

1. **Browse Products**: Visit `/shop` to browse the product catalog
2. **Add to Cart**: Select size and quantity, then add products to cart
3. **Checkout**: Proceed to checkout and enter shipping information
4. **Payment**: Complete payment through Razorpay
5. **Track Orders**: View order status in "My Orders" section
6. **Write Reviews**: Review products after delivery

### For Administrators

1. **Product Management**: Access `/admin/merchandise/products` to manage products
2. **Order Processing**: Monitor and update orders at `/admin/merchandise/orders`
3. **Coupon Creation**: Create and manage coupons at `/admin/merchandise/coupons`
4. **Review Moderation**: Moderate customer reviews at `/reviews/admin`

## Security Features

- **Payment Security**: PCI DSS compliant payment processing through Razorpay
- **Data Validation**: Server-side validation for all user inputs
- **Authentication**: Secure user authentication and session management
- **Authorization**: Role-based access control for admin features
- **CSRF Protection**: Cross-site request forgery protection
- **SQL Injection Prevention**: MongoDB ODM prevents injection attacks

## Performance Optimizations

- **Database Indexing**: Optimized indexes for fast product searches
- **Image Optimization**: Compressed product images for faster loading
- **Caching**: Session-based cart caching for improved performance
- **Pagination**: Efficient pagination for large product catalogs
- **Lazy Loading**: Lazy loading for product images and reviews

## Support & Maintenance

### Monitoring
- Order processing monitoring
- Payment gateway status monitoring
- Email delivery monitoring
- Database performance monitoring

### Backup & Recovery
- Daily database backups
- Product image backups
- Order data retention policies
- Disaster recovery procedures

## Future Enhancements

- **Wishlist Functionality**: Allow users to save products for later
- **Product Recommendations**: AI-powered product recommendations
- **Inventory Alerts**: Low stock notifications for administrators
- **Advanced Analytics**: Detailed sales and customer analytics
- **Mobile App**: Native mobile application for iOS and Android
- **Multi-language Support**: Internationalization for global customers

## API Documentation

Detailed API documentation is available at `/docs/api` when the application is running in development mode.

## Contributing

Please refer to the main project's contributing guidelines for information on how to contribute to the merchandise system.

## License

This merchandise system is part of the RAPIRA platform and is subject to the same licensing terms as the main project.
