# Email System Setup Guide

This document explains how to set up and troubleshoot the email system in the Rapira platform.

## Overview

The Rapira platform uses Brevo (formerly Sendinblue) as the primary email service provider. The system includes:

1. Automatic IP registration for development environments
2. Gmail fallback for development (optional)
3. Console logging of emails in development mode
4. Comprehensive error handling

## Configuration

### 1. Brevo API Setup

1. Create an account at [Brevo](https://www.brevo.com/)
2. Get your API key from the Brevo dashboard
3. Add it to your `.env` file:
   ```
   BREVO_API_KEY=your-brevo-api-key-here
   ```

### 2. Gmail Fallback Setup (Optional, for Development)

If you want to use Gmail as a fallback in development:

1. Create or use an existing Gmail account
2. Generate an App Password (not your regular password):
   - Go to your Google Account → Security → 2-Step Verification → App passwords
   - Create a new app password for "Mail" and "Other (Custom name)"
3. Add to your `.env` file:
   ```
   GMAIL_USER=your-gmail@gmail.com
   GMAIL_PASS=your-app-password
   ```

## IP Authorization

Brevo requires IP authorization for security. Due to Brevo's security model, you need to manually authorize at least your first IP address:

1. Run the IP check tool to see your current IP addresses:
   ```
   node check-ip.js
   ```

2. Follow the instructions provided by the tool to manually authorize your IP:
   - Go to [Brevo IP Authorization](https://app.brevo.com/security/authorised_ips)
   - Add your IPv4 and IPv6 addresses (if available)
   - Use a descriptive label like "Development Machine" or "Production Server"

3. Run the IP check tool again to verify your IP is authorized:
   ```
   node check-ip.js
   ```

> **Important Note**: Brevo requires at least one IP to be manually authorized before you can use their API. This is a security feature that cannot be bypassed programmatically.

### For Production Deployment

If using Render:
1. Add all Render outbound IPs to Brevo's authorized list
2. See [Render Static Outbound IP Addresses](https://render.com/docs/static-outbound-ip-addresses)

## Troubleshooting

### Check IP Authorization Status

Run the IP check script:
```
node check-ip.js
```

This will:
- Show your current IPv4 and IPv6 addresses
- Check if these IPs are authorized in your Brevo account
- List all currently authorized IPs
- Provide clear instructions for manual authorization if needed

### Handling Dynamic IP Addresses

If your ISP frequently changes your IP address:

1. **For Development**:
   - Run `node check-ip.js` whenever you start working
   - Manually authorize your new IP if needed
   - In development mode, emails will still be logged to console even if sending fails

2. **For Production**:
   - Use a hosting provider with static IPs (recommended)
   - If using a provider with dynamic IPs, consider setting up a proxy server with a static IP
   - For Render, authorize all their outbound IPs as listed in the documentation

### Test Email Functionality

Run the email test script:
```
node test-email.js
```

This will test:
1. Basic email sending
2. Welcome email template
3. Ticket confirmation email
4. Password reset email

### Common Issues

1. **IP Authorization Errors**
   - Run `node check-ip.js` to register your IP
   - Check if your IP changes frequently (common with home internet)
   - Consider using a static IP for production

2. **Emails Not Sending in Production**
   - Verify Brevo API key is correct
   - Check server logs for specific errors
   - Ensure all production server IPs are authorized

3. **Gmail Fallback Not Working**
   - Verify Gmail credentials are correct
   - Make sure you're using an App Password, not your regular password
   - Check if your Gmail account has security restrictions

## Email Templates

The system includes several email templates:

1. Welcome Email - Sent when a user creates an account
2. Password Reset - Sent when a user requests a password reset
3. Ticket Confirmation - Sent after ticket purchase
4. Test Email - Used for testing the email system

## Development vs. Production

- **Development Mode**: Emails are logged to console if sending fails
- **Production Mode**: Real emails are sent, failures are logged but not exposed to users
