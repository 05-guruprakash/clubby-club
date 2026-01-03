// functions/triggers/on_message_create.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Check if admin is already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

const onMessageCreate = onDocumentCreated(
  "community_messages/{id}",
  async (event) => {
    const message = event.data.data();
    const { communityId, senderId, senderName, text, type } = message;

    if (!communityId || !senderId) {
      console.log("Missing communityId or senderId, skipping notification");
      return;
    }

    console.log(
      `📨 New message in ${
        type || "community"
      } ${communityId} from ${senderName}`
    );

    let membersSnap;

    try {
      // Get members based on community type
      if (type === "club") {
        membersSnap = await db
          .collection("clubs")
          .doc(communityId)
          .collection("members")
          .where("status", "==", "active")
          .get();
      } else if (type === "team") {
        membersSnap = await db
          .collection("team_members")
          .where("teamId", "==", communityId)
          .where("status", "==", "approved")
          .get();
      } else if (type === "event") {
        // For events, check event participants
        membersSnap = await db
          .collection("events")
          .doc(communityId)
          .collection("participants")
          .get();
      } else {
        // Fallback to community_members
        membersSnap = await db
          .collection("community_members")
          .where("community_id", "==", communityId)
          .get();
      }

      if (membersSnap.empty) {
        console.log("No members found for this community");
        return;
      }

      const tokens = [];
      const notificationPromises = [];

      for (const doc of membersSnap.docs) {
        const memberId = doc.data().userId || doc.data().user_id;

        // Don't notify the sender
        if (memberId === senderId) continue;

        // Store notification in database
        notificationPromises.push(
          db.collection("notifications").add({
            user_id: memberId,
            type: "new_message",
            message: `${senderName}: ${(text || "").slice(0, 100)}${
              (text || "").length > 100 ? "..." : ""
            }`,
            reference_id: communityId,
            is_read: false,
            created_at: new Date(),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          })
        );

        // Collect FCM token for push notification
        const tokenDoc = await db.collection("fcm_tokens").doc(memberId).get();
        if (tokenDoc.exists) {
          tokens.push(tokenDoc.data().token);
        }
      }

      // Save all notifications
      await Promise.all(notificationPromises);
      console.log(
        `✅ Created ${notificationPromises.length} notification records`
      );

      // Send push notifications
      if (tokens.length > 0) {
        try {
          await messaging.sendEachForMulticast({
            tokens,
            notification: {
              title: "New Message",
              body: `${senderName}: ${(text || "").slice(0, 100)}`,
            },
            data: {
              communityId: communityId,
              type: type || "community",
            },
          });
          console.log(`✅ Sent push notifications to ${tokens.length} members`);
        } catch (err) {
          console.warn("Failed to send push notifications:", err.message);
        }
      }
    } catch (err) {
      console.error("Error in onMessageCreate trigger:", err);
    }
  }
);

module.exports = {
  onMessageCreate,
};
