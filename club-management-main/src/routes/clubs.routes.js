const express = require("express");
const admin = require("firebase-admin");
const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { db } = require("../config/firebase");

const router = express.Router();

// User requests to join a club
router.post("/:id/join", verifyToken, async (req, res) => {
  const clubId = req.params.id;
  const userId = req.user.uid;

  // Check if already requested or member
  const existing = await db
    .collection("club_members")
    .where("club_id", "==", clubId)
    .where("user_id", "==", userId)
    .get();

  if (!existing.empty) {
    return res.status(400).json({ error: "Already requested or member" });
  }

  // Create join request
  await db.collection("club_members").add({
    club_id: clubId,
    user_id: userId,
    role: "member",
    status: "pending",
    joined_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  res.json({ message: "Join request submitted" });
});

// Chairman / Vice Chairman approves join request
router.post(
  "/:id/approve",
  verifyToken,
  requireRole(["chairman", "vice_chairman"]),
  async (req, res) => {
    try {
      const clubId = req.params.id;
      const { membershipId } = req.body;

      if (!membershipId) {
        return res.status(400).json({ error: "membershipId required" });
      }

      const memberRef = db.collection("club_members").doc(membershipId);
      const clubRef = db.collection("clubs").doc(clubId);
      const userRef = db.collection("users");

      await db.runTransaction(async (tx) => {
        const memberSnap = await tx.get(memberRef);
        if (!memberSnap.exists) throw new Error("Join request not found");

        const { user_id, status } = memberSnap.data();

        if (status !== "pending") {
          throw new Error("Request already processed");
        }

        // Approve membership
        tx.update(memberRef, {
          status: "approved",
          joined_at: new Date(),
          updated_at: new Date(),
        });

        // Add role to user document
        tx.update(userRef.doc(user_id), {
          [`roles.${clubId}`]: "member",
          updated_at: new Date(),
        });

        // Increment club member count
        tx.update(clubRef, {
          member_count: admin.firestore.FieldValue.increment(1),
          updated_at: new Date(),
        });
      });

      res.json({ message: "Member approved successfully" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Get pending join requests (Chairman / Vice Chairman only)
router.get(
  "/:id/requests",
  verifyToken,
  requireRole(["chairman", "vice_chairman"]),
  async (req, res) => {
    try {
      const clubId = req.params.id;

      const snapshot = await db
        .collection("club_members")
        .where("club_id", "==", clubId)
        .where("status", "==", "pending")
        .get();

      const requests = snapshot.docs.map(doc => ({
        membershipId: doc.id,
        ...doc.data(),
      }));

      res.json({ requests });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Chairman / Vice Chairman rejects join request
router.post(
  "/:id/reject",
  verifyToken,
  requireRole(["chairman", "vice_chairman"]),
  async (req, res) => {
    try {
      const clubId = req.params.id;
      const { membershipId } = req.body;

      if (!membershipId) {
        return res.status(400).json({ error: "membershipId required" });
      }

      const memberRef = db.collection("club_members").doc(membershipId);

      await db.runTransaction(async (tx) => {
        const memberSnap = await tx.get(memberRef);

        if (!memberSnap.exists) {
          throw new Error("Join request not found");
        }

        const memberData = memberSnap.data();

        // Ensure request belongs to this club
        if (memberData.club_id !== clubId) {
          throw new Error("Invalid club request");
        }

        // Only pending requests can be rejected
        if (memberData.status !== "pending") {
          throw new Error("Request already processed");
        }

        // Reject membership
        tx.update(memberRef, {
          status: "rejected",
          updated_at: new Date(),
        });
      });

      res.json({ message: "Member rejected successfully" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Chairman / Vice Chairman rejects join request
router.post(
  "/:id/reject",
  verifyToken,
  requireRole(["chairman", "vice_chairman"]),
  async (req, res) => {
    try {
      const { membershipId } = req.body;

      if (!membershipId) {
        return res.status(400).json({ error: "membershipId required" });
      }

      const memberRef = db.collection("club_members").doc(membershipId);
      const memberSnap = await memberRef.get();

      if (!memberSnap.exists) {
        return res.status(404).json({ error: "Join request not found" });
      }

      if (memberSnap.data().status !== "pending") {
        return res.status(400).json({ error: "Request already processed" });
      }

      await memberRef.update({
        status: "rejected",
        updated_at: new Date(),
      });

      res.json({ message: "Member rejected successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Chairman removes an approved member
router.post(
  "/:id/remove",
  verifyToken,
  requireRole(["chairman", "vice_chairman"]),
  async (req, res) => {
    try {
      const clubId = req.params.id;
      const { membershipId } = req.body;

      if (!membershipId) {
        return res.status(400).json({ error: "membershipId required" });
      }

      const memberRef = db.collection("club_members").doc(membershipId);
      const clubRef = db.collection("clubs").doc(clubId);

      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) {
        return res.status(404).json({ error: "Member not found" });
      }

      if (memberSnap.data().status !== "approved") {
        return res.status(400).json({ error: "User is not an active member" });
      }

      await db.runTransaction(async (tx) => {
        tx.delete(memberRef);

        tx.update(clubRef, {
          member_count: admin.firestore.FieldValue.increment(-1),
          updated_at: new Date(),
        });
      });

      res.json({ message: "Member removed successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


module.exports = router;
