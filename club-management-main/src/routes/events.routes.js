const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { db } = require("../config/firebase");

const router = express.Router();

/**
 * REGISTER FOR EVENT
 * POST /events/:eventId/register
 */
router.post("/:eventId/register", verifyToken, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.uid;

    // 1️⃣ Check if event exists
    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    // 2️⃣ Check if already registered
    const existing = await db
      .collection("event_registrations")
      .where("event_id", "==", eventId)
      .where("user_id", "==", userId)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ error: "Already registered" });
    }

    // 3️⃣ Register user
    await db.collection("event_registrations").add({
      event_id: eventId,
      user_id: userId,
      registered_at: new Date(),
    });

    res.json({ message: "Successfully registered for event" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * LIST EVENT REGISTRATIONS
 * GET /events/:eventId/registrations
 */
router.get("/:eventId/registrations", verifyToken, async (req, res) => {
  try {
    const eventId = req.params.eventId;

    const snapshot = await db
      .collection("event_registrations")
      .where("event_id", "==", eventId)
      .get();

    const registrations = snapshot.docs.map(doc => ({
      registrationId: doc.id,
      ...doc.data(),
    }));

    res.json({ registrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CREATE EVENT
 * POST /events
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, date, club_id } = req.body;

    if (!title || !date || !club_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const eventRef = await db.collection("events").add({
      title,
      date,
      club_id,
      created_by: req.user.uid,
      created_at: new Date(),
    });

    res.status(201).json({
      message: "Event created",
      eventId: eventRef.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CANCEL EVENT REGISTRATION
 * DELETE /events/:eventId/registrations/:registrationId
 */
router.delete(
  "/:eventId/registrations/:registrationId",
  verifyToken,
  async (req, res) => {
    try {
      const { eventId, registrationId } = req.params;
      const userId = req.user.uid;

      const regRef = db.collection("event_registrations").doc(registrationId);
      const regSnap = await regRef.get();

      if (!regSnap.exists) {
        return res.status(404).json({ error: "Registration not found" });
      }

      // 🔐 Ensure user owns the registration
      if (regSnap.data().user_id !== userId) {
        return res.status(403).json({ error: "Not allowed" });
      }

      await regRef.delete();

      res.json({ message: "Registration cancelled successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);



module.exports = router;
