// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDf-Brx4neulc5Qfz9y0gADrkLogfyP52g",
  authDomain: "invoice-new-6a045.firebaseapp.com",
  projectId: "invoice-new-6a045",
  storageBucket: "invoice-new-6a045.firebasestorage.app",
  messagingSenderId: "252788260766",
  appId: "1:252788260766:web:b57a809434697025fda08f",
  measurementId: "G-HGGR4HMDXM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase app initialized:", app.name);

// Initialize Firestore
export const db = getFirestore(app);
console.log("Firestore initialized");

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);
