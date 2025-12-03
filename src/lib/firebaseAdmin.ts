import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// This works both locally (with Application Default Credentials) and on Vercel (with service account JSON)
if (!admin.apps.length) {
  try {
    // Try to use service account from environment variable (for Vercel/production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });

      console.log('Firebase Admin initialized with service account');
    } else {
      // Fallback to default credentials (for local development)
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'studio-5509266701-95460',
      });

      console.log('Firebase Admin initialized with default credentials');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export { admin };
