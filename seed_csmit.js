const admin = require('firebase-admin');
const { db } = require('./src/config/firebase');

const FAKE_USERS = [
    {
        uid: 'user_csm_1',
        full_name: 'Elena Gilbert',
        username: 'elena_g',
        email: 'elena@example.com',
        role: 'member',
        regNo: 'RA2111003010201',
        department: 'CSMIT',
        year: '2',
        college: 'SRM',
        officialMail: 'elena@srm.edu.in',
        joined_at: new Date()
    },
    {
        uid: 'user_csm_2',
        full_name: 'Damon Salvatore',
        username: 'damon_s',
        email: 'damon@example.com',
        role: 'vice_chairman',
        regNo: 'RA2111003010202',
        department: 'CSMIT',
        year: '4',
        college: 'SRM',
        officialMail: 'damon@srm.edu.in',
        joined_at: new Date()
    },
    {
        uid: 'user_csm_3',
        full_name: 'Stefan Salvatore',
        username: 'stefan_s',
        email: 'stefan@example.com',
        role: 'member',
        regNo: 'RA2111003010203',
        department: 'CSMIT',
        year: '3',
        college: 'SRM',
        officialMail: 'stefan@srm.edu.in',
        joined_at: new Date()
    }
];

async function seedCSMembers() {
    console.log("Seeding CSMIT members...");

    // 1. Get Official CSMIT ID
    const clubSnapshot = await db.collection('clubs').where('name', '==', 'Official CSMIT').get();
    if (clubSnapshot.empty) {
        console.error("Official CSMIT club not found!");
        return;
    }
    const clubId = clubSnapshot.docs[0].id;
    console.log(`Found Club: ${clubId}`);

    for (const user of FAKE_USERS) {
        console.log(`Adding ${user.full_name}...`);

        await db.collection('users').doc(user.uid).set({
            ...user,
            joined_clubs: [clubId],
            roles: { [clubId]: user.role }
        }, { merge: true });

        await db.doc(`clubs/${clubId}/members/${user.uid}`).set({
            userId: user.uid,
            name: user.full_name,
            email: user.email,
            role: user.role,
            status: 'active',
            joined_at: new Date()
        });
    }

    await db.collection("clubs").doc(clubId).update({
        member_count: admin.firestore.FieldValue.increment(FAKE_USERS.length)
    });

    console.log("Seeding complete!");
    process.exit();
}

seedCSMembers().catch(console.error);
