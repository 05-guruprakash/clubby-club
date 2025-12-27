const admin = require('firebase-admin');
const { db } = require('./src/config/firebase');

async function seedChats() {
    console.log("Starting Chat Seeding...");

    // 1. Get Official CSMIT Club
    const clubSnapshot = await db.collection('clubs').where('name', '==', 'Official CSMIT').get();
    if (clubSnapshot.empty) {
        console.error("Official CSMIT club not found! Please run seed_csmit.js first or create the club.");
        return;
    }
    const clubDoc = clubSnapshot.docs[0];
    const clubId = clubDoc.id;
    console.log(`Target Club: ${clubDoc.data().name} (ID: ${clubId})`);

    // 2. Get Users to be chat participants
    const usersSnapshot = await db.collection('users').get();
    if (usersSnapshot.empty) {
        console.error("No users found to key chat messages to.");
        return;
    }

    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Found ${users.length} users.`);

    // 3. Fix "Access Denied" - Ensure all users have this club in joined_clubs
    const batch = db.batch();
    let updatesCount = 0;

    for (const user of users) {
        const joined = user.joined_clubs || [];
        if (!joined.includes(clubId)) {
            console.log(`Updating user ${user.username || user.email} to include club ${clubId}`);
            const userRef = db.collection('users').doc(user.id);
            batch.update(userRef, {
                joined_clubs: admin.firestore.FieldValue.arrayUnion(clubId)
            });
            updatesCount++;
        }

        // Also ensure they are in the club's members subcollection if missing (though user didn't explicitly ask for this, it's safer for consistency)
        // skipping subcollection check to be minimal, "joined_clubs" is what ChatRoom checks.
    }

    if (updatesCount > 0) {
        await batch.commit();
        console.log(`Updated ${updatesCount} users with correct joined_clubs data.`);
    } else {
        console.log("All users already have correct access rights.");
    }

    // 4. Create Sample Messages
    const messagesCollection = db.collection('community_messages');

    // Check if we already have messages to avoid duplicate spam if run multiple times
    const existingMsgs = await messagesCollection.where('communityId', '==', clubId).get();
    if (!existingMsgs.empty) {
        console.log(`Found ${existingMsgs.size} existing messages. Adding new ones anyway...`);
    }

    const sampleTexts = [
        "Hey everyone! Welcome to the Official CSMIT page.",
        "Is there an event coming up this weekend?",
        "I heard the hackathon is going to be huge!",
        "Can members view this chat now?",
        "Just checking in, love the new features."
    ];

    for (let i = 0; i < sampleTexts.length; i++) {
        const sender = users[i % users.length];
        const msgData = {
            communityId: clubId,
            text: sampleTexts[i],
            senderId: sender.id,
            senderName: sender.full_name || sender.username || sender.email || 'Anonymous',
            senderRole: sender.role || 'member',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: 'club', // Match the type used in frontend
            likes: [],
            comments: []
        };

        // Add some random likes/comments to the last one
        if (i === sampleTexts.length - 1) {
            msgData.likes = [users[0].id]; // Like by first user
            msgData.comments = [{
                id: 'comment_1',
                text: "Yes, they can!",
                senderId: users[0].id,
                senderName: users[0].full_name || "User 1",
                createdAt: new Date()
            }];
        }

        await messagesCollection.add(msgData);
    }

    console.log(`Added ${sampleTexts.length} sample messages.`);
    process.exit();
}


seedChats().catch(error => {
    console.error("Seeding failed with error:");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
});
