require('dotenv').config();
const { sendEmail, sendWelcomeEmail, sendTicketEmail, sendPasswordResetEmail } = require('./utils/brevoEmailService');

async function testBrevoEmailService() {
  try {
    console.log('Testing Brevo email service...');
    
    // Test basic email
    const basicResult = await sendEmail({
      to: 'vijaymudaliyar224@gmail.com',
      toName: 'Test User',
      subject: 'Test Email from Rapira',
      htmlContent: '<h1>This is a test email</h1><p>If you are seeing this, the Brevo email service is working correctly.</p>',
      textContent: 'This is a test email. If you are seeing this, the Brevo email service is working correctly.'
    });
    
    console.log('Basic email result:', basicResult);
    
    // Test welcome email
    const welcomeResult = await sendWelcomeEmail({
      email: 'vijaymudaliyar224@gmail.com',
      name: 'Test User',
      role: 'user'
    });
    
    console.log('Welcome email result:', welcomeResult);
    
    // Test ticket email
    const ticketResult = await sendTicketEmail(
      {
        email: 'vijaymudaliyar224@gmail.com',
        name: 'Test User'
      },
      {
        _id: '123456789',
        ticketNumber: 'TKT123456',
        quantity: 2,
        totalAmount: 1000,
        attendees: [
          { name: 'Test User 1', age: 25 },
          { name: 'Test User 2', age: 30 }
        ]
      },
      {
        title: 'Test Concert',
        date: new Date(),
        time: '7:00 PM',
        venue: 'Test Venue',
        city: 'Mumbai'
      }
    );
    
    console.log('Ticket email result:', ticketResult);
    
    // Test password reset email
    const resetResult = await sendPasswordResetEmail(
      {
        email: 'vijaymudaliyar224@gmail.com',
        name: 'Test User'
      },
      '123456'
    );
    
    console.log('Password reset email result:', resetResult);
    
  } catch (error) {
    console.error('Error testing email service:', error);
  }
}

// Run the test
testBrevoEmailService();
