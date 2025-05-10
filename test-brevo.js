require('dotenv').config();
const axios = require('axios');

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function testBrevoEmail() {
  try {
    console.log('Testing Brevo email sending...');
    console.log('API Key:', BREVO_API_KEY ? `${BREVO_API_KEY.substring(0, 10)}...` : 'Not found');
    
    // Create a direct email payload
    const payload = {
      sender: {
        name: 'Rapira Test',
        email: 'test@rapira.com'
      },
      to: [{
        email: 'vijaymudaliyar224@gmail.com',
        name: 'Test User'
      }],
      subject: 'Brevo Test Email',
      htmlContent: `
        <html>
          <body>
            <h1>This is a test email from Brevo</h1>
            <p>If you're seeing this, the Brevo API is working correctly.</p>
            <p>Time: ${new Date().toISOString()}</p>
          </body>
        </html>
      `,
      textContent: 'This is a test email from Brevo. If you\'re seeing this, the Brevo API is working correctly.'
    };
    
    console.log('Sending test email...');
    
    // Make the API request
    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });
    
    console.log('Email sent successfully!');
    console.log('Response:', response.status, response.statusText);
    console.log('Response data:', response.data);
    
  } catch (error) {
    console.error('Error sending test email:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testBrevoEmail();
