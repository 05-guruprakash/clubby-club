const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(__dirname, 'serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function test() {
    try {
        console.log("Testing Application Default Credentials...");
        const snapshot = await db.collection('users').limit(1).get();
        console.log(`Success! Found ${snapshot.size} users.`);
    } catch (e) {
        console.error("FAILED:", e.message);
        console.error("Code:", e.code);
    }
}

test();
