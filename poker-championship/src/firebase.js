import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {
   // Paste firebase database credentials here
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Sanitize appId to ensure it doesn't contain slashes which break Firestore document segment counts
const rawAppId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'poker-championship-app';
export const safeAppId = rawAppId.replace(/\//g, '_');

