const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function createAdmin(email, password, username) {
    try {
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log('User already exists in Auth. Updating Firestore record...');
        } catch (e) {
            userRecord = await auth.createUser({
                email: email,
                password: password,
                displayName: username
            });
            console.log('Successfully created new user in Auth:', userRecord.uid);
        }

        await db.collection('users').doc(userRecord.uid).set({
            username: username,
            firstName: 'Admin',
            lastName: 'User',
            regNo: 'ADMIN001',
            year: '4',
            department: 'Management',
            college: 'NEXUS HQ',
            officialMail: email,
            personalMail: email,
            phoneNumber: '1234567890',
            role: 'chairman', // This grants admin access
            joined_clubs: []
        }, { merge: true });

        console.log('Admin user promoted in Firestore with role: chairman');
        console.log('\n--- LOGIN CREDENTIALS ---');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log('--------------------------');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin('admin@nexus.com', 'password123', 'SuperAdmin');
