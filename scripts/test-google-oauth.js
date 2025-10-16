// Test script to verify Google OAuth configuration
// Run with: node scripts/test-google-oauth.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Simple .env parser
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

loadEnv();

console.log('\n🔍 Testing Google OAuth Configuration\n');
console.log('='.repeat(50));

// Check environment variables
console.log('\n1. Environment Variables:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || '❌ Missing');

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    console.error('\n❌ Missing required environment variables!');
    process.exit(1);
}

// Test OAuth client creation
console.log('\n2. OAuth Client Creation:');
try {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    console.log('✅ OAuth2 client created successfully');

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.events'],
        prompt: 'consent',
    });

    console.log('\n3. Generated Auth URL:');
    console.log(authUrl);
    console.log('\n✅ Auth URL generated successfully');

    console.log('\n4. Configuration Summary:');
    console.log('- Client ID format:', process.env.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com') ? '✅ Valid' : '⚠️  Unusual format');
    console.log('- Redirect URI:', process.env.GOOGLE_REDIRECT_URI);
    console.log('- Scope:', 'https://www.googleapis.com/auth/calendar.events');

    console.log('\n' + '='.repeat(50));
    console.log('✅ All checks passed!');
    console.log('\nNext steps:');
    console.log('1. Make sure the redirect URI in Google Cloud Console matches exactly');
    console.log('2. Ensure Google Calendar API is enabled in your project');
    console.log('3. Check that your email is added as a test user (if in Testing mode)');
    console.log('4. Try the OAuth flow again');
    console.log('='.repeat(50) + '\n');

} catch (error) {
    console.error('\n❌ Error creating OAuth client:', error.message);
    process.exit(1);
}
