const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function resetClubs() {
    const coll = db.collection('clubs');
    const snapshot = await coll.get();

    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Wiped existing clubs.");

    const clubs = [
        {
            name: 'Coding Club',
            description: 'The ultimate space for developers to build, learn and compete. Join us to master DSA, Web Dev and more.',
            moto: 'Code Your Way Up',
            since: '2020',
            eventsConducted: 45,
            requiresApproval: true
        },
        {
            name: 'Official CSMIT',
            description: 'The official Computer Science and Metallurgy Institute of Technology club focusing on engineering and innovation.',
            moto: 'Innovation & Excellence',
            since: '2018',
            eventsConducted: 120,
            requiresApproval: false
        }
    ];

    for (const club of clubs) {
        await coll.add(club);
        console.log(`Club ${club.name} added!`);
    }
}

resetClubs().then(() => {
    console.log('Reset complete.');
    process.exit();
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
