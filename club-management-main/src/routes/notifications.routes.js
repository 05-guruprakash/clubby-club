const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { db } = require("../config/firebase");

/**
 * GET USER NOTIFICATIONS
 * GET /notifications
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const snapshot = await db
      .collection("notifications")
      .where("user_id", "==", req.user.uid)
      .orderBy("created_at", "desc")
      .limit(20)
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * MARK SINGLE NOTIFICATION AS READ
 * PATCH /notifications/:id/read
 */
router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const notifRef = db.collection("notifications").doc(req.params.id);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notifSnap.data().user_id !== req.user.uid) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await notifRef.update({
      is_read: true,
      updated_at: new Date(),
    });

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * MARK ALL AS READ
 * PATCH /notifications/read-all
 */
router.patch("/read-all", verifyToken, async (req, res) => {
  try {
    const snapshot = await db
      .collection("notifications")
      .where("user_id", "==", req.user.uid)
      .where("is_read", "==", false)
      .get();

    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        is_read: true,
        updated_at: new Date(),
      });
    });

    await batch.commit();

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MARK SINGLE NOTIFICATION AS READ
router.put("/:id/read", verifyToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const ref = db.collection("notifications").doc(notificationId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Ownership check
    if (snap.data().user_id !== req.user.uid) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await ref.update({
      is_read: true,
    });

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE NOTIFICATION
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const ref = db.collection("notifications").doc(notificationId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Ownership check
    if (snap.data().user_id !== req.user.uid) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await ref.delete();

    res.json({ message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
