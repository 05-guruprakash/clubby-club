const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize directly
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function run() {
    try {
        console.log("Script started.");

        // 1. Get Club
        const snapshot = await db.collection('clubs').where('name', '==', 'Official CSMIT').get();
        if (snapshot.empty) {
            console.log("Club not found.");
            return;
        }
        const clubId = snapshot.docs[0].id;
        console.log("Club ID:", clubId);

        // 2. Add sample messages
        const texts = [
            "Hello World",
            "Seed Message 2",
            "Can I view this?"
        ];

        // 3. Get a user
        const uSnap = await db.collection('users').limit(1).get();
        const userId = !uSnap.empty ? uSnap.docs[0].id : 'user_csm_1';

        for (const txt of texts) {
            await db.collection('community_messages').add({
                communityId: clubId,
                text: txt,
                senderId: userId,
                senderName: 'Seeder',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                type: 'club',
                likes: [],
                comments: []
            });
        }
        console.log("Messages added.");

        // 4. Update ALL users to join this club (Brute force fix for Access Denied)
        const allUsers = await db.collection('users').get();
        const batch = db.batch();
        allUsers.docs.forEach(doc => {
            batch.update(doc.ref, {
                joined_clubs: admin.firestore.FieldValue.arrayUnion(clubId)
            });
        });
        await batch.commit();
        console.log("Users updated.");

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
