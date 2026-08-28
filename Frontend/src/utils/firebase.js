import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Web app Firebase configuration for MAXSHOW
const firebaseConfig = {
  apiKey: "AIzaSyCZmO8-4fEaHLqYrT2oLHO6WFXagPVkfTM",
  authDomain: "maxshow-21300.firebaseapp.com",
  projectId: "maxshow-21300",
  storageBucket: "maxshow-21300.firebasestorage.app",
  messagingSenderId: "984308781595",
  appId: "1:984308781595:web:11441c3e6fafac3e48debe",
  measurementId: "G-98KNBFD57Y"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

export { RecaptchaVerifier, signInWithPhoneNumber };
