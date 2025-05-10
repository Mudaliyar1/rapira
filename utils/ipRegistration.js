/**
 * IP Registration Utility for Brevo
 *
 * This utility helps manage IP authorization with Brevo.
 *
 * NOTE: Due to Brevo's security model, automatic IP registration requires manual
 * authorization of at least one IP address first. This is a security feature of Brevo
 * that cannot be bypassed programmatically.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.sendinblue.com/v3';

// Note: Brevo's API for IP management is not publicly documented
// The endpoints below may change in the future
const IP_LIST_ENDPOINT = `${BREVO_API_URL}/account/security/ips`;
const IP_ADD_ENDPOINT = `${BREVO_API_URL}/account/security/ips`;

// File to store IP information
const IP_CACHE_FILE = path.join(__dirname, '../data/ip_cache.json');

// Ensure the data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  try {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
  } catch (err) {
    console.error('Could not create data directory:', err.message);
  }
}

/**
 * Get the current public IP address
 * @returns {Promise<{ipv4: string, ipv6: string}>} The current IP addresses
 */
async function getCurrentIP() {
  const result = { ipv4: null, ipv6: null };

  // Try to get IPv4 address
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    result.ipv4 = response.data.ip;
  } catch (error) {
    console.error('Error detecting IPv4 address:', error.message);
    // Try an alternative service
    try {
      const response = await axios.get('https://api.my-ip.io/ip.json');
      result.ipv4 = response.data.ip;
    } catch (error) {
      console.error('Error detecting IPv4 address from alternative service:', error.message);
    }
  }

  // Try to get IPv6 address if available
  try {
    const response = await axios.get('https://api64.ipify.org?format=json');
    result.ipv6 = response.data.ip;
  } catch (error) {
    // IPv6 might not be available, so just log it at debug level
    console.log('IPv6 address not available or error detecting it');
  }

  // Cache the IP addresses
  try {
    const ipData = {
      ipv4: result.ipv4,
      ipv6: result.ipv6,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(IP_CACHE_FILE, JSON.stringify(ipData, null, 2));
  } catch (error) {
    console.error('Error caching IP addresses:', error.message);
  }

  return result;
}

/**
 * Get the list of authorized IPs from Brevo
 * @returns {Promise<Array>} List of authorized IPs
 */
async function getAuthorizedIPs() {
  try {
    // Note: This endpoint may not be publicly available in Brevo's API
    // If it fails, we'll handle it gracefully
    const response = await axios.get(IP_LIST_ENDPOINT, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    return response.data.ips || [];
  } catch (error) {
    // If we get a 401 error, it's likely because our IP is not authorized
    if (error.response && error.response.status === 401) {
      console.error('IP authorization error when trying to get authorized IPs list');
    }
    // If we get a 404 error, it means the endpoint doesn't exist or has changed
    else if (error.response && error.response.status === 404) {
      console.error('The IP management API endpoint appears to have changed or is not publicly accessible');
    }
    else {
      console.error('Error getting authorized IPs from Brevo:', error.message);
    }
    return [];
  }
}

/**
 * Register a new IP address with Brevo
 * @param {string} ip - The IP address to register
 * @returns {Promise<boolean>} Whether the registration was successful
 */
async function registerIP(ip) {
  try {
    // Note: This endpoint may not be publicly available in Brevo's API
    // If it fails, we'll handle it gracefully
    await axios.post(IP_ADD_ENDPOINT, {
      ip: ip,
      label: `Auto-registered IP (${new Date().toISOString().split('T')[0]})`
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Successfully registered IP address ${ip} with Brevo`);
    return true;
  } catch (error) {
    // If we get a 401 error, it's likely because our IP is not authorized to make this call
    if (error.response && error.response.status === 401) {
      console.error('IP authorization error: Cannot register a new IP without having at least one IP already authorized');
      console.error('Please manually authorize your first IP at: https://app.brevo.com/security/authorised_ips');
    }
    // If we get a 404 error, it means the endpoint doesn't exist or has changed
    else if (error.response && error.response.status === 404) {
      console.error('The IP management API endpoint appears to have changed or is not publicly accessible');
      console.error('Please manually authorize your IP at: https://app.brevo.com/security/authorised_ips');
    }
    else {
      console.error('Error registering IP with Brevo:', error.message);
      if (error.response && error.response.data) {
        console.error('Brevo API response:', JSON.stringify(error.response.data, null, 2));
      }
    }
    return false;
  }
}

/**
 * Get cached IP information
 * @returns {Object|null} Cached IP information or null if not available
 */
function getCachedIPInfo() {
  try {
    if (fs.existsSync(IP_CACHE_FILE)) {
      const data = fs.readFileSync(IP_CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading cached IP information:', error.message);
  }
  return null;
}

/**
 * Check if the current IP is authorized and register it if not
 * @returns {Promise<Object>} Result of the IP check and registration
 */
async function checkAndRegisterIP() {
  if (!BREVO_API_KEY) {
    return {
      success: false,
      message: 'BREVO_API_KEY is not defined in environment variables',
      authorized: false,
      ipv4: null,
      ipv6: null
    };
  }

  try {
    // Get current IP addresses
    const ipAddresses = await getCurrentIP();
    if (!ipAddresses.ipv4 && !ipAddresses.ipv6) {
      return {
        success: false,
        message: 'Could not detect any IP addresses',
        authorized: false,
        ipv4: null,
        ipv6: null
      };
    }

    // Try to get authorized IPs
    const authorizedIPs = await getAuthorizedIPs();

    // If we got a list of authorized IPs, check if our IPs are in it
    let ipv4Authorized = false;
    let ipv6Authorized = false;

    if (authorizedIPs.length > 0) {
      if (ipAddresses.ipv4) {
        ipv4Authorized = authorizedIPs.some(ip => ip.ip === ipAddresses.ipv4);
      }

      if (ipAddresses.ipv6) {
        ipv6Authorized = authorizedIPs.some(ip => ip.ip === ipAddresses.ipv6);
      }

      // If either IP is authorized, we're good
      if (ipv4Authorized || ipv6Authorized) {
        return {
          success: true,
          message: `At least one IP address is already authorized`,
          authorized: true,
          ipv4: ipAddresses.ipv4,
          ipv6: ipAddresses.ipv6,
          ipv4Authorized,
          ipv6Authorized
        };
      }
    }

    // If we get here, we need to try registering our IPs
    let ipv4Registered = false;
    let ipv6Registered = false;

    if (ipAddresses.ipv4 && !ipv4Authorized) {
      ipv4Registered = await registerIP(ipAddresses.ipv4);
    }

    if (ipAddresses.ipv6 && !ipv6Authorized) {
      ipv6Registered = await registerIP(ipAddresses.ipv6);
    }

    return {
      success: ipv4Registered || ipv6Registered,
      message: (ipv4Registered || ipv6Registered)
        ? `Successfully registered at least one IP address with Brevo`
        : `Failed to register IP addresses with Brevo. Please authorize manually.`,
      authorized: ipv4Authorized || ipv6Authorized || ipv4Registered || ipv6Registered,
      ipv4: ipAddresses.ipv4,
      ipv6: ipAddresses.ipv6,
      ipv4Authorized,
      ipv6Authorized,
      ipv4Registered,
      ipv6Registered
    };
  } catch (error) {
    console.error('Error in IP check and registration:', error.message);
    return {
      success: false,
      message: `Error in IP check and registration: ${error.message}`,
      authorized: false,
      ipv4: null,
      ipv6: null
    };
  }
}

module.exports = {
  getCurrentIP,
  getAuthorizedIPs,
  registerIP,
  checkAndRegisterIP,
  getCachedIPInfo
};
