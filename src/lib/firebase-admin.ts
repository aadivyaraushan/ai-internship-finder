import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Normalize and validate required env vars for Admin SDK
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail =
  process.env.FIREBASE_CLIENT_EMAIL ||
  process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
const privateKey = (
  process.env.FIREBASE_PRIVATE_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY
)?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  // Log which ones are missing for better debugging
  console.error('Missing Firebase Admin env vars details:', {
    projectId: !!projectId,
    clientEmail: !!clientEmail,
    privateKey: !!privateKey,
  });
  throw new Error(
    'Missing Firebase Admin env vars. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.'
  );
}

// Initialize Firebase Admin once
const apps = getApps();

if (!apps.length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export const auth = getAuth();
