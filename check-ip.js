#!/usr/bin/env node

/**
 * IP Check and Registration Tool for Brevo
 *
 * This script helps you check your current IP addresses and their authorization status with Brevo.
 * It also provides instructions for manually authorizing your IP if automatic registration fails.
 */
require('dotenv').config();
const { getCurrentIP, getAuthorizedIPs, registerIP, checkAndRegisterIP, getCachedIPInfo } = require('./utils/ipRegistration');

// ANSI color codes for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

async function checkIP() {
  try {
    console.log(`${colors.bright}${colors.cyan}=== Brevo IP Authorization Check ===${colors.reset}\n`);
    console.log(`${colors.bright}Checking your IP addresses...${colors.reset}`);

    // Get current IP addresses
    const ipAddresses = await getCurrentIP();

    console.log(`\n${colors.bright}Your IP Addresses:${colors.reset}`);
    console.log(`IPv4: ${ipAddresses.ipv4 ? colors.green + ipAddresses.ipv4 + colors.reset : colors.red + 'Not detected' + colors.reset}`);
    console.log(`IPv6: ${ipAddresses.ipv6 ? colors.green + ipAddresses.ipv6 + colors.reset : colors.yellow + 'Not detected or not available' + colors.reset}`);

    console.log(`\n${colors.bright}Checking authorization status with Brevo...${colors.reset}`);

    // Get authorized IPs
    const authorizedIPs = await getAuthorizedIPs();

    if (authorizedIPs.length === 0) {
      console.log(`${colors.yellow}Could not retrieve authorized IPs list. This could be because:${colors.reset}`);
      console.log(`${colors.yellow}1. Your current IP is not authorized${colors.reset}`);
      console.log(`${colors.yellow}2. The IP management API is not publicly accessible${colors.reset}`);
      console.log(`${colors.yellow}3. The API endpoints have changed${colors.reset}`);
      console.log(`\n${colors.bright}What to do:${colors.reset}`);
      console.log(`1. Manually authorize your IP at: ${colors.bright}https://app.brevo.com/security/authorised_ips${colors.reset}`);
      console.log(`2. Use the following IP addresses:`);
      console.log(`   - IPv4: ${colors.bright}${ipAddresses.ipv4 || 'Not detected'}${colors.reset}`);
      if (ipAddresses.ipv6) {
        console.log(`   - IPv6: ${colors.bright}${ipAddresses.ipv6}${colors.reset}`);
      }
    } else {
      console.log(`Number of authorized IPs: ${colors.green}${authorizedIPs.length}${colors.reset}`);

      // Check if current IPs are authorized
      let ipv4Authorized = false;
      let ipv6Authorized = false;

      if (ipAddresses.ipv4) {
        ipv4Authorized = authorizedIPs.some(ip => ip.ip === ipAddresses.ipv4);
      }

      if (ipAddresses.ipv6) {
        ipv6Authorized = authorizedIPs.some(ip => ip.ip === ipAddresses.ipv6);
      }

      console.log(`\n${colors.bright}Authorization Status:${colors.reset}`);
      console.log(`IPv4 (${ipAddresses.ipv4}): ${ipv4Authorized ? colors.green + 'Authorized' + colors.reset : colors.red + 'Not Authorized' + colors.reset}`);
      if (ipAddresses.ipv6) {
        console.log(`IPv6 (${ipAddresses.ipv6}): ${ipv6Authorized ? colors.green + 'Authorized' + colors.reset : colors.red + 'Not Authorized' + colors.reset}`);
      }

      // Try to register IPs that aren't authorized
      if (!ipv4Authorized && ipAddresses.ipv4) {
        console.log(`\n${colors.bright}Attempting to register IPv4 address...${colors.reset}`);
        const result = await registerIP(ipAddresses.ipv4);
        console.log(`Registration result: ${result ? colors.green + 'Success' + colors.reset : colors.red + 'Failed' + colors.reset}`);
      }

      if (!ipv6Authorized && ipAddresses.ipv6) {
        console.log(`\n${colors.bright}Attempting to register IPv6 address...${colors.reset}`);
        const result = await registerIP(ipAddresses.ipv6);
        console.log(`Registration result: ${result ? colors.green + 'Success' + colors.reset : colors.red + 'Failed' + colors.reset}`);
      }
    }

    // List all authorized IPs
    if (authorizedIPs.length > 0) {
      console.log(`\n${colors.bright}Currently Authorized IPs:${colors.reset}`);
      authorizedIPs.forEach(ipObj => {
        console.log(`- ${colors.green}${ipObj.ip}${colors.reset} (${ipObj.label || 'No label'})`);
      });
    }

    // Instructions for manual authorization
    console.log(`\n${colors.bright}${colors.cyan}=== Manual Authorization Instructions ===${colors.reset}`);
    console.log(`Since automatic IP registration is not available through the API, please follow these steps:`);
    console.log(`1. Log in to your Brevo account`);
    console.log(`2. Go to: ${colors.bright}https://app.brevo.com/security/authorised_ips${colors.reset}`);
    console.log(`3. Click "Add a new IP"`);
    console.log(`4. Enter your IPv4 address: ${colors.bright}${ipAddresses.ipv4 || 'Not detected'}${colors.reset}`);
    if (ipAddresses.ipv6) {
      console.log(`5. Repeat for your IPv6 address: ${colors.bright}${ipAddresses.ipv6}${colors.reset}`);
    }
    console.log(`\n${colors.bright}Important Notes:${colors.reset}`);
    console.log(`1. Brevo requires manual IP authorization through their web interface`);
    console.log(`2. The API for IP management is not publicly accessible`);
    console.log(`3. In development mode, emails will still be logged to console even if sending fails`);
    console.log(`4. For production, make sure to authorize all your server IPs`);
    console.log(`\nAfter adding your IP(s), restart your application to use the authorized IP.`);

  } catch (error) {
    console.error(`${colors.red}Error checking IP:${colors.reset}`, error.message);
  }
}

// Run the check
checkIP();
