# RAPIRA Platform - Complete Project Documentation

## 1. Company Profile

**Company Name:** Valrein

**Address:** WARD NO. 14, Ajay Vachan Colony, Suraj Ganj, Itarsi - 461111, Dist: Hoshangabad

**Contact:** +91 7880009340

**Website:** RAPIRA Digital Entertainment Platform

---

## 2. Project Profile

### 2.1 Project Overview

**RAPIRA** is a comprehensive digital entertainment platform that serves as a centralized hub connecting artists, event organizers, and users for discovering, promoting, and engaging with entertainment content and live events. The platform specializes in Indian rap music culture while supporting various entertainment formats.

### 2.2 Key Features

#### User Features
- User registration and authentication with session-based security
- Profile creation with image uploads, social media links, and bio
- Concert discovery based on location and date filtering
- Ticket booking system for both free and paid events
- Multiple ticket purchasing with attendee details
- Email notifications for bookings and confirmations
- Subscription plans for special offers and discounts

#### Artist Features
- Comprehensive artist profiles with stage names, genres, and achievements
- Content upload system for songs, lyrics, videos, and media files
- Concert submission system with admin approval workflow
- Artist dashboard for managing upcoming and past events
- Ticket sales tracking and audience engagement analytics
- Artist application system with verification process
- Learning modules for skill development

#### Admin Features
- Comprehensive admin dashboard with real-time analytics
- User management system with role-based access control
- Artist verification and approval system
- Concert management with approval/rejection capabilities
- Content moderation and management
- Subscription plan creation and management
- Payment and refund processing oversight
- Email notification system management
- Featured artist promotion system
- Team role and booking management

#### Payment & Subscription System
- Secure payment processing with Razorpay integration
- Multiple subscription plans with discount benefits
- Automated billing and renewal system
- Refund processing with admin approval
- QR code generation for ticket verification
- Revenue tracking and financial analytics

### 2.3 Technology Stack

**Backend:**
- Node.js with Express.js framework
- MongoDB with Mongoose ODM
- Session-based authentication
- Multer for file uploads
- EJS templating engine

**Frontend:**
- Bootstrap 5 for responsive design
- Custom CSS with glass-morphism effects
- JavaScript for interactive features
- Chart.js for analytics visualization

**Payment Integration:**
- Razorpay payment gateway
- Secure payment verification
- Order management system

**Email Services:**
- Brevo API for email notifications
- Automated email templates
- Booking confirmations and updates

**File Management:**
- Local file storage system
- Image optimization and processing
- Media file handling for audio/video content

---

## 3. UML Diagrams

### 3.1 Use Case Diagram

```
                    RAPIRA Platform Use Cases

    Admin                    Artist                    User
      |                        |                        |
      |-- Manage Users         |-- Create Profile       |-- Register/Login
      |-- Approve Concerts     |-- Upload Content       |-- Browse Concerts
      |-- Manage Content       |-- Submit Concerts      |-- Book Tickets
      |-- Process Refunds      |-- Track Sales          |-- Purchase Subscriptions
      |-- Create Subscriptions |-- View Analytics       |-- View Content
      |-- Monitor Platform     |-- Manage Bookings      |-- Contact Support
      |-- Send Notifications   |-- Complete Learning    |-- Update Profile
```

### 3.2 Class Diagram

```
User
├── _id: ObjectId
├── name: String
├── email: String (unique)
├── password: String
├── role: String (user/artist/admin)
├── profileImage: String
├── bio: String
├── city: String
├── socialLinks: Object
├── createdAt: Date
└── isVerified: Boolean

Artist
├── _id: ObjectId
├── user: ObjectId (ref: User)
├── stageName: String
├── genre: String
├── artistLevel: String
├── yearsActive: Number
├── verified: Boolean
├── featuredArtist: Boolean
├── about: String
├── achievements: [String]
├── bannerImage: String
└── aadharCard: String

Concert
├── _id: ObjectId
├── artist: ObjectId (ref: Artist)
├── title: String
├── description: String
├── date: Date
├── time: String
├── venue: String
├── city: String
├── isPaid: Boolean
├── price: Number
├── posterImage: String
├── status: String
├── maxTickets: Number
└── ticketsSold: Number

Ticket
├── _id: ObjectId
├── concert: ObjectId (ref: Concert)
├── user: ObjectId (ref: User)
├── attendees: [Object]
├── quantity: Number
├── totalAmount: Number
├── paymentId: String
├── orderId: String
├── paymentStatus: String
└── purchaseDate: Date

SubscriptionPlan
├── _id: ObjectId
├── name: String
├── price: Number
├── duration: Number
├── durationUnit: String
├── benefits: String
├── discountPercentage: Number
├── isActive: Boolean
└── createdBy: ObjectId (ref: User)

UserSubscription
├── _id: ObjectId
├── user: ObjectId (ref: User)
├── plan: ObjectId (ref: SubscriptionPlan)
├── purchaseDate: Date
├── expiryDate: Date
├── status: String
├── paymentId: String
├── orderId: String
└── amount: Number
```

### 3.3 Sequence Diagram - Ticket Booking Process

```
User -> Platform: Browse Concerts
Platform -> Database: Fetch Available Concerts
Database -> Platform: Return Concert List
Platform -> User: Display Concerts

User -> Platform: Select Concert & Book Tickets
Platform -> Razorpay: Create Payment Order
Razorpay -> Platform: Return Order Details
Platform -> User: Display Payment Form

User -> Razorpay: Submit Payment
Razorpay -> Platform: Payment Callback
Platform -> Database: Verify & Save Ticket
Database -> Platform: Confirm Ticket Creation
Platform -> Email Service: Send Confirmation
Email Service -> User: Ticket Confirmation Email
Platform -> User: Booking Success Page
```

### 3.4 Activity Diagram - Artist Content Upload

```
Start -> Login as Artist
Login -> Check Artist Verification
Verification -> Access Upload Form
Upload Form -> Select Content Type (Song/Video)
Content Type -> Upload Media File
Media File -> Add Title & Description
Description -> Add Tags & Release Date
Release Date -> Submit for Review
Review -> Admin Approval Process
Approval -> Content Published
Published -> Notify Artist
Notify -> End
```

### 3.5 Entity Relationship Diagram

```
Users ||--o{ Artists : "has profile"
Artists ||--o{ Concerts : "creates"
Artists ||--o{ Content : "uploads"
Users ||--o{ Tickets : "purchases"
Concerts ||--o{ Tickets : "generates"
Users ||--o{ UserSubscriptions : "subscribes to"
SubscriptionPlans ||--o{ UserSubscriptions : "includes"
Users ||--o{ ArtistApplications : "submits"
Artists ||--o{ ArtistBookingRequests : "receives"
Roles ||--o{ UserRoles : "assigned to"
Users ||--o{ UserRoles : "has"
LearningModules ||--o{ LearningProgress : "tracks"
Users ||--o{ LearningProgress : "completes"
```

---

## 4. Data Dictionary

### 4.1 Users Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for user |
| name | String | Full name of the user |
| email | String | Email address (unique) |
| password | String | Encrypted password |
| role | String | User role (user/artist/admin) |
| profileImage | String | Profile image file path |
| bio | String | User biography |
| city | String | User's city |
| socialLinks | Object | Social media links |
| createdAt | Date | Account creation date |
| isVerified | Boolean | Email verification status |

### 4.2 Artists Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for artist |
| user | ObjectId | Reference to User document |
| stageName | String | Artist's stage name |
| genre | String | Music genre |
| artistLevel | String | Skill level (Beginner/Intermediate/Established) |
| yearsActive | Number | Years of experience |
| verified | Boolean | Admin verification status |
| featuredArtist | Boolean | Featured artist status |
| about | String | Artist description |
| achievements | Array | List of achievements |
| bannerImage | String | Banner image path |
| aadharCard | String | Aadhaar card number |

### 4.3 Concerts Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for concert |
| artist | ObjectId | Reference to Artist document |
| title | String | Concert title |
| description | String | Concert description |
| date | Date | Concert date |
| time | String | Concert time |
| venue | String | Venue name |
| city | String | Concert city |
| isPaid | Boolean | Paid/free concert flag |
| price | Number | Ticket price |
| posterImage | String | Concert poster path |
| status | String | Approval status |
| maxTickets | Number | Maximum tickets available |
| ticketsSold | Number | Number of tickets sold |

### 4.4 Tickets Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for ticket |
| concert | ObjectId | Reference to Concert document |
| user | ObjectId | Reference to User document |
| attendees | Array | List of attendee details |
| quantity | Number | Number of tickets |
| totalAmount | Number | Total payment amount |
| paymentId | String | Razorpay payment ID |
| orderId | String | Razorpay order ID |
| paymentStatus | String | Payment status |
| purchaseDate | Date | Ticket purchase date |

### 4.5 SubscriptionPlans Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for plan |
| name | String | Subscription plan name |
| price | Number | Plan price |
| duration | Number | Plan duration value |
| durationUnit | String | Duration unit (days/months) |
| benefits | String | Plan benefits description |
| discountPercentage | Number | Discount on tickets |
| isActive | Boolean | Plan availability status |
| createdBy | ObjectId | Admin who created plan |

### 4.6 UserSubscriptions Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for subscription |
| user | ObjectId | Reference to User document |
| plan | ObjectId | Reference to SubscriptionPlan |
| purchaseDate | Date | Subscription purchase date |
| expiryDate | Date | Subscription expiry date |
| status | String | Subscription status |
| paymentId | String | Razorpay payment ID |
| orderId | String | Razorpay order ID |
| amount | Number | Amount paid |

### 4.7 Content Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for content |
| artist | ObjectId | Reference to Artist document |
| title | String | Content title |
| type | String | Content type (song/video) |
| description | String | Content description |
| fileUrl | String | Media file path |
| thumbnailUrl | String | Thumbnail image path |
| releaseDate | Date | Content release date |
| likes | Number | Number of likes |
| views | Number | Number of views |
| featured | Boolean | Featured content flag |

### 4.8 LearningModules Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for module |
| title | String | Module title |
| description | String | Module description |
| contentType | String | Type (video/text/pdf/link) |
| content | String | Module content/URL |
| thumbnailImage | String | Module thumbnail |
| forArtistLevel | String | Target artist level |
| order | Number | Display order |
| isRequired | Boolean | Mandatory module flag |
| createdBy | ObjectId | Admin who created module |

### 4.9 Venues Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for venue |
| name | String | Venue name |
| address | String | Street address |
| city | String | Venue city |
| state | String | Venue state |
| pincode | String | Postal code |
| capacity | Number | Maximum capacity |
| venueType | String | Type (Indoor Hall/Outdoor/etc.) |
| facilities | Array | Available facilities |
| contactPerson | Object | Contact person details |
| pricing | Object | Pricing and commission structure |
| isActive | Boolean | Venue availability status |
| isVerified | Boolean | Admin verification status |
| googleMapsLink | String | Google Maps link |
| createdBy | ObjectId | User who created venue |
| lastUpdatedBy | ObjectId | User who last updated venue |

### 4.10 Notifications Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for notification |
| module | String | Notification module type |
| requestId | ObjectId | Reference to related request |
| modelRef | String | Referenced model name |
| title | String | Notification title |
| message | String | Notification message |
| isRead | Boolean | Read status |
| isPending | Boolean | Pending status |
| actionType | String | Required action type |
| actionUrl | String | Action URL |
| targetRole | String | Target user role |
| priority | String | Notification priority |
| expiresAt | Date | Expiration date |

### 4.11 RefundRequests Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for refund |
| ticket | ObjectId | Reference to Ticket document |
| user | ObjectId | Reference to User document |
| reason | String | Refund reason |
| status | String | Request status |
| requestedAmount | Number | Requested refund amount |
| processedAmount | Number | Actual refund amount |
| adminComments | String | Admin comments |
| processedBy | ObjectId | Admin who processed |
| requestedAt | Date | Request submission date |
| processedAt | Date | Processing date |

### 4.12 Orders Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for order |
| user | ObjectId | Reference to User document |
| items | Array | Order items array |
| totalAmount | Number | Total order amount |
| paymentStatus | String | Payment status |
| paymentId | String | Payment gateway ID |
| orderId | String | Payment gateway order ID |
| shippingAddress | Object | Delivery address |
| orderStatus | String | Order processing status |
| trackingNumber | String | Shipping tracking number |

### 4.13 Products Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for product |
| name | String | Product name |
| description | String | Product description |
| price | Number | Product price |
| category | String | Product category |
| images | Array | Product image URLs |
| stock | Number | Available stock |
| isActive | Boolean | Product availability |
| artist | ObjectId | Associated artist (if any) |
| createdBy | ObjectId | Admin who created product |

### 4.14 ArtistApplications Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for application |
| user | ObjectId | Reference to User document |
| stageName | String | Proposed stage name |
| genre | String | Music genre |
| artistLevel | String | Experience level |
| yearsActive | Number | Years of experience |
| about | String | Artist description |
| achievements | Array | List of achievements |
| socialLinks | Object | Social media links |
| sampleWork | Array | Sample music/video files |
| status | String | Application status |
| submittedAt | Date | Submission date |
| reviewedAt | Date | Review date |
| reviewedBy | ObjectId | Admin who reviewed |

### 4.15 ConcertEditRequests Collection

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| _id | ObjectId | Unique identifier for edit request |
| concert | ObjectId | Reference to Concert document |
| artist | ObjectId | Reference to Artist document |
| requestedChanges | Object | Requested modifications |
| reason | String | Reason for changes |
| status | String | Request status |
| requestedAt | Date | Request submission date |
| reviewedAt | Date | Review date |
| reviewedBy | ObjectId | Admin who reviewed |
| adminMessage | String | Admin response message |

---

## 5. Screen Layouts

### 5.1 User-Facing Pages

#### 5.1.1 Home Page
```
[Header with Logo] [Navigation Menu] [Login/Register]
[Hero Section with Featured Content]
[Featured Artists Carousel]
[Upcoming Concerts Grid]
[Latest Music/Videos Section]
[Subscription Plans Preview]
[Footer with Links and Contact]
```

#### 5.1.2 Artist Gallery
```
[Search and Filter Bar]
[Artist Cards Grid Layout]
  - Artist Image
  - Stage Name
  - Genre
  - Verification Badge
  - View Profile Button
[Pagination Controls]
```

#### 5.1.3 Event Listing
```
[Search by City/Date Filters]
[Concert Cards Layout]
  - Concert Poster
  - Title and Artist
  - Date, Time, Venue
  - Price/Free Badge
  - Book Tickets Button
[Load More/Pagination]
```

#### 5.1.4 Ticket Booking
```
[Concert Details Header]
[Ticket Quantity Selector]
[Attendee Information Form]
[Price Calculation Summary]
[Payment Method Selection]
[Terms and Conditions]
[Proceed to Payment Button]
```

#### 5.1.5 Subscription Page
```
[Subscription Plans Comparison Table]
  - Plan Name
  - Price
  - Duration
  - Benefits List
  - Discount Percentage
  - Subscribe Button
[Current Subscription Status]
[Subscription History]
```

### 5.2 Admin Dashboard Pages

#### 5.2.1 Dashboard Overview
```
[Statistics Cards Row]
  - Total Users | Total Artists | Total Concerts | Total Revenue
[Charts Section]
  - Revenue Chart | Concert Statistics | City-wise Distribution
[Recent Activities Table]
[Quick Action Buttons]
```

#### 5.2.2 User Management
```
[Search and Filter Controls]
[Users Data Table]
  - Profile Image | Name | Email | Role | Registration Date | Actions
[Pagination Controls]
[Bulk Actions Toolbar]
```

#### 5.2.3 Artist Management
```
[Artist Verification Queue]
[Search and Filter Options]
[Artists Data Table]
  - Profile | Stage Name | Genre | Level | Verification Status | Actions
[Featured Artists Section]
```

#### 5.2.4 Concert Management
```
[Pending Approvals Section]
[Concert Status Filters]
[Concerts Data Table]
  - Poster | Title | Artist | Date | Status | Tickets Sold | Actions
[Approval/Rejection Modal]
```

#### 5.2.5 Subscription Management
```
[Create New Plan Form]
[Active Plans Table]
  - Plan Name | Price | Duration | Discount | Status | Actions
[User Subscriptions Overview]
[Revenue Analytics]
```

#### 5.2.6 Content Management
```
[Content Type Filters]
[Content Grid/List View]
  - Thumbnail | Title | Artist | Type | Upload Date | Status | Actions
[Featured Content Section]
[Content Moderation Tools]
```

---

## 6. System Architecture

### 6.1 Application Architecture
- **MVC Pattern**: Model-View-Controller architecture
- **RESTful APIs**: Standard HTTP methods for CRUD operations
- **Session Management**: Server-side session storage
- **File Upload System**: Multer middleware for media handling
- **Email Integration**: Brevo API for notifications
- **Payment Gateway**: Razorpay integration for secure payments

### 6.2 Database Design
- **MongoDB**: NoSQL document database
- **Mongoose ODM**: Object Document Mapping
- **Indexing**: Optimized queries with proper indexing
- **Relationships**: Referenced documents for data integrity
- **Validation**: Schema-level data validation

### 6.3 Security Features
- **Password Encryption**: bcrypt hashing
- **Session Security**: Secure session configuration
- **File Upload Validation**: MIME type and size restrictions
- **Input Sanitization**: XSS and injection prevention
- **Payment Security**: Razorpay signature verification

---

## 7. API Endpoints

### 7.1 Authentication Routes
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/logout` - User logout
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset confirmation

### 7.2 User Routes
- `GET /users/profile` - View user profile
- `POST /users/profile` - Update user profile
- `POST /users/upload-image` - Upload profile image

### 7.3 Artist Routes
- `GET /artists` - List all artists
- `GET /artists/:id` - View artist profile
- `POST /artists/apply` - Submit artist application
- `GET /artists/dashboard` - Artist dashboard

### 7.4 Concert Routes
- `GET /concerts` - List concerts
- `GET /concerts/:id` - View concert details
- `POST /concerts/create` - Create new concert
- `PUT /concerts/:id` - Update concert

### 7.5 Ticket Routes
- `POST /tickets/book` - Book tickets
- `GET /tickets/my-tickets` - User's tickets
- `POST /tickets/refund` - Request refund

### 7.6 Payment Routes
- `POST /payments/create-order` - Create payment order
- `POST /payments/verify` - Verify payment
- `POST /payments/refund` - Process refund

### 7.7 Subscription Routes
- `GET /subscriptions/plans` - List subscription plans
- `POST /subscriptions/purchase` - Purchase subscription
- `POST /subscriptions/verify-payment` - Verify subscription payment

### 7.8 Admin Routes
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/users` - Manage users
- `GET /admin/artists` - Manage artists
- `GET /admin/concerts` - Manage concerts
- `POST /admin/approve-concert/:id` - Approve concert
- `POST /admin/reject-concert/:id` - Reject concert

---

## 8. Conclusion

The RAPIRA platform successfully addresses the growing need for a comprehensive digital entertainment ecosystem in the Indian rap music industry. By providing a centralized platform that connects artists, event organizers, and music enthusiasts, RAPIRA facilitates:

### 8.1 Key Benefits

**For Artists:**
- Professional platform for showcasing talent and building audience
- Streamlined concert organization and ticket sales management
- Learning resources for skill development and career growth
- Revenue generation through content monetization and live events

**For Users:**
- Easy discovery of local and national rap artists and events
- Convenient ticket booking with secure payment processing
- Access to exclusive content and subscription benefits
- Community engagement through artist interactions

**For Event Organizers:**
- Efficient artist booking and event management system
- Integrated payment processing and ticket sales tracking
- Comprehensive analytics for event performance monitoring
- Automated communication and notification systems

**For Platform Administrators:**
- Complete control over platform content and user management
- Revenue tracking and financial analytics
- Scalable subscription and pricing model management
- Comprehensive reporting and monitoring capabilities

### 8.2 Technical Achievements

The platform demonstrates successful implementation of:
- Scalable web application architecture using modern technologies
- Secure payment processing with industry-standard practices
- Responsive design ensuring accessibility across all devices
- Robust file management system for multimedia content
- Comprehensive admin dashboard for platform management
- Automated email notification system for user engagement

### 8.3 Future Scope

RAPIRA provides a solid foundation for future enhancements including:
- Mobile application development for iOS and Android
- Advanced analytics and recommendation systems
- Live streaming capabilities for virtual concerts
- Social media integration and sharing features
- Multi-language support for broader reach
- Advanced search and discovery algorithms

The platform successfully digitizes entertainment event management, ticketing, and artist promotions in one centralized, user-friendly system, contributing to the growth and organization of the Indian rap music industry.

---

## 9. Bibliography

**Primary Sources:**
- Self-developed system using research and practical logic
- Industry best practices for web application development
- MongoDB documentation and best practices
- Node.js and Express.js official documentation
- Razorpay payment gateway integration guidelines
- Bootstrap 5 framework documentation

**Technical References:**
- RESTful API design principles
- MVC architecture patterns
- Database design and optimization techniques
- Web security best practices
- User experience design principles

**Industry Research:**
- Digital entertainment platform analysis
- Music industry digitization trends
- Event management system requirements
- Payment gateway integration standards
- Email marketing and notification systems

---

*Document Version: 1.0*  
*Last Updated: June 2025*  
*Prepared by: Valrein Development Team*
