require("dotenv").config();
const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ?.trim()
      ?.replace(/^["']|["']$/g, "")
      ?.replace(/\\n/g, "\n");

    // PRIORITY 1: Try serviceAccountKey.json
    let initialized = false;
    try {
      const serviceAccount = require("../../serviceAccountKey.json");
      console.log(`DEBUG: Found serviceAccountKey.json. Project: ${serviceAccount.project_id}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log(`🚀 Connected to PRODUCTION Firebase via ALL-POWERFUL JSON: ${serviceAccount.project_id}`);
      initialized = true;
    } catch (jsonErr) {
      console.warn("⚠️ Could not load serviceAccountKey.json:", jsonErr.message);
    }

    // PRIORITY 2: Fallback to ENV variables
    if (!initialized && projectId && clientEmail && privateKey) {
      console.log(`DEBUG: Falling back to Env Vars. Project: ${projectId}`);
      const formattedKey = privateKey.includes("-----BEGIN PRIVATE KEY-----")
        ? privateKey
        : "-----BEGIN PRIVATE KEY-----\n" + privateKey + "\n-----END PRIVATE KEY-----";

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
      });
      console.log(`🚀 Connected to PRODUCTION Firebase via ENV: ${projectId}`);
    }
  } catch (err) {
    console.error("❌ Firebase Admin Initialization Error:", err.message);
  }
}

const auth = admin.auth();
const db = admin.firestore();

module.exports = { admin, auth, db };
