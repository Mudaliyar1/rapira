require('dotenv').config();
const { sendEmail, sendWelcomeEmail, sendTicketEmail, sendPasswordResetEmail, sendTestEmail } = require('./utils/enhancedEmailService');

// Display environment variables (with sensitive info masked)
console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ?
  `${process.env.BREVO_API_KEY.substring(0, 5)}...${process.env.BREVO_API_KEY.substring(process.env.BREVO_API_KEY.length - 3)}` :
  'not set');

async function testEmailService() {
  try {
    console.log('Testing enhanced email service...');

    // Test the simple test email function first
    console.log('\n1. Testing sendTestEmail function:');
    const testResult = await sendTestEmail('vijaymudaliyar224@gmail.com', 'Test User');
    console.log('Test email result:', testResult);

    // Test basic email
    console.log('\n2. Testing basic sendEmail function:');
    const basicResult = await sendEmail({
      to: 'vijaymudaliyar224@gmail.com',
      name: 'Test User',
      subject: 'Test Email from Rapira',
      html: '<h1>This is a test email</h1><p>If you are seeing this, the email service is working correctly.</p>',
      text: 'This is a test email. If you are seeing this, the email service is working correctly.'
    });

    console.log('Basic email result:', basicResult);

    // Test welcome email
    console.log('\n3. Testing welcome email function:');
    const welcomeResult = await sendWelcomeEmail({
      email: 'vijaymudaliyar224@gmail.com',
      name: 'Test User'
    });

    console.log('Welcome email result:', welcomeResult);

    // Test ticket email
    console.log('\n4. Testing ticket email function:');
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
    console.log('\n5. Testing password reset email function:');
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
testEmailService();
