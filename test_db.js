const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Robust parsing logic same as our config
const privateKey = serviceAccount.private_key.replace(/\\n/g, "\n");
console.log(`DEBUG: Private Key Start: [${privateKey.substring(0, 30)}]`);
console.log(`DEBUG: Private Key End: [${privateKey.substring(privateKey.length - 30)}]`);

admin.initializeApp({
    credential: admin.credential.cert({
        ...serviceAccount,
        private_key: privateKey
    })
});

const db = admin.firestore();

async function test() {
    try {
        console.log("Testing Firestore connection...");
        const snap = await db.collection("community_messages").limit(1).get();
        console.log("SUCCESS! Found " + snap.size + " messages.");
        process.exit(0);
    } catch (err) {
        console.error("FAILURE:", err.message);
        process.exit(1);
    }
}

test();
