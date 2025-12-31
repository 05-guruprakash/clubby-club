const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { db } = require("../config/firebase");
const admin = require("firebase-admin");
const { notifyUser } = require("../services/notification.service");


/**
 * CREATE TEAM
 * POST /teams
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { event_id, eventId, team_name, max_members } = req.body;
    const finalEventId = eventId || event_id;

    if (!finalEventId || !team_name || !max_members) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const teamRef = await db.collection("teams").add({
      eventId: finalEventId,
      event_id: finalEventId, // Keep both for safety
      team_name,
      leaderId: req.user.uid,
      leader_id: req.user.uid, // Keep both for safety
      members: [req.user.uid],
      max_members,
      current_members: 1,
      is_full: false,
      created_at: new Date(),
    });


    // Add leader to team_members
    await db.collection("team_members").add({
      teamId: teamRef.id,
      team_id: teamRef.id,
      userId: req.user.uid,
      user_id: req.user.uid,
      role: "leader",
      joined_at: new Date(),
    });

    res.json({
      message: "Team created successfully",
      teamId: teamRef.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * JOIN TEAM
 * POST /teams/:teamId/join
 */
router.post("/:teamId/join", verifyToken, async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.uid;
  const teamRef = db.collection("teams").doc(teamId);

  try {
    await db.runTransaction(async (tx) => {
      const teamSnap = await tx.get(teamRef);

      if (!teamSnap.exists) {
        throw new Error("Team not found");
      }

      const team = teamSnap.data();

      // Full team
      if (team.is_full) {
        throw new Error("Team is already full");
      }

      // Already member
      const members = team.members || [];
      if (members.includes(userId)) {
        throw new Error("Already in team");
      }

      // Add member
      tx.update(teamRef, {
        members: admin.firestore.FieldValue.arrayUnion(userId),
        current_members: admin.firestore.FieldValue.increment(1),
      });

      // Track membership
      tx.set(db.collection("team_members").doc(), {
        teamId: teamId,
        team_id: teamId,
        userId: userId,
        user_id: userId,
        role: "member",
        joined_at: new Date(),
        status: 'accepted'
      });

      // Lock team if full
      if (team.current_members + 1 >= team.max_members) {
        tx.update(teamRef, { is_full: true });
      }
    });

    // Notifications AFTER transaction
    const updatedTeam = await teamRef.get();
    const teamData = updatedTeam.data();
    const leaderId = teamData.leaderId || teamData.leader_id;

    if (leaderId) {
      await notifyUser(leaderId, {
        type: "team_join",
        message: "A new member joined your team",
        reference_id: teamId,
      });

      if (teamData.is_full) {
        await notifyUser(leaderId, {
          type: "team_full",
          message: "Your team is now full",
          reference_id: teamId,
        });
      }
    }

    res.json({ message: "Joined team successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.post("/:teamId/leave", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.uid;

    const teamRef = db.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return res.status(404).json({ error: "Team not found" });
    }

    const team = teamSnap.data();
    const members = team.members || [];
    const leaderId = team.leaderId || team.leader_id;

    if (!members.includes(userId)) {
      return res.status(400).json({ error: "Not in team" });
    }

    if (leaderId === userId) {
      return res.status(400).json({ error: "Leader cannot leave team" });
    }

    await teamRef.update({
      members: admin.firestore.FieldValue.arrayRemove(userId),
      current_members: admin.firestore.FieldValue.increment(-1),
      is_full: false,
    });

    // Remove from team_members collection
    const membersSnap = await db
      .collection("team_members")
      .where("teamId", "==", teamId)
      .where("userId", "==", userId)
      .get();

    // Also check for snake_case for completeness
    const membersSnap2 = await db
      .collection("team_members")
      .where("team_id", "==", teamId)
      .where("user_id", "==", userId)
      .get();

    const batch = db.batch();
    membersSnap.forEach(doc => batch.delete(doc.ref));
    membersSnap2.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    if (leaderId) {
      await notifyUser(leaderId, {
        type: "team_leave",
        message: "A member left your team",
        reference_id: teamId,
      });
    }

    res.json({ message: "Left team successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const { event_id, eventId } = req.query;
    const finalEventId = eventId || event_id;

    if (!finalEventId) {
      return res.status(400).json({ error: "eventId required" });
    }

    const snap = await db
      .collection("teams")
      .where("eventId", "==", finalEventId)
      .get();

    // If empty, try snake_case
    let docs = snap.docs;
    if (docs.length === 0) {
      const snap2 = await db
        .collection("teams")
        .where("event_id", "==", finalEventId)
        .get();
      docs = snap2.docs;
    }

    const teams = docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
