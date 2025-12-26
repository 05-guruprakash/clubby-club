require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function run() {
    try {
        if (!admin.apps.length) {
            let config;
            // Try environment variables first
            if (process.env.FIREBASE_PRIVATE_KEY) {
                config = {
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                };
                admin.initializeApp({ credential: admin.credential.cert(config) });
                console.log('Initialized via ENV');
            } else {
                // Fallback to serviceAccountKey.json in current dir
                const saPath = path.join(__dirname, 'serviceAccountKey.json');
                if (fs.existsSync(saPath)) {
                    const serviceAccount = require(saPath);
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount)
                    });
                    console.log('Initialized via JSON file');
                } else {
                    throw new Error('No credentials found (ENV or JSON)');
                }
            }
        }

        const db = admin.firestore();
        const auth = admin.auth();

        const userEmail = 'super@nexus.com';
        const user = await auth.getUserByEmail(userEmail);
        const uid = user.uid;

        const clubsSnap = await db.collection('clubs').where('name', '==', 'Coding Club').get();
        if (clubsSnap.empty) throw new Error('Coding Club not found');
        const clubDoc = clubsSnap.docs[0];
        const clubId = clubDoc.id;

        console.log(`Setting ${userEmail} (${uid}) as chairperson for ${clubId}`);

        const batch = db.batch();

        // Add to subcollection
        batch.set(db.doc(`clubs/${clubId}/members/${uid}`), {
            userId: uid,
            role: 'chairman',
            status: 'active',
            joined_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update user
        batch.update(db.collection('users').doc(uid), {
            joined_clubs: admin.firestore.FieldValue.arrayUnion(clubId),
            [`roles.${clubId}`]: 'chairman'
        });

        // Update club count
        batch.update(clubDoc.ref, {
            member_count: admin.firestore.FieldValue.increment(1)
        });

        await batch.commit();
        console.log('SUCCESS');
        process.exit(0);
    } catch (e) {
        console.error('FAILED:', e.message);
        process.exit(1);
    }
}

run();
