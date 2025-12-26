require('dotenv').config();
const admin = require('firebase-admin');

async function listUsers() {
    try {
        if (!admin.apps.length) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey
                })
            });
        }
        const db = admin.firestore();
        const snap = await db.collection('users').get();
        console.log('USERS FOUND:');
        snap.forEach(d => {
            console.log(`- ${d.id}: ${d.data().email || d.data().officialMail || 'NO EMAIL'}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
listUsers();
