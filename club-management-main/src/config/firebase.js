const admin = require("firebase-admin");

if (!admin.apps.length) {
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    // Use emulator
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    admin.initializeApp({
      projectId: "demo-project",
    });
  }
}

const auth = admin.auth();
const db = admin.firestore();

if (process.env.FIREBASE_PROJECT_ID) {
  console.log("🚀 Connected to PRODUCTION Firebase");
} else {
  console.log("🚀 Connected to Firebase EMULATOR");
}

module.exports = { admin, auth, db };
