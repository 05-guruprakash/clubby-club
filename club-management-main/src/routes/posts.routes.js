const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { db } = require("../config/firebase");

/**
 * CREATE POST
 * POST /posts
 */
// CREATE POST
router.post(
  "/:clubId",
  verifyToken,
  requireRole(["admin", "chairman"]),
  async (req, res) => {
    const { title, content } = req.body;
    const { clubId } = req.params;

    if (!title || !content) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const postRef = await db.collection("posts").add({
      title,
      content,
      club_id: clubId,
      created_by: req.user.uid,
      created_at: new Date(),
    });

    res.json({ message: "Post created", postId: postRef.id });
  }
);

// GET /clubs/:clubId/posts
// GET posts by club
router.get("/", verifyToken, async (req, res) => {
  try {
    const { club_id } = req.query;

    if (!club_id) {
      return res.status(400).json({ error: "club_id is required" });
    }

    const snapshot = await db
      .collection("posts")
      .where("club_id", "==", club_id)
      .orderBy("created_at", "desc")
      .get();

    const posts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET SINGLE POST
 * GET /posts/:clubId/:postId
 */
router.get("/:clubId/:postId", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const postRef = db.collection("posts").doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({
      id: postSnap.id,
      ...postSnap.data(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * UPDATE POST
 * PUT /clubs/:clubId/posts/:postId
 */
// DEBUG MIDDLEWARE
router.put("/:clubId/:postId", (req, res, next) => {
  console.log("HIT UPDATE POST", req.params);
  next();
});

// UPDATE POST
router.put(
  "/:clubId/:postId",
  verifyToken,
  requireRole(["admin", "chairman"]),
  async (req, res) => {
    try {
      const { clubId, postId } = req.params;
      const { title, content } = req.body;

      // Check if post exists
      const postRef = db.collection("posts").doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return res.status(404).json({ error: "Post not found" });
      }

      await postRef.update({
        title,
        content,
        updated_at: new Date(),
      });

      res.json({ message: "Post updated" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
// DELETE /posts/:clubId/:postId
router.delete(
  "/:clubId/:postId",
  verifyToken,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const { postId } = req.params;

      const postRef = db.collection("posts").doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (postSnap.data().created_by !== req.user.uid) {
        return res.status(403).json({ error: "Not post owner" });
      }

      await postRef.delete();

      res.json({ message: "Post deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
