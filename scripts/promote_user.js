const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function promoteUser(uid) {
    try {
        const userRef = db.collection('users').doc(uid);
        await userRef.set({ role: 'chairman' }, { merge: true });
        console.log(`Successfully promoted user ${uid} to 'chairman'.`);
    } catch (error) {
        console.error('Error promoting user:', error);
    }
}

// Get UID from args
const uid = process.argv[2];
if (!uid) {
    console.log('Please provide a UID as an argument.');
    process.exit(1);
}

promoteUser(uid);
