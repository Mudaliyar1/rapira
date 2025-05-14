# Subscription System Documentation

This document provides an overview of the subscription system implemented in the Rapira platform.

## Overview

The subscription system allows users to purchase subscription plans that provide benefits such as discounts on ticket purchases and other exclusive features. The system is integrated with Razorpay for payment processing and uses the existing infrastructure.

## Features

- **Subscription Plans Management**: Admin can create, edit, and manage subscription plans
- **User Subscription Purchase**: Users can purchase subscription plans using Razorpay
- **Subscription Benefits**: Subscribers get discounts on ticket purchases
- **Subscription Tracking**: Users can view their active subscriptions and history
- **Automatic Expiry**: System automatically marks expired subscriptions

## Database Models

### Subscription Plan Model

- `name`: Name of the subscription plan
- `price`: Price of the subscription plan
- `duration`: Duration of the subscription in days
- `benefits`: Description of the benefits
- `discountPercentage`: Percentage discount on ticket purchases
- `isActive`: Whether the plan is active or not
- `createdBy`: Admin who created the plan

### User Subscription Model

- `user`: Reference to the user who purchased the subscription
- `plan`: Reference to the subscription plan
- `purchaseDate`: Date when the subscription was purchased
- `expiryDate`: Date when the subscription expires
- `status`: Status of the subscription (active/expired)
- `paymentId`: Razorpay payment ID
- `orderId`: Razorpay order ID
- `amount`: Amount paid for the subscription

## Routes

### Public Routes

- `/subscriptions`: View available subscription plans
- `/subscriptions/purchase/:id`: Purchase a subscription plan
- `/subscriptions/my-subscriptions`: View user's active subscriptions and history

### Admin Routes

- `/admin/subscriptions/plans`: Manage subscription plans
- `/admin/subscriptions/plans/add`: Add a new subscription plan
- `/admin/subscriptions/plans/edit/:id`: Edit a subscription plan
- `/admin/subscriptions/users`: View all user subscriptions

## How to Use

### For Admins

1. **Create Subscription Plans**:
   - Go to Admin Dashboard > Subscription Management > Subscription Plans
   - Click "Add New Plan"
   - Fill in the plan details (name, price, duration, benefits, discount percentage)
   - Click "Create Plan"

2. **Manage Subscription Plans**:
   - View all plans in the Subscription Plans page
   - Edit or delete plans as needed
   - Deactivate plans by unchecking the "Active" checkbox

3. **View User Subscriptions**:
   - Go to Admin Dashboard > Subscription Management > User Subscriptions
   - View all user subscriptions, their status, and expiry dates

### For Users

1. **Purchase a Subscription**:
   - Go to the Subscriptions page
   - Browse available subscription plans
   - Click "Subscribe Now" on the desired plan
   - Complete the payment process using Razorpay

2. **View Active Subscription**:
   - Go to User Dashboard > My Subscriptions
   - View active subscription details, benefits, and expiry date
   - See subscription history

3. **Use Subscription Benefits**:
   - Discounts are automatically applied during ticket purchase
   - The discount amount is shown on the booking page

## Implementation Details

### Subscription Purchase Flow

1. User selects a subscription plan
2. System creates a Razorpay order
3. User completes payment
4. System verifies payment and activates subscription
5. Confirmation email is sent to the user

### Discount Application Flow

1. User with active subscription visits concert booking page
2. System checks for active subscription
3. If subscription has discount benefit, it's applied to ticket price
4. Discounted price is shown to user
5. Discount information is stored with the ticket

### Subscription Expiry

1. System runs a daily check for expired subscriptions
2. Subscriptions past their expiry date are marked as expired
3. Benefits are no longer applied once subscription expires

## Making a Super Admin

To make a user a super admin, run the following command:

```bash
npm run make-super-admin
```

This will make the user with email `vijaymudaliyar224@gmail.com` and password `vijay123` a super admin.

To specify a different email and password:

```bash
npm run make-super-admin -- user@example.com newpassword
```

## Troubleshooting

### Common Issues

1. **Subscription not showing as active**:
   - Check if the subscription has expired
   - Verify that the payment was successful
   - Check the subscription status in the database

2. **Discount not being applied**:
   - Verify that the subscription plan has a discount percentage set
   - Check if the subscription is active
   - Ensure the middleware is properly checking for active subscriptions

3. **Cron jobs not running**:
   - Make sure node-cron is properly installed
   - Check server logs for any errors in the cron job initialization
   - Verify that the cron job schedule is correct

### Support

For any issues or questions about the subscription system, please contact the development team.
