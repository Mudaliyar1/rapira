/**
 * Security Check Script
 * 
 * This script checks for potential security issues:
 * 1. Sensitive files that might be accidentally committed
 * 2. Environment variables that might be missing
 * 3. Basic security configuration issues
 * 
 * Usage: node scripts/check-security.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

// ANSI color codes for output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

console.log(`${colors.bold}${colors.blue}=== Rapira Security Check ===${colors.reset}\n`);

// Check if .env files are properly gitignored
function checkGitIgnore() {
  console.log(`${colors.bold}Checking .gitignore configuration...${colors.reset}`);
  
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    console.log(`${colors.red}✖ .gitignore file not found!${colors.reset}`);
    return;
  }
  
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  
  const requiredEntries = [
    '.env',
    '.env.*',
    '*.pem',
    '*.key'
  ];
  
  let allFound = true;
  for (const entry of requiredEntries) {
    if (!gitignoreContent.includes(entry)) {
      console.log(`${colors.red}✖ Missing entry in .gitignore: ${entry}${colors.reset}`);
      allFound = false;
    }
  }
  
  if (allFound) {
    console.log(`${colors.green}✓ .gitignore is properly configured${colors.reset}`);
  }
}

// Check for sensitive files that might be committed
function checkSensitiveFiles() {
  console.log(`\n${colors.bold}Checking for sensitive files...${colors.reset}`);
  
  const sensitivePatterns = [
    '.env',
    '.env.*',
    '*.pem',
    '*.key',
    'credentials.json',
    'config.json'
  ];
  
  // Get list of files tracked by git
  let trackedFiles = [];
  try {
    const gitOutput = execSync('git ls-files', { encoding: 'utf8' });
    trackedFiles = gitOutput.split('\n').filter(Boolean);
  } catch (error) {
    console.log(`${colors.yellow}⚠ Could not check git tracked files: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Make sure git is installed and you're in a git repository${colors.reset}`);
    return;
  }
  
  let sensitiveFilesFound = false;
  
  for (const pattern of sensitivePatterns) {
    const regex = new RegExp(pattern.replace('.', '\\.').replace('*', '.*'));
    
    for (const file of trackedFiles) {
      if (regex.test(file)) {
        console.log(`${colors.red}✖ Sensitive file tracked by git: ${file}${colors.reset}`);
        sensitiveFilesFound = true;
      }
    }
  }
  
  if (!sensitiveFilesFound) {
    console.log(`${colors.green}✓ No sensitive files found in git tracking${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Please remove sensitive files from git tracking:${colors.reset}`);
    console.log(`${colors.yellow}   git rm --cached <filename>${colors.reset}`);
    console.log(`${colors.yellow}   Then commit the change: git commit -m "Remove sensitive files"${colors.reset}`);
  }
}

// Check environment variables
function checkEnvironmentVariables() {
  console.log(`\n${colors.bold}Checking environment variables...${colors.reset}`);
  
  const requiredVars = [
    'PORT',
    'MONGODB_URI',
    'SESSION_SECRET',
    'BASE_URL'
  ];
  
  const recommendedVars = [
    'BREVO_API_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD'
  ];
  
  let missingRequired = false;
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.log(`${colors.red}✖ Missing required environment variable: ${varName}${colors.reset}`);
      missingRequired = true;
    }
  }
  
  if (!missingRequired) {
    console.log(`${colors.green}✓ All required environment variables are set${colors.reset}`);
  }
  
  let missingRecommended = false;
  for (const varName of recommendedVars) {
    if (!process.env[varName]) {
      console.log(`${colors.yellow}⚠ Missing recommended environment variable: ${varName}${colors.reset}`);
      missingRecommended = true;
    }
  }
  
  if (!missingRecommended) {
    console.log(`${colors.green}✓ All recommended environment variables are set${colors.reset}`);
  }
  
  // Check for weak secrets
  if (process.env.SESSION_SECRET && 
      (process.env.SESSION_SECRET === 'your-secret-key-here' || 
       process.env.SESSION_SECRET.length < 16)) {
    console.log(`${colors.red}✖ Weak SESSION_SECRET detected. Use a strong, random string${colors.reset}`);
  }
}

// Check security configuration
function checkSecurityConfig() {
  console.log(`\n${colors.bold}Checking security configuration...${colors.reset}`);
  
  // Check if in production mode
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Environment: ${isProduction ? colors.green + 'Production' : colors.yellow + 'Development'}${colors.reset}`);
  
  // Check BASE_URL protocol
  if (process.env.BASE_URL) {
    if (isProduction && !process.env.BASE_URL.startsWith('https://')) {
      console.log(`${colors.red}✖ Production BASE_URL should use HTTPS protocol${colors.reset}`);
    } else if (process.env.BASE_URL.startsWith('https://')) {
      console.log(`${colors.green}✓ BASE_URL uses HTTPS protocol${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ BASE_URL uses HTTP protocol (OK for development only)${colors.reset}`);
    }
  }
  
  // Check MongoDB connection string
  if (process.env.MONGODB_URI) {
    if (process.env.MONGODB_URI.includes('localhost') || process.env.MONGODB_URI.includes('127.0.0.1')) {
      console.log(`${colors.yellow}⚠ Using local MongoDB (OK for development only)${colors.reset}`);
    } else if (process.env.MONGODB_URI.includes('mongodb+srv://')) {
      console.log(`${colors.green}✓ Using MongoDB Atlas with secure connection${colors.reset}`);
    }
    
    // Check for default MongoDB credentials
    if (process.env.MONGODB_URI.includes('username:password@')) {
      console.log(`${colors.red}✖ Default MongoDB credentials detected in connection string${colors.reset}`);
    }
  }
}

// Run all checks
checkGitIgnore();
checkSensitiveFiles();
checkEnvironmentVariables();
checkSecurityConfig();

console.log(`\n${colors.bold}${colors.blue}=== Security Check Complete ===${colors.reset}`);
console.log(`${colors.cyan}For more information, see SECURITY.md${colors.reset}`);
