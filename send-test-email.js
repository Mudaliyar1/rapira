/**
 * Test script to send a test account deletion notification email
 */

require('dotenv').config(); // Load environment variables
console.log('Current BASE_URL from environment:', process.env.BASE_URL);
const { sendAccountDeletionNotification } = require('./utils/brevoEmailService');
const crypto = require('crypto');

async function sendTestEmail() {
  console.log('📧 Sending test account deletion notification email...\n');

  // Create a mock user object for testing
  const testUser = {
    name: 'Test User',
    email: 'valrein09@gmail.com',
    role: 'user'
  };

  // Generate a mock recovery token for testing
  const testToken = crypto.randomBytes(32).toString('hex');

  try {
    console.log('Sending email to:', testUser.email);
    console.log('User details:', testUser);
    
    const result = await sendAccountDeletionNotification(testUser, testToken);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Response:', result.data ? JSON.stringify(result.data, null, 2) : 'No detailed response');
    } else {
      console.log('❌ Failed to send email');
      console.log('Error:', result.error);
      
      if (result.fallback) {
        console.log('📧 Email content was logged to console (development mode)');
      }
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
sendTestEmail()
  .then(() => {
    console.log('\n🏁 Test email process completed.');
  })
  .catch(error => {
    console.error('❌ Error in test email process:', error);
  });