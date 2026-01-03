require("dotenv").config();
const admin = require("firebase-admin");

let app;
if (!admin.apps.length) {
  try {
    const serviceAccount = require("../../serviceAccountKey.json");

    // Ensure handles both JSON escape \n and literal newlines
    const privateKey = serviceAccount.private_key && serviceAccount.private_key.replace(/\\n/g, "\n");

    app = admin.initializeApp({
      credential: admin.credential.cert({
        ...serviceAccount,
        private_key: privateKey
      }),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      storageBucket: "gdg-7327.appspot.com"
    });
    console.log(`🚀 Connected to PRODUCTION Firebase via serviceAccountKey.json`);
  } catch (err) {
    console.error("❌ Firebase Admin Initialization Error:", err.message);

    // Fallback to environment variables
    try {
      const projId = process.env.FIREBASE_PROJECT_ID || "gdg-7327";
      const email = process.env.FIREBASE_CLIENT_EMAIL;
      const key = process.env.FIREBASE_PRIVATE_KEY;

      if (email && key) {
        app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projId,
            clientEmail: email,
            privateKey: key.replace(/\\n/g, "\n")
          }),
          databaseURL: `https://${projId}.firebaseio.com`,
          storageBucket: `${projId}.appspot.com`
        });
        console.log(`🚀 Connected to PRODUCTION Firebase via ENV Vars`);
      }
    } catch (envErr) {
      console.error("❌ Firebase Admin ENV Initialization Error:", envErr.message);
    }
  }
} else {
  app = admin.app();
}

const auth = app.auth();
const db = app.firestore();

module.exports = { admin, auth, db };
