# 🔧 Google Calendar Integration - Critical Fix Needed

## 🎯 Key Discovery

After analyzing the Google Calendar API documentation you provided, I've identified that your OAuth configuration is **correct**, but we need to understand why the token exchange is failing.

## ✅ What's Working

1. ✅ Environment variables are properly set
2. ✅ OAuth2 client is created successfully  
3. ✅ Auth URL is generated correctly
4. ✅ Client ID format is valid
5. ✅ Redirect URI is correctly formatted

## 🔍 What We Need to Check

### Critical Question: Can you share the exact error from the server terminal?

After you click "Connect to Google Calendar" and complete the OAuth flow, check your terminal where `npm run dev` is running. You should see log output like:

```
Attempting to exchange auth code for tokens...
Using redirect URI: http://localhost:9002/api/auth/callback/google
Client ID: 626373907683-dba13o7ria1fngkjec27ol33sdek26sn.apps.googleusercontent.com
User ID: [your-user-id]
```

**Then you should see either:**
- `Successfully received tokens from Google` ✅
- OR an error message with details ❌

## 🎯 Most Likely Issues

### Issue 1: Google Cloud Console Redirect URI Mismatch

**Check this in Google Cloud Console:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", you MUST have EXACTLY:
   ```
   http://localhost:9002/api/auth/callback/google
   ```

**Common mistakes:**
- ❌ `http://localhost:9002/api/oauth/google/callback` (wrong path)
- ❌ `http://localhost:3000/api/auth/callback/google` (wrong port)
- ❌ `https://localhost:9002/api/auth/callback/google` (should be http, not https)
- ❌ Extra trailing slash

### Issue 2: Google Calendar API Not Enabled

**Check in Google Cloud Console:**
1. Go to https://console.cloud.google.com/apis/library
2. Search for "Google Calendar API"
3. It should say "API enabled" with a green checkmark
4. If it says "Enable", click it

### Issue 3: OAuth Consent Screen Not Configured

**Check in Google Cloud Console:**
1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Make sure:
   - App name is set
   - User support email is set
   - Your email is added as a test user (if publishing status is "Testing")

### Issue 4: Wrong Project in Google Cloud Console

**Verify:**
- The OAuth credentials you created are in the same Google Cloud project
- The project ID matches your Firebase project: `smarttasker-gk`

## 📋 Step-by-Step Verification

### Step 1: Verify Google Cloud Console Setup

Run through this checklist:

```
□ Go to: https://console.cloud.google.com/apis/credentials
□ Select project: smarttasker-gk (or your project)
□ Find OAuth 2.0 Client ID: 626373907683-dba13o7ria1fngkjec27ol33sdek26sn
□ Click on it to edit
□ Under "Authorized redirect URIs", verify EXACT match:
  http://localhost:9002/api/auth/callback/google
□ Click Save if you made any changes
□ Wait 5 minutes for changes to propagate
```

### Step 2: Enable Calendar API

```
□ Go to: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
□ Click "Enable" if not already enabled
□ Wait 1-2 minutes
```

### Step 3: Configure OAuth Consent Screen

```
□ Go to: https://console.cloud.google.com/apis/credentials/consent
□ If "Publishing status" is "Testing":
  □ Click "Test users" → "Add users"
  □ Add your Gmail address: heyitsgautham@gmail.com
  □ Click "Save"
```

### Step 4: Test Again

1. **Clear your browser cookies** for localhost:9002
2. Go to: `http://localhost:9002/profile` (use localhost, NOT 0.0.0.0)
3. Click "Connect to Google Calendar"
4. **Watch the terminal** where `npm run dev` is running
5. Complete the OAuth flow in your browser
6. **Copy the error logs** from the terminal and share them

## 🔍 Debug Command

Run this command and share the output:

```bash
cd /Users/gauthamkrishna/Projects/smart-tasker
node scripts/test-google-oauth.js
```

This will verify your OAuth configuration is correct.

## 📸 What to Check in Browser Network Tab

1. Open Chrome DevTools (F12)
2. Go to "Network" tab
3. Try connecting to Google Calendar
4. Look for the request to `/api/auth/callback/google`
5. Check:
   - Does it have a `code` parameter?
   - Does it have a `state` parameter?
   - Are there any error parameters?

## 🚨 Common Error Messages Decoded

| Error in Terminal | Meaning | Solution |
|-------------------|---------|----------|
| `redirect_uri_mismatch` | Redirect URI doesn't match Google Console | Update Google Console to match exactly: `http://localhost:9002/api/auth/callback/google` |
| `invalid_grant` | Auth code expired or already used | Try the OAuth flow again from scratch |
| `invalid_client` | Client ID or Secret is wrong | Double-check credentials in `.env` file |
| `access_denied` | User denied permissions OR not a test user | Add your email as test user in OAuth consent screen |
| `unauthorized_client` | Calendar API not enabled | Enable Google Calendar API in Google Cloud Console |

## 🎯 Action Items

1. **Verify redirect URI** in Google Cloud Console matches EXACTLY
2. **Enable Google Calendar API** if not already enabled
3. **Add your email as test user** if consent screen is in Testing mode
4. **Clear browser cookies** before testing again
5. **Use localhost** (not 0.0.0.0) when accessing the app
6. **Share the terminal error logs** so I can see the exact error from Google

## 💡 Why the Documentation Uses a Different Approach

The HTML file you showed uses Google's **client-side** OAuth (implicit flow) which:
- Handles tokens directly in the browser
- Uses `google.accounts.oauth2.initTokenClient()`
- Requires an API key

Your Next.js app uses **server-side** OAuth (authorization code flow) which:
- Is more secure
- Tokens are handled on the server
- Doesn't need an API key for googleapis library
- Is the recommended approach for server-rendered apps

Both approaches are valid, but your current approach is better for a Next.js app with server actions! 🎉

---

**Next Step: Please share the terminal logs after trying to connect to Google Calendar!**
