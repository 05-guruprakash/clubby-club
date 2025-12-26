import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration using provided project details
const firebaseConfig = {
    apiKey: "AIzaSyCXlAD0Xq1wVB-dxpHPS13LWhbEazLJKo0",
    authDomain: "gdg-7327.firebaseapp.com",
    projectId: "gdg-7327",
    storageBucket: "gdg-7327.firebasestorage.app",
    messagingSenderId: "549402899398",
    appId: "1:549402899398:web:0358b3711063f3645d38c7",
    measurementId: "G-7L1MQF7PGX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Emulator Logic: ONLY connect if we are explicitly in "demo-project" mode
// Since we have provided real credentials above, we will bypass emulators to reach your live project
const USE_EMULATORS = false;
const IS_DEV = import.meta.env.DEV;

if (USE_EMULATORS && IS_DEV) {
    try {
        console.log('🔧 Connecting to Firebase Emulators...');
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, '127.0.0.1', 8090);
        connectStorageEmulator(storage, '127.0.0.1', 9199);
        console.log('✅ Connected to Firebase Emulators (Auth: 9099, Firestore: 8090, Storage: 9199)');
    } catch (error) {
        console.error('❌ Failed to connect to emulators:', error);
    }
} else {
    console.log('🚀 Connected to LIVE Production Firebase:', firebaseConfig.projectId);
}

export default app;
