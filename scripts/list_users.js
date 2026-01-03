const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listUsers() {
    try {
        const listUsersResult = await admin.auth().listUsers(10);
        console.log('--- List of Users ---');
        listUsersResult.users.forEach((userRecord) => {
            console.log('uid:', userRecord.uid, '| email:', userRecord.email);
        });
        console.log('---------------------');
    } catch (error) {
        console.log('Error listing users:', error);
    }
}

listUsers();
