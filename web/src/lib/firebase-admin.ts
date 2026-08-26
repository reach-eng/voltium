import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { logger } from '@/lib/logger';

/**
 * Voltium Firebase Admin SDK Loader
 *
 * Safely initializes the Admin SDK for use in Next.js Server Components
 * and Route Handlers.
 */

const getAdminApp = () => {
  // Check if any app is already initialized
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Handle escaped newlines in private key if they exist
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('[FirebaseAdmin] Missing configuration. Verification will fail.');
    return null;
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    logger.error('[FirebaseAdmin] Initialization failed:', { error });
    return null;
  }
};

const firebaseAdmin = getAdminApp();

export const auth = firebaseAdmin ? getAuth(firebaseAdmin) : null;
export default firebaseAdmin;
