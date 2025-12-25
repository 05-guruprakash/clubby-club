// functions/triggers/on_message_create.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const onMessageCreate = onDocumentCreated(
  "community_messages/{id}",
  async (event) => {
    const message = event.data.data();
    const { community_id, user_id, message_text } = message;

    // Fetch community members
    const membersSnap = await db
      .collection("community_members")
      .where("community_id", "==", community_id)
      .get();

    if (membersSnap.empty) return;

    const tokens = [];

    for (const doc of membersSnap.docs) {
      const memberId = doc.data().user_id;
      if (memberId === user_id) continue;

      const tokenDoc = await db.collection("fcm_tokens").doc(memberId).get();
      if (tokenDoc.exists) {
        tokens.push(tokenDoc.data().token);
      }

      // store notification
      await db.collection("notifications").add({
        user_id: memberId,
        type: "new_message",
        message: "New message in your community",
        reference_id: community_id,
        is_read: false,
        created_at: new Date(),
      });
    }

    if (tokens.length > 0) {
      await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: "New Message",
          body: message_text.slice(0, 100),
        },
      });
    }
  }
);

module.exports = {
  onMessageCreate,
};
