import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Replace these with your Firebase config values
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Add debug logging to see if Firebase is properly initialized
console.log('Firebase initialized with config:', {
  apiKey: firebaseConfig.apiKey ? 'present' : 'missing',
  authDomain: firebaseConfig.authDomain ? 'present' : 'missing',
  projectId: firebaseConfig.projectId ? 'present' : 'missing',
});

// Deprecated: Use onAuthStateChanged instead to avoid hydration issues
export const checkAuth = () => {
  const user = auth.currentUser;
  console.log('User is', user);
  return user !== null;
};

// Better auth utility that doesn't cause hydration issues
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Promise-based auth state check
export const waitForAuthInit = (): Promise<unknown> => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};
