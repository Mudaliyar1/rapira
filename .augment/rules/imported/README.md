---
type: "manual"
---

# Rapira - Indian Rap Music Platform

Rapira is a dynamic platform for Indian rap artists to showcase their music, organize concerts, and connect with fans. The platform enables artists to upload content, create concerts, and engage with their audience, while fans can discover artists, book tickets, and attend events.

## Features

### User Features
- User registration and login with session-based authentication
- Profile creation with image, social links, and bio
- Explore concerts based on location and date
- Book free or paid concerts with multiple tickets
- Email notifications for ticket bookings

### Artist Features
- Artist profile with stage name, genre, and achievements
- Upload songs, lyrics, and videos
- Submit concerts for admin approval
- Manage upcoming and past concerts
- Track ticket sales and engagement

### Admin Features
- Comprehensive dashboard with analytics
- Manage users, artists, concerts, and content
- Approve or reject concert submissions
- View payment and ticket details
- Monitor platform activity

### Payment System
- Secure payment processing with Razorpay
- Multiple ticket booking with attendee details
- Email confirmation with ticket details
- QR code for ticket verification

## Tech Stack

- **Frontend**: EJS Templating + Bootstrap 5
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (via Mongoose ODM)
- **Email Service**: Brevo (Sendinblue)
- **Payments**: Razorpay

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/rapira.git
   cd rapira
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory (use the provided `.env.example` as a template):
   ```
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_session_secret

   # Email Configuration (Brevo API)
   BREVO_API_KEY=your_brevo_api_key

   # Payment Configuration (Razorpay)
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret

   # Admin Configuration
   ADMIN_EMAIL=admin@rapira.com
   ADMIN_PASSWORD=your_admin_password

   # Application Configuration
   BASE_URL=http://localhost:3000

   # For production deployment
   # NODE_ENV=production
   # BASE_URL=https://your-production-domain.com
   ```

4. Create the admin user:
   ```
   npm run create-admin
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Environment Configuration

The application supports both development and production environments. We've provided scripts to easily switch between them:

> **SECURITY NOTE**: Environment files contain sensitive information and should never be committed to version control. See [SECURITY.md](SECURITY.md) for more information.

### Switching Environments

1. To switch to development mode:
   ```
   node scripts/switch-env.js dev
   ```

2. To switch to production mode:
   ```
   node scripts/switch-env.js prod
   ```

### Environment Files

- `.env` - The active environment configuration
- `.env.development` - Development environment settings
- `.env.production` - Production environment settings

### Troubleshooting Session Issues

If you experience login issues, you can clear all sessions with:
```
node scripts/fix-sessions.js
```

This script will:
- Clear all existing sessions in the database
- Verify your environment configuration
- Provide diagnostic information

### Security Check

Run the security check to ensure your project doesn't contain sensitive information:

```
npm run security-check
```

This will:
- Check for sensitive files that might be accidentally committed
- Verify your .gitignore configuration
- Check for missing or weak environment variables
- Provide security recommendations

## Email Configuration

The application uses Brevo (formerly Sendinblue) for sending emails. To set up email functionality:

1. Create a free account at [Brevo](https://www.brevo.com/)
2. Generate an API key from your Brevo dashboard
3. Add the API key to your `.env` file as `BREVO_API_KEY`

### For Production Deployment

When deploying to production, you need to authorize your server's IP address in Brevo:

1. Go to [Brevo Security Settings](https://app.brevo.com/security/authorised_ips)
2. Add your server's IP address to the authorized list
3. If using a platform like Render, add all their [outbound IP addresses](https://render.com/docs/static-outbound-ip-addresses)

### Testing Email Functionality

You can test the email functionality by running:

```
node test-brevo-email.js
```

## Project Structure

```
rapira/
├── models/          # Database models
├── routes/          # Express routes
├── views/           # EJS templates
├── public/          # Static assets
│   ├── css/         # Stylesheets
│   ├── js/          # Client-side JavaScript
│   ├── images/      # Images
│   └── uploads/     # User uploads
├── middleware/      # Custom middleware
├── utils/           # Utility functions
├── scripts/         # Helper scripts
├── app.js           # Main application file
└── package.json     # Project dependencies
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/logout` - Logout user

### Users
- `GET /users/profile` - Get user profile
- `POST /users/update-profile` - Update user profile
- `POST /users/change-password` - Change user password

### Artists
- `GET /artists` - Get all artists
- `GET /artists/:id` - Get artist by ID
- `GET /artists/dashboard` - Artist dashboard
- `POST /artists/upload-content` - Upload content
- `POST /artists/update-profile` - Update artist profile

### Concerts
- `GET /concerts` - Get all concerts
- `GET /concerts/:id` - Get concert by ID
- `POST /concerts/create` - Create a new concert
- `POST /concerts/:id/edit` - Edit concert
- `POST /concerts/:id/cancel` - Cancel concert

### Tickets
- `POST /tickets/book-free` - Book free ticket
- `POST /tickets/create-order` - Create order for paid ticket
- `POST /tickets/verify-payment` - Verify payment
- `GET /tickets/:id` - Get ticket by ID

### Admin
- `GET /admin` - Admin dashboard
- `GET /admin/users` - Manage users
- `GET /admin/artists` - Manage artists
- `GET /admin/concerts` - Manage concerts
- `GET /admin/concerts/pending` - Pending concerts
- `POST /admin/concerts/:id/approve` - Approve concert
- `POST /admin/concerts/:id/reject` - Reject concert

## License

This project is licensed under the ISC License.

## Acknowledgements

- [Bootstrap](https://getbootstrap.com/)
- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Razorpay](https://razorpay.com/)
- [Brevo](https://www.brevo.com/)
