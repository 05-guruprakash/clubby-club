<<<<<<< HEAD
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
    const { event_id, team_name, max_members } = req.body;

    if (!event_id || !team_name || !max_members) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const teamRef = await db.collection("teams").add({
    event_id,
    team_name,
    leader_id: req.user.uid,
    members: [req.user.uid], // ✅ ADD THIS
    max_members,
    current_members: 1,
    is_full: false,
    created_at: new Date(),
    });


    // Add leader to team_members
    await db.collection("team_members").add({
      team_id: teamRef.id,
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

      // ❌ Full team
      if (team.is_full) {
        throw new Error("Team is already full");
      }

      // ❌ Already member
      if (team.members.includes(userId)) {
        throw new Error("Already in team");
      }

      // ✅ Add member
      tx.update(teamRef, {
        members: admin.firestore.FieldValue.arrayUnion(userId),
        current_members: admin.firestore.FieldValue.increment(1),
      });

      // Track membership
      await db.collection("team_members").add({
        team_id: teamId,
        user_id: userId,
        role: "member",
        joined_at: new Date(),
      });

      // Lock team if full
      if (team.current_members + 1 >= team.max_members) {
        tx.update(teamRef, { is_full: true });
      }
    });

    // 🔔 Notifications AFTER transaction
    const updatedTeam = await teamRef.get();
    const teamData = updatedTeam.data();

    await notifyUser(teamData.leader_id, {
      type: "team_join",
      message: "A new member joined your team",
      reference_id: teamId,
    });

    if (teamData.is_full) {
      await notifyUser(teamData.leader_id, {
        type: "team_full",
        message: "Your team is now full",
        reference_id: teamId,
      });
    }
    await db
    .collection("team_members")
    .where("team_id", "==", teamId)
    .where("user_id", "==", userId)
    .get()
    .then(snap => snap.forEach(doc => doc.ref.delete()));

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

    if (!team.members.includes(userId)) {
      return res.status(400).json({ error: "Not in team" });
    }

    if (team.leader_id === userId) {
      return res.status(400).json({ error: "Leader cannot leave team" });
    }

    await teamRef.update({
      members: admin.firestore.FieldValue.arrayRemove(userId),
      current_members: admin.firestore.FieldValue.increment(-1),
      is_full: false,
    });

    await notifyUser(team.leader_id, {
    type: "team_leave",
    message: "A member left your team",
    reference_id: teamId,
    });

    res.json({ message: "Left team successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: "event_id required" });
    }

    const snap = await db
      .collection("teams")
      .where("event_id", "==", event_id)
      .get();

    const teams = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:teamId/members", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;

    const snap = await db
      .collection("team_members")
      .where("team_id", "==", teamId)
      .get();

    const members = snap.docs.map(doc => doc.data());
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
=======
// teams routes placeholder
const express = require("express");
const router = express.Router();
>>>>>>> 1b01de9af77f472fa0faf6670c6b250ee70ee80e

module.exports = router;
