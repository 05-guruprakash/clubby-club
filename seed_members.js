const admin = require('firebase-admin');
const { db } = require('./src/config/firebase');

const FAKE_USERS = [
    {
        uid: 'user_fake_1',
        full_name: 'Alice Johnson',
        username: 'alice_j',
        email: 'alice@example.com',
        role: 'member',
        regNo: 'RA2111003010101',
        department: 'CSE',
        year: '3',
        college: 'SRM',
        officialMail: 'alice@srm.edu.in',
        joined_at: new Date()
    },
    {
        uid: 'user_fake_2',
        full_name: 'Bob Smith',
        username: 'bobby_s',
        email: 'bob@example.com',
        role: 'member',
        regNo: 'RA2111003010102',
        department: 'ECE',
        year: '2',
        college: 'SRM',
        officialMail: 'bob@srm.edu.in',
        joined_at: new Date()
    },
    {
        uid: 'user_fake_3',
        full_name: 'Charlie Brown',
        username: 'charlie_b',
        email: 'charlie@example.com',
        role: 'event_head',
        regNo: 'RA2111003010103',
        department: 'IT',
        year: '4',
        college: 'SRM',
        officialMail: 'charlie@srm.edu.in',
        joined_at: new Date()
    },
    {
        uid: 'user_fake_4',
        full_name: 'Diana Prince',
        username: 'wonder_di',
        email: 'diana@example.com',
        role: 'secretary',
        regNo: 'RA2111003010104',
        department: 'Mech',
        year: '3',
        college: 'SRM',
        officialMail: 'diana@srm.edu.in',
        joined_at: new Date()
    }
];

async function seedMembers() {
    console.log("Seeding fake members...");

    // 1. Get Coding Club ID
    const clubSnapshot = await db.collection('clubs').where('name', '==', 'Coding Club').get();
    if (clubSnapshot.empty) {
        console.error("Coding Club not found!");
        return;
    }
    const clubId = clubSnapshot.docs[0].id;
    console.log(`Found Coding Club: ${clubId}`);

    for (const user of FAKE_USERS) {
        console.log(`Adding ${user.full_name}...`);

        // Add to global Users
        await db.collection('users').doc(user.uid).set({
            ...user,
            joined_clubs: [clubId],
            roles: { [clubId]: user.role }
        }, { merge: true });

        // Add to Club Members subcollection
        await db.doc(`clubs/${clubId}/members/${user.uid}`).set({
            userId: user.uid,
            name: user.full_name,
            email: user.email,
            role: user.role,
            status: 'active',
            joined_at: new Date()
        });
    }

    // Update member count
    await db.collection("clubs").doc(clubId).update({
        member_count: admin.firestore.FieldValue.increment(FAKE_USERS.length)
    });

    console.log("Seeding complete!");
    process.exit();
}

seedMembers().catch(console.error);
