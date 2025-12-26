require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ?.trim()
        ?.replace(/^["']|["']$/g, "")
        ?.replace(/\\n/g, "\n");

    if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
                privateKey: privateKey,
            })
        });
    } else {
        const serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
}

const db = admin.firestore();

async function checkData() {
    try {
        console.log("Checking events...");
        const events = await db.collection('events').get();
        console.log(`Found ${events.size} events.`);
        events.forEach(doc => console.log(doc.id, doc.data().title));

        console.log("\nChecking posts...");
        const posts = await db.collection('posts').get();
        console.log(`Found ${posts.size} posts.`);
        posts.forEach(doc => console.log(doc.id, doc.data().content?.substring(0, 50)));

        process.exit(0);
    } catch (e) {
        console.error("Error: ", e);
        process.exit(1);
    }
}

checkData();
