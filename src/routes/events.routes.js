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
 * CREATE OFFICIAL EVENT (Admin Only)
 * POST /events/official
 */
router.post("/official", verifyToken, async (req, res) => {
  try {
    const { title, description, date, time, venue, maxTeamMembers } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: "Title and Date are required" });
    }

    // 1. Create Event
    const eventData = {
      title,
      description: description || "",
      date,
      time: time || "",
      venue: venue || "",
      maxTeamMembers: parseInt(maxTeamMembers) || 3,
      status: 'upcoming',
      created_by: req.user.uid,
      timestamp: new Date().toISOString()
    };

    console.log("Admin Event Creation Request:", { title, date });
    const eventRef = await db.collection("events").add(eventData);
    console.log("1. Document created in 'events':", eventRef.id);

    // 2. Add to Feed (Posts)
    const postRef = await db.collection("posts").add({
      content: `New Event: ${title} has been scheduled for ${date} at ${time}. Venue: ${venue}. Check the Discover tab to register!`,
      authorName: 'Official',
      authorRole: 'admin',
      type: 'event',
      communityName: 'Official Announcements',
      timestamp: new Date().toISOString()
    });
    console.log("2. Feed post created:", postRef.id);

    // 3. Global Notification
    const notifRef = await db.collection("notifications").add({
      message: `📢 Official: New Event "${title}" is now open for registration!`,
      read: false,
      timestamp: new Date().toISOString()
    });
    console.log("3. Notification sent:", notifRef.id);

    res.status(201).json({
      message: "Official event created successfully",
      eventId: eventRef.id,
    });
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * CREATE EVENT (Legacy/Basic)
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
