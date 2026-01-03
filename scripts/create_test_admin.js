const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function createAdminUser() {
    const email = 'admin@nexus.test';
    const password = 'Password@123';
    const role = 'chairman';

    try {
        // 1. Create Authentication User
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log(`User ${email} already exists. Updating password...`);
            await auth.updateUser(userRecord.uid, { password: password });
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`Creating new user ${email}...`);
                userRecord = await auth.createUser({
                    email: email,
                    password: password,
                    emailVerified: true,
                    displayName: 'Nexus Admin'
                });
            } else {
                throw error;
            }
        }

        // 2. Set Firestore Data with Admin Role
        await db.collection('users').doc(userRecord.uid).set({
            email: email,
            username: 'admin_nexus',
            full_name: 'Nexus System Admin',
            role: role,
            createdAt: new Date().toISOString(),
            isProfileComplete: true, // Bypass setup
            department: 'ADMIN',
            year: '4',
            college: 'System',
            joined_clubs: []
        }, { merge: true });

        console.log('--------------------------------------------------');
        console.log('✅ Admin Account Ready');
        console.log(`📧 Email:    ${email}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`🛡️  Role:     ${role}`);
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

createAdminUser();
