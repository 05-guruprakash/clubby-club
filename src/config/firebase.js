const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = require("../../serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

console.log("🚀 Connected to PRODUCTION Firebase");

module.exports = { admin, auth, db };
