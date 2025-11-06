// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeAppCheck } from "firebase/app-check";

// Secure environment-based configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate configuration - prevent runtime errors
if (!firebaseConfig.apiKey) {
  throw new Error('Firebase API key not configured. Please check your environment variables.');
}

if (!firebaseConfig.projectId) {
  throw new Error('Firebase project ID not configured. Please check your environment variables.');
}

// Initialize Firebase with validated config
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Firebase Functions (for server-side email/SMS sending)
import { getFunctions } from 'firebase/functions';
export const functions = getFunctions(app);

// App Check configuration - Temporarily disabled to fix reCAPTCHA issues
// Will be re-enabled once proper reCAPTCHA keys are configured
if (import.meta.env.VITE_ENABLE_APP_CHECK === 'true') {
  try {
    const { ReCaptchaV3Provider } = await import('firebase/app-check');
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    console.log('App Check initialized successfully');
  } catch (error) {
    console.warn('App Check initialization failed:', error.message);
  }
}

// Export app for potential future use
export { app };
