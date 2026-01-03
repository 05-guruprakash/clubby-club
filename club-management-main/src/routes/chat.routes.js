<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { db } = require("../config/firebase");
const { notifyUser } = require("../services/notification.service");

/**
 * SEND MESSAGE
 * POST /teams/:teamId/messages
 */
router.post("/:teamId/messages", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { message } = req.body;
    const userId = req.user.uid;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Check membership
    const memberSnap = await db
      .collection("team_members")
      .where("team_id", "==", teamId)
      .where("user_id", "==", userId)
      .get();

    if (memberSnap.empty) {
      return res.status(403).json({ error: "Not a team member" });
    }

    // Save message
    await db.collection("team_messages").add({
      team_id: teamId,
      user_id: userId,
      message,
      created_at: new Date(),
    });

    // Notify other members
    const membersSnap = await db
      .collection("team_members")
      .where("team_id", "==", teamId)
      .get();

    for (const doc of membersSnap.docs) {
      const memberId = doc.data().user_id;
      if (memberId !== userId) {
        await notifyUser(memberId, {
          type: "team_message",
          message: "New message in your team",
          reference_id: teamId,
        });
      }
    }

    res.json({ message: "Message sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET TEAM MESSAGES
 * GET /teams/:teamId/messages
 */
router.get("/:teamId/messages", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.uid;

    // Check membership
    const memberSnap = await db
      .collection("team_members")
      .where("team_id", "==", teamId)
      .where("user_id", "==", userId)
      .get();

    if (memberSnap.empty) {
      return res.status(403).json({ error: "Not a team member" });
    }

    const snapshot = await db
      .collection("team_messages")
      .where("team_id", "==", teamId)
      .orderBy("created_at", "asc")
      .limit(100)
      .get();

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
=======
// chat routes placeholder
const express = require("express");
const router = express.Router();
>>>>>>> 1b01de9af77f472fa0faf6670c6b250ee70ee80e

module.exports = router;
