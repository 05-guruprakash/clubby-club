// src/services/notification.service.js
const { db, messaging } = require("../config/firebase");

const notifyUser = async (userId, payload) => {
  await db.collection("notifications").add({
    user_id: userId,
    type: payload.type,
    message: payload.message,
    reference_id: payload.reference_id || null,
    is_read: false,
    created_at: new Date(),
  });

  try {
    const tokenSnap = await db.collection("fcm_tokens").doc(userId).get();
    if (!tokenSnap.exists) return;

    await messaging.send({
      token: tokenSnap.data().token,
      notification: {
        title: payload.type,
        body: payload.message,
      },
    });
  } catch (err) {
    console.warn(`Failed to send push notification to ${userId}:`, err.message);
  }
};

// Notify club/team admins about a join request
const notifyAdminsOfJoinRequest = async (
  clubId,
  clubName,
  userId,
  userName
) => {
  try {
    // Get all chairpersons/admins of the club
    const membersSnap = await db
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .where("role", "in", ["chairperson", "admin"])
      .get();

    if (membersSnap.empty) return;

    const notificationPromises = [];

    for (const doc of membersSnap.docs) {
      const adminId = doc.data().userId;
      notificationPromises.push(
        notifyUser(adminId, {
          type: "join_request",
          message: `${userName} has requested to join ${clubName}`,
          reference_id: clubId,
        })
      );
    }

    await Promise.all(notificationPromises);
    console.log(
      `✅ Notified admins of ${clubName} about join request from ${userName}`
    );
  } catch (err) {
    console.error("Error notifying admins of join request:", err);
  }
};

// Notify user about request approval
const notifyRequestApproval = async (userId, clubId, clubName, isApproved) => {
  try {
    const message = isApproved
      ? `Your request to join ${clubName} has been approved!`
      : `Your request to join ${clubName} has been rejected.`;

    await notifyUser(userId, {
      type: isApproved ? "request_approved" : "request_rejected",
      message: message,
      reference_id: clubId,
    });

    console.log(
      `✅ Notified user ${userId} about ${
        isApproved ? "approval" : "rejection"
      } for ${clubName}`
    );
  } catch (err) {
    console.error("Error notifying user of request status:", err);
  }
};

// Notify all members of a community about a new message
const notifyMembersOfNewMessage = async (
  communityId,
  communityType,
  senderId,
  senderName,
  messageText
) => {
  try {
    let membersSnap;

    // Get members based on community type
    if (communityType === "club") {
      membersSnap = await db
        .collection("clubs")
        .doc(communityId)
        .collection("members")
        .where("status", "==", "active")
        .get();
    } else if (communityType === "team") {
      membersSnap = await db
        .collection("team_members")
        .where("teamId", "==", communityId)
        .where("status", "==", "approved")
        .get();
    } else {
      // For events or other types
      membersSnap = await db
        .collection("community_members")
        .where("community_id", "==", communityId)
        .get();
    }

    if (membersSnap.empty) return;

    const notificationPromises = [];
    const fcmTokens = [];

    for (const doc of membersSnap.docs) {
      const memberId = doc.data().userId || doc.data().user_id;

      // Don't notify the sender
      if (memberId === senderId) continue;

      // Add notification to database
      notificationPromises.push(
        db.collection("notifications").add({
          user_id: memberId,
          type: "new_message",
          message: `${senderName}: ${messageText.slice(0, 100)}${
            messageText.length > 100 ? "..." : ""
          }`,
          reference_id: communityId,
          is_read: false,
          created_at: new Date(),
        })
      );

      // Collect FCM tokens for push notifications
      const tokenSnap = await db.collection("fcm_tokens").doc(memberId).get();
      if (tokenSnap.exists) {
        fcmTokens.push(tokenSnap.data().token);
      }
    }

    await Promise.all(notificationPromises);

    // Send push notifications in batch
    if (fcmTokens.length > 0) {
      try {
        await messaging.sendEachForMulticast({
          tokens: fcmTokens,
          notification: {
            title: "New Message",
            body: `${senderName}: ${messageText.slice(0, 100)}`,
          },
        });
      } catch (err) {
        console.warn("Failed to send push notifications:", err.message);
      }
    }

    console.log(
      `✅ Notified ${notificationPromises.length} members about new message in ${communityType} ${communityId}`
    );
  } catch (err) {
    console.error("Error notifying members of new message:", err);
  }
};

module.exports = {
  notifyUser,
  notifyAdminsOfJoinRequest,
  notifyRequestApproval,
  notifyMembersOfNewMessage,
};
