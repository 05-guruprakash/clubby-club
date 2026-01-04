require("dotenv").config();
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let app;
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(__dirname, "../../serviceAccountKey.json");

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(serviceAccountPath);
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
      console.error("❌ Error loading serviceAccountKey.json:", err);
    }
  } else {
    console.log("⚠️ serviceAccountKey.json not found, checking Environment Variables...");
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
      } else {
        console.warn("❌ No Firebase credentials found! Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY env vars.");
      }
    } catch (envErr) {
      console.error("❌ Firebase Admin ENV Initialization Error:", envErr.message);
    }
  }
} else {
  app = admin.app();
}

if (!app) {
  throw new Error("🔥 Firebase failed to initialize. Check your 'serviceAccountKey.json' or Environment Variables (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).");
}

const auth = app.auth();
const db = app.firestore();

  module.exports = { admin, auth, db };
