const admin = require("firebase-admin");

if (!admin.apps.length) {
<<<<<<< HEAD
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
=======
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
>>>>>>> 1b01de9af77f472fa0faf6670c6b250ee70ee80e
}

const auth = admin.auth();
const db = admin.firestore();

<<<<<<< HEAD
if (process.env.FIREBASE_PROJECT_ID) {
  console.log("🚀 Connected to PRODUCTION Firebase");
} else {
  console.log("🚀 Connected to Firebase EMULATOR");
}
=======
console.log("🚀 Connected to PRODUCTION Firebase");
>>>>>>> 1b01de9af77f472fa0faf6670c6b250ee70ee80e

module.exports = { admin, auth, db };
