# Page Tracking Reference Guide

This document lists all pages in the application that are tracked by the page tracking middleware.

## Overview
- **Middleware Location**: `middleware/pageTracking.js`
- **Tracking Field**: User model's `currentPage` field updates on every page visit
- **Update Timestamp**: User model's `lastPageUpdate` field
- **Admin View**: Shows in `/admin/users/:id/details` under "Currently Viewing"
- **Accuracy**: Real-time tracking - updates on each request

---

## User-Facing Pages (Public)

| Path | Display Name |
|------|--------------|
| `/` | Home |
| `/about` | About Us |
| `/contact` | Contact Us |
| `/privacy-policy` | Privacy Policy |
| `/terms-of-service` | Terms of Service |
| `/refund-policy` | Refund Policy |
| `/subscription-policy` | Subscription Policy |
| `/shopping-policy` | Shopping Policy |
| `/event-attending-policy` | Event Policy |
| `/account-reactivation` | Account Reactivation |
| `/faq` | FAQ |
| `/content` | Content Library |
| `/website-updates` | Website Updates |
| `/website-updates/:id` | Update Details |

---

## User Dashboard & Profile

| Path | Display Name |
|------|--------------|
| `/dashboard` | Dashboard |
| `/users/profile` | My Profile |
| `/users/edit-profile` | Edit Profile |
| `/users/change-password` | Change Password |
| `/users/wallet` | My Wallet |
| `/users/settings` | Account Settings |

---

## Shopping & Orders

| Path | Display Name |
|------|--------------|
| `/shop` | Shop |
| `/orders` | My Orders |
| `/orders/my-orders` | My Orders |
| `/orders/confirmation/:orderNumber` | Order Confirmation |
| `/orders/order/:orderNumber` | Order Details |
| `/orders/invoice/:orderId` | Order Invoice |
| `/payments/success` | Payment Success |
| `/payments/failure` | Payment Failed |
| `/payments/details/:paymentId` | Payment Details |

---

## Concerts & Tickets

| Path | Display Name |
|------|--------------|
| `/concerts` | Concerts |
| `/concerts/create` | Create Concert |
| `/concerts/:id` | Concert Details |
| `/concerts/:id/book` | Book Concert |
| `/concerts/:id/edit` | Edit Concert |
| `/concerts/edit-requests` | Concert Edit Requests |
| `/concerts/edit-request/:requestId/details` | Edit Request Details |
| `/concerts/:id/request-edit` | Request Concert Edit |
| `/tickets` | My Tickets |
| `/daily-concerts` | Daily Concerts |

---

## Artist & Content

| Path | Display Name |
|------|--------------|
| `/artists` | Artists |
| `/artists/:id` | Artist Profile |
| `/artist-applications` | Artist Applications |
| `/artist-applications/select-level` | Select Artist Level |
| `/artist-applications/apply/:level` | Apply as Artist |
| `/artist-applications/status` | Application Status |
| `/stories` | Stories Feed |
| `/reviews` | Reviews |
| `/reviews/my-reviews` | My Reviews |
| `/reviews/product/:productId` | Product Reviews |
| `/content` | Content Library |

---

## Communication

| Path | Display Name |
|------|--------------|
| `/messages` | Messages |
| `/messages/conversation/:userId` | Conversation |
| `/notifications` | Notifications |

---

## Venues & Bookings

| Path | Display Name |
|------|--------------|
| `/users/venue-requests` | Venue Requests |
| `/users/venue-requests/create` | Create Venue Request |
| `/users/venue-requests/:id` | Venue Request Details |
| `/users/venues` | My Venues |
| `/users/venues/:id` | Venue Details |
| `/users/venues/:id/bookings` | Venue Bookings |
| `/venue-dashboard` | Venue Dashboard |
| `/venue-dashboard/:venueId/dashboard` | Venue Dashboard |
| `/venue-dashboard/:venueId/add-external-booking` | Add Booking |
| `/venue-dashboard/:venueId/external-bookings` | External Bookings |
| `/venue-availability` | Venue Availability |

---

## Other User Features

| Path | Display Name |
|------|--------------|
| `/search` | Search |
| `/follows` | Following |
| `/subscriptions` | Subscriptions |
| `/subscriptions/my-subscriptions` | My Subscriptions |
| `/refund-requests` | Refund Requests |

---

## Admin Dashboard & Management

| Path | Display Name |
|------|--------------|
| `/admin` | Admin Dashboard |
| `/admin/dashboard` | Admin Dashboard |
| `/admin/users` | Manage Users |
| `/admin/users/:id/details` | User Details |
| `/admin/users/:id/edit` | Edit User |
| `/admin/concerts` | Manage Concerts |
| `/admin/concerts/:id/edit` | Edit Concert |
| `/admin/concerts/:id/detail` | Concert Details |
| `/admin/tickets` | Manage Tickets |
| `/admin/tickets/:id` | Ticket Details |
| `/admin/tickets/export` | Export Tickets |
| `/admin/artists` | Manage Artists |
| `/admin/content` | Content Management |
| `/admin/posts` | Manage Posts |
| `/admin/subscriptions` | Manage Subscriptions |
| `/admin/roles` | Manage Roles |
| `/admin/pages` | Manage Pages |
| `/admin/sessions` | Manage Sessions |

---

## Admin Settings & Configuration

| Path | Display Name |
|------|--------------|
| `/admin/website-settings` | Website Settings |
| `/admin/website-updates` | Website Updates |
| `/admin/about` | About Us Settings |
| `/admin/team-updates` | Team Updates |
| `/admin/access-control` | Access Control |
| `/admin/contact-messages` | Contact Messages |

---

## Admin Content Management

| Path | Display Name |
|------|--------------|
| `/admin/compose-email` | Compose Email |
| `/admin/basic-email` | Email Templates |
| `/admin/media` | Media Library |

---

## Admin Merchandise & Shop

| Path | Display Name |
|------|--------------|
| `/admin/merchandise` | Manage Merchandise |

---

## Admin Venues & Requests

| Path | Display Name |
|------|--------------|
| `/admin/venues` | Manage Venues |
| `/admin/venue-requests` | Venue Requests |
| `/admin/venue-requests/:id` | Venue Request Details |
| `/admin/venue-edit-requests` | Venue Edit Requests |

---

## Admin Concert Management

| Path | Display Name |
|------|--------------|
| `/admin/daily-concerts` | Daily Concerts |
| `/admin/daily-concerts/:id` | Daily Concert Details |
| `/admin/concert-edit-requests` | Concert Edit Requests |

---

## Admin Artist Features

| Path | Display Name |
|------|--------------|
| `/admin/find-my-artist` | Find My Artist |
| `/admin/find-my-artist/featured-artists` | Featured Artists |
| `/admin/find-my-artist/role-slots` | Role Slots |
| `/admin/find-my-artist/booking-requests` | Booking Requests |

---

## Admin Notifications & Communication

| Path | Display Name |
|------|--------------|
| `/admin/notifications` | Notifications |

---

## Authentication Pages

| Path | Display Name |
|------|--------------|
| `/auth/login` | Login |
| `/auth/register` | Register |
| `/auth/forgot-password` | Forgot Password |
| `/auth/reset-password` | Reset Password |
| `/auth/set-new-password` | Set New Password |

---

## Other Pages

| Path | Display Name |
|------|--------------|
| `/demo` | Demo |

---

## How Page Tracking Works

### Real-time Updates
- Every HTTP request updates the user's current page in the database
- Updates happen asynchronously (non-blocking)
- No delay in response time
- Tracks both GET and POST requests

### Database Fields
```javascript
User Model Fields:
- currentPage: String (e.g., "Home", "My Profile")
- lastPageUpdate: Date (timestamp of last page visit)
- isOnline: Boolean (tracks login/logout status)
- currentLoginTime: Date (when user logged in today)
- lastLogin: Date (previous login timestamp)
```

### Admin Viewing
View user's current page in:
- `/admin/users/:id/details` → "Currently Viewing" section
- Shows page name and timestamp
- Updates in real-time as user navigates

### Smart Fallback Logic
If a page is not in the static mapping, the middleware uses intelligent fallback:
1. Checks for dynamic route patterns (e.g., `/concerts/123` → "Concert Details")
2. If still no match, extracts path segments (e.g., `/team-requirement/123` → "Team Requirement")
3. Handles edge cases like pagination, filtering, and query parameters

---

## Testing Page Tracking

1. **Login as Admin**: Visit `/admin`
2. **Navigate to Users**: Click "Manage Users"
3. **View User Details**: Click on any user → "View Details"
4. **Check Current Page**: Look for "Currently Viewing" section
5. **Navigate as User**: Log in as a regular user and visit different pages
6. **Verify Updates**: The "Currently Viewing" will update in real-time

---

## Troubleshooting

### Page shows as "Website" instead of actual page name
- The path is not in the static mapping
- Add it to `pageMapping` object in `middleware/pageTracking.js`

### Page tracking not updating
- Check if user is logged in (tracking only works for authenticated users)
- Check browser network tab for failed requests
- Check server logs for errors

### Incorrect page detected
- Dynamic routes may be misidentified
- Check fallback logic in middleware
- Update pattern matching if needed

---

## Last Updated
- Date: January 7, 2026
- Version: Comprehensive (120+ pages)
- All major routes and subpages included
