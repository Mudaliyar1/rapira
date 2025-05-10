/**
 * Script to switch between development and production environments
 * 
 * Usage:
 * - To switch to development: node scripts/switch-env.js dev
 * - To switch to production: node scripts/switch-env.js prod
 */
const fs = require('fs');
const path = require('path');

// Get the environment argument
const args = process.argv.slice(2);
const env = args[0]?.toLowerCase();

if (!env || (env !== 'dev' && env !== 'prod')) {
  console.error('Please specify environment: dev or prod');
  console.error('Usage: node scripts/switch-env.js dev|prod');
  process.exit(1);
}

// File paths
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envDevPath = path.join(rootDir, '.env.development');
const envProdPath = path.join(rootDir, '.env.production');

// Function to copy file
const copyFile = (source, destination) => {
  try {
    // Read the source file
    const content = fs.readFileSync(source, 'utf8');
    
    // Write to the destination file
    fs.writeFileSync(destination, content, 'utf8');
    
    return true;
  } catch (error) {
    console.error(`Error copying file: ${error.message}`);
    return false;
  }
};

// Function to backup current .env file
const backupEnvFile = () => {
  try {
    if (fs.existsSync(envPath)) {
      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(rootDir, `.env.backup-${timestamp}`);
      
      // Copy current .env to backup
      copyFile(envPath, backupPath);
      console.log(`Current .env backed up to ${backupPath}`);
    }
    return true;
  } catch (error) {
    console.error(`Error backing up .env file: ${error.message}`);
    return false;
  }
};

// Main function to switch environment
const switchEnvironment = () => {
  // Backup current .env file
  backupEnvFile();
  
  if (env === 'dev') {
    // Check if .env.development exists, if not, create it from current .env
    if (!fs.existsSync(envDevPath) && fs.existsSync(envPath)) {
      copyFile(envPath, envDevPath);
      console.log('Created .env.development from current .env');
    }
    
    // If .env.development exists, copy it to .env
    if (fs.existsSync(envDevPath)) {
      copyFile(envDevPath, envPath);
      console.log('Switched to DEVELOPMENT environment');
      
      // Ensure NODE_ENV is set to development
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/NODE_ENV\s*=\s*production/g, '# NODE_ENV=production');
      fs.writeFileSync(envPath, envContent, 'utf8');
      
      console.log('Environment variables updated for development');
    } else {
      console.error('.env.development file not found');
      process.exit(1);
    }
  } else if (env === 'prod') {
    // Check if .env.production exists
    if (!fs.existsSync(envProdPath)) {
      console.error('.env.production file not found');
      process.exit(1);
    }
    
    // Copy .env.production to .env
    copyFile(envProdPath, envPath);
    console.log('Switched to PRODUCTION environment');
  }
  
  // Display current environment settings
  const currentEnv = fs.readFileSync(envPath, 'utf8');
  const nodeEnv = currentEnv.includes('NODE_ENV=production') ? 'production' : 'development';
  const baseUrl = currentEnv.match(/BASE_URL\s*=\s*([^\r\n]+)/)?.[1] || 'not set';
  
  console.log('\nCurrent Environment Settings:');
  console.log(`- NODE_ENV: ${nodeEnv}`);
  console.log(`- BASE_URL: ${baseUrl}`);
  console.log('\nRemember to restart your server for changes to take effect!');
};

// Execute the switch
switchEnvironment();
