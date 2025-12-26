const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
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
