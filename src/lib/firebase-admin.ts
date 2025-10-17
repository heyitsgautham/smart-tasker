
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

function initializeAdmin() {
  // Check if already initialized
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    console.log('Firebase Admin already initialized');
    return;
  }

  const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    console.error("SERVICE_ACCOUNT_KEY is not set. Firebase Admin SDK is not initialized.");
    return;
  }

  try {
    console.log('Attempting to initialize Firebase Admin SDK...');
    const serviceAccount = JSON.parse(serviceAccountKey);

    // Validate the service account has required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Invalid service account: missing required fields (project_id, private_key, or client_email)');
    }

    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (e) {
    console.error("Failed to parse SERVICE_ACCOUNT_KEY or initialize Firebase Admin SDK.", e);
    if (e instanceof Error) {
      console.error("Error details:", e.message);
      console.error("Stack trace:", e.stack);
    }
  }
}

function getFirebaseAdmin(): App {
  if (!adminApp) {
    initializeAdmin();
    if (!adminApp) {
      throw new Error("Server is not configured for this action. Please check your Firebase Admin SDK setup.");
    }
  }
  return adminApp;
}

function getDb(): Firestore {
  const app = getFirebaseAdmin();
  return getFirestore(app);
}

function getAdminAuth(): Auth {
  const app = getFirebaseAdmin();
  return getAuth(app);
}

export { getDb, getAdminAuth as getAuth };
