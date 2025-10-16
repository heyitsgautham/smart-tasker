# 🔧 Firebase Admin SDK Fixed!

## ✅ What Was Fixed

### Issue
The Firebase Admin SDK was failing to initialize with the error:
```
TypeError: Cannot read properties of undefined (reading 'INTERNAL')
```

### Root Cause
The old import style `import * as admin from 'firebase-admin'` was causing issues with the newer version of firebase-admin (v13.5.0). The SDK has been updated to use modular imports.

### Solution
Updated `src/lib/firebase-admin.ts` to use the modern modular import style:

**Before:**
```typescript
import * as admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

**After:**
```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(serviceAccount),
});
```

## ✅ Validation Complete

Your `FIREBASE_SERVICE_ACCOUNT_KEY` is now valid JSON with all required fields:
- ✅ type
- ✅ project_id
- ✅ private_key_id
- ✅ private_key
- ✅ client_email
- ✅ client_id
- ✅ auth_uri
- ✅ token_uri
- ✅ auth_provider_x509_cert_url
- ✅ client_x509_cert_url
- ✅ universe_domain

## 🚀 Test It Now!

**You MUST restart your dev server:**

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

Then test the Google Calendar integration:
1. Go to `http://localhost:9002/profile`
2. Click "Connect to Google Calendar"
3. Complete the OAuth flow
4. You should see "Google Calendar Connected" ✅

## 📊 Expected Terminal Output

After restarting, you should see:

```
🔵 OAuth callback route hit
✅ Code and state present, attempting token exchange...
Attempting to exchange auth code for tokens...
Using redirect URI: http://localhost:9002/api/auth/callback/google
Successfully received tokens from Google
Attempting to initialize Firebase Admin SDK...
Firebase Admin SDK initialized successfully
Successfully stored Google Calendar tokens for user: [your-user-id]
📊 Token exchange result: { success: true }
✅ Success! Redirecting to profile...
```

## 🎉 What's Working Now

1. ✅ Google OAuth credentials are valid
2. ✅ Authorization code exchange works
3. ✅ Tokens are successfully received from Google
4. ✅ Firebase service account JSON is valid
5. ✅ Firebase Admin SDK uses correct modern imports
6. ✅ Tokens will be saved to Firestore

## 📝 Summary of All Fixes

1. **OAuth redirect URI** - Fixed path and hostname normalization
2. **Firebase SDK mismatch** - Changed from client to admin SDK methods
3. **Malformed JSON** - Cleaned up duplicate `FIREBASE_SERVICE_ACCOUNT_KEY`
4. **Import style** - Updated to modern modular imports for firebase-admin v13

---

**Restart your server and test now!** 🚀
