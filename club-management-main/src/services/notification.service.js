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

  const tokenSnap = await db.collection("fcm_tokens").doc(userId).get();
  if (!tokenSnap.exists) return;

  await messaging.send({
    token: tokenSnap.data().token,
    notification: {
      title: payload.type,
      body: payload.message,
    },
  });
};

module.exports = {
  notifyUser,
};
