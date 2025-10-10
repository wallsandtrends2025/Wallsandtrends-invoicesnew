// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAoVDfwji6ueGndkRANbCeAx93PVu9BqZU",
  authDomain: "wt-invoices.firebaseapp.com",
  projectId: "wt-invoices",
  storageBucket: "wt-invoices.appspot.com",
  messagingSenderId: "6264858046",
  appId: "1:6264858046:web:ab835097cb4d0b5ebc45ef"
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
