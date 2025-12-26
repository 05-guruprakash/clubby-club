const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { db } = require("../config/firebase");

const router = express.Router();

// Delete Team (Leader Only)
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const teamId = req.params.id;
        const userId = req.user.uid;

        const teamRef = db.collection("teams").doc(teamId);
        const teamSnap = await teamRef.get();

        if (!teamSnap.exists) {
            return res.status(404).json({ error: "Team not found" });
        }

        const teamData = teamSnap.data();
        if (teamData.leaderId !== userId) {
            return res.status(403).json({ error: "Unauthorized: Only the leader can delete the team" });
        }

        const batch = db.batch();

        // 1. Delete Team Doc
        batch.delete(teamRef);

        // 2. Delete associated Team Member requests/entries
        const reqsSnap = await db.collection("team_members").where("teamId", "==", teamId).get();
        reqsSnap.forEach(doc => batch.delete(doc.ref));

        // 3. Delete associated chat messages
        const msgsSnap = await db.collection("community_messages").where("communityId", "==", teamId).get();
        msgsSnap.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        res.json({ message: "Team and all its data deleted successfully" });
    } catch (err) {
        console.error("DELETE TEAM ERROR:", err);
        res.status(500).json({ error: "Failed to delete team" });
    }
});

// Diagnostic probe
router.get("/ping", (req, res) => {
    res.json({ pong: true, message: "Teams backend is alive" });
});

// JSON 404 handler for this router
router.use((req, res) => {
    res.status(404).json({ error: `Not Found: ${req.method} ${req.originalUrl}` });
});

module.exports = router;
