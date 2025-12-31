// functions/triggers/on_message_create.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

const onMessageCreate = onDocumentCreated(
  "community_messages/{id}",
  async (event) => {
    const message = event.data.data();
    if (!message) return;

    // Use field names consistent with ChatRoom.tsx
    const { communityId, senderId, text, type } = message;

    if (!communityId || !senderId) return;

    let recipients = [];

    try {
      if (type === "team") {
        // Fetch team members from the team document itself
        const teamDoc = await db.collection("teams").doc(communityId).get();
        if (teamDoc.exists) {
          const teamData = teamDoc.data();
          // Merge members array and leaderId
          recipients = teamData.members || [];
          if (teamData.leaderId && !recipients.includes(teamData.leaderId)) {
            recipients.push(teamData.leaderId);
          }
          // Also check leader_id for compatibility
          if (teamData.leader_id && !recipients.includes(teamData.leader_id)) {
            recipients.push(teamData.leader_id);
          }
        }

        // As a fallback, check team_members collection
        if (recipients.length === 0) {
          const membersSnap = await db
            .collection("team_members")
            .where("team_id", "==", communityId)
            .get();
          if (membersSnap.empty) {
            // Check teamId camelCase
            const membersSnap2 = await db
              .collection("team_members")
              .where("teamId", "==", communityId)
              .get();
            recipients = membersSnap2.docs.map(doc => doc.data().user_id || doc.data().userId);
          } else {
            recipients = membersSnap.docs.map(doc => doc.data().user_id || doc.data().userId);
          }
        }
      } else if (type === "club") {
        // Fetch club members from subcollection
        const subSnap = await db.collection(`clubs/${communityId}/members`).get();
        if (!subSnap.empty) {
          recipients = subSnap.docs
            .filter(d => d.data().status === 'active' || d.data().status === 'approved')
            .map(d => d.data().userId || d.data().user_id);
        }

        // Fallback to top-level collection
        if (recipients.length === 0) {
          const membersSnap = await db
            .collection("club_members")
            .where("club_id", "==", communityId)
            .get();
          recipients = membersSnap.docs
            .filter(d => d.data().status === 'active' || d.data().status === 'approved')
            .map(d => d.data().user_id || d.data().userId);
        }
      }

      // Filter out duplicates and the sender
      const notifyIds = [...new Set(recipients)].filter(id => id && id !== senderId);

      const notificationPromises = notifyIds.map(async (userId) => {
        // 1. Store in Firestore for persistent notification list
        await db.collection("notifications").add({
          user_id: userId,
          type: "new_message",
          message: `New message in ${type || 'community'}: ${text ? text.slice(0, 50) + (text.length > 50 ? '...' : '') : 'sent a message'}`,
          reference_id: communityId,
          is_read: false,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          community_type: type || "community"
        });

        // 2. Send Push Notification if FCM token exists
        const tokenDoc = await db.collection("fcm_tokens").doc(userId).get();
        if (tokenDoc.exists) {
          const token = tokenDoc.data().token;
          try {
            await messaging.send({
              token: token,
              notification: {
                title: "New Message",
                body: text ? text.slice(0, 100) : "You have a new message",
              },
              data: {
                communityId: communityId,
                type: type || "community"
              }
            });
          } catch (err) {
            // Silently fail push if token is invalid
          }
        }
      });

      await Promise.all(notificationPromises);
    } catch (err) {
      console.error("Error in onMessageCreate trigger:", err);
    }
  }
);

module.exports = {
  onMessageCreate,
};
