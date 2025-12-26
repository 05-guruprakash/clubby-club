import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCXlAD0Xq1wVB-dxpHPS13LWhbEazLJKo0",
  authDomain: "gdg-7327.firebaseapp.com",
  projectId: "gdg-7327",
  storageBucket: "gdg-7327.firebasestorage.app",
  messagingSenderId: "549402899398",
  appId: "1:549402899398:web:0358b3711063f3645d38c7",
  measurementId: "G-7L1MQF7PGX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
