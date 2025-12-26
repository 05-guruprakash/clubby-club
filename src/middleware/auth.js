const { auth, db } = require("../config/firebase");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await auth.verifyIdToken(token);

    const uid = decoded.uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // 🔥 AUTO CREATE USER PROFILE
    if (!userSnap.exists) {
      await userRef.set({
        full_name: decoded.name || "New User",
        roles: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    const finalSnap = await userRef.get();

    req.user = {
      uid,
      ...finalSnap.data(),
    };

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};

module.exports = { verifyToken };
