#!/usr/bin/env node

/**
 * Environment validation script for Google Calendar integration
 * Run this to check if your environment is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Google Calendar Integration Setup...\n');

const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

const envFilePath = path.join(process.cwd(), '.env.local');
let hasErrors = false;

// Check if .env.local exists
if (!fs.existsSync(envFilePath)) {
  console.error('❌ .env.local file not found!');
  console.log('   Create it by copying .env.local.example:');
  console.log('   cp .env.local.example .env.local\n');
  hasErrors = true;
} else {
  console.log('✅ .env.local file found\n');
  
  // Read and parse .env.local
  const envContent = fs.readFileSync(envFilePath, 'utf-8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });
  
  // Check each required variable
  console.log('Checking required environment variables:\n');
  
  requiredEnvVars.forEach(varName => {
    const value = envVars[varName];
    
    if (!value) {
      console.error(`❌ ${varName} is not set`);
      hasErrors = true;
    } else if (value.includes('YOUR_') || value.includes('your_')) {
      console.error(`❌ ${varName} is still set to placeholder value: ${value}`);
      console.log(`   Replace with actual value from Google Cloud Console\n`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName} is set`);
      
      // Additional validation
      if (varName === 'GOOGLE_CLIENT_ID' && !value.endsWith('.apps.googleusercontent.com')) {
        console.warn(`⚠️  ${varName} doesn't look like a valid Google Client ID`);
        console.log(`   It should end with .apps.googleusercontent.com\n`);
      }
      
      if (varName === 'GOOGLE_REDIRECT_URI') {
        if (!value.includes('/api/auth/callback/google')) {
          console.warn(`⚠️  ${varName} might be incorrect`);
          console.log(`   It should end with /api/auth/callback/google\n`);
        } else {
          console.log(`   Redirect URI: ${value}`);
        }
      }
    }
  });
}

console.log('\n📋 Setup Checklist:\n');

const checks = [
  '[ ] Created Google Cloud Project',
  '[ ] Enabled Google Calendar API',
  '[ ] Created OAuth 2.0 Client ID',
  '[ ] Added redirect URI to Google Cloud Console',
  '[ ] Copied credentials to .env.local',
  '[ ] Restarted development server'
];

checks.forEach(check => console.log(check));

console.log('\n');

if (hasErrors) {
  console.error('❌ Setup incomplete. Please fix the errors above.');
  console.log('\n📚 See GOOGLE_CALENDAR_SETUP.md for detailed instructions.\n');
  process.exit(1);
} else {
  console.log('✅ Environment configuration looks good!');
  console.log('\n🎉 You should now be able to connect Google Calendar.');
  console.log('   Go to /profile and click "Connect to Google Calendar"\n');
  process.exit(0);
}
