require('dotenv').config();
const admin = require('firebase-admin');

console.log("Testing ENV variables...");
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error("Missing ENV vars!");
    process.exit(1);
}

// FORMATTING LOGIC
const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

console.log(`Project: ${projectId}`);
console.log(`Email: ${clientEmail.substring(0, 10)}...`);
console.log(`Key Start: ${privateKey.substring(0, 30)}...`);
console.log(`Key Length: ${privateKey.length}`);

admin.initializeApp({
    credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
    })
});

const db = admin.firestore();

async function test() {
    try {
        console.log("Attempting to read users...");
        const snapshot = await db.collection('users').limit(1).get();
        console.log(`Success! Found ${snapshot.size} users.`);
    } catch (e) {
        console.error("FAILED:", e.message);
        console.error("Code:", e.code);
    }
}

test();
