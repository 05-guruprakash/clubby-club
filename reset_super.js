const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function run() {
    try {
        let config;
        const saPath = path.join(__dirname, 'serviceAccountKey.json');
        if (fs.existsSync(saPath)) {
            const serviceAccount = require(saPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Initialized via JSON file');
        } else {
            throw new Error('No serviceAccountKey.json found');
        }

        const auth = admin.auth();
        const userEmail = 'super@nexus.com';

        try {
            const user = await auth.getUserByEmail(userEmail);
            await auth.updateUser(user.uid, {
                password: 'password123'
            });
            console.log(`Successfully updated password for ${userEmail} to: password123`);
        } catch (e) {
            console.log(`User ${userEmail} not found in Auth. Creating...`);
            const userRecord = await auth.createUser({
                email: userEmail,
                password: 'password123',
                displayName: 'Super Admin'
            });
            console.log(`Successfully created ${userEmail} with password: password123`);

            // Also ensure firestore record exists
            const db = admin.firestore();
            await db.collection('users').doc(userRecord.uid).set({
                username: 'superAdmin',
                firstName: 'Super',
                lastName: 'Nexus',
                officialMail: userEmail,
                personalMail: userEmail,
                role: 'chairman',
                joined_clubs: []
            }, { merge: true });
            console.log('Firestore record created.');
        }

        process.exit(0);
    } catch (e) {
        console.error('FAILED:', e.message);
        process.exit(1);
    }
}

run();
