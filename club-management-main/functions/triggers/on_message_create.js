const tokens = [];
const notificationWrites = [];

for (const doc of membersSnap.docs) {
  const memberId = doc.data().user_id;
  if (memberId === user_id) continue;

  const tokenDoc = await db.collection("fcm_tokens").doc(memberId).get();
  if (tokenDoc.exists) {
    tokens.push(tokenDoc.data().token);
  }

  notificationWrites.push(
    db.collection("notifications").add({
      user_id: memberId,
      type: "new_message",
      message: "New message in your community",
      reference_id: community_id,
      is_read: false,
      created_at: new Date(),
    })
  );
}

// 🔥 Execute all writes in parallel
await Promise.all(notificationWrites);
