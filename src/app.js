const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Global middlewares
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.get("/setup-admin", async (req, res) => {
  try {
    const { auth, db } = require("./config/firebase");
    const targetEmail = "super@nexus.com";

    // Try Auth first
    let user = await auth.getUserByEmail(targetEmail).catch(() => null);

    // If not in Auth, try Firestore search
    if (!user) {
      const userSnap = await db.collection("users").where("officialMail", "==", targetEmail).get();
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        user = { uid: userSnap.docs[0].id, email: userData.officialMail };
      }
    }

    if (!user) {
      // Just take the FIRST user in the system if super@nexus.com doesn't exist?
      // Or better, search for any user with "super" in email
      const allUsers = await db.collection("users").limit(10).get();
      const emails = allUsers.docs.map(d => d.data().officialMail || d.data().email || d.id).join(", ");
      return res.status(404).send(`User ${targetEmail} not found. Available users: ${emails}`);
    }

    const clubsSnap = await db.collection("clubs").where("name", "==", "Coding Club").get();
    if (clubsSnap.empty) return res.status(404).send("Coding Club not found");

    const clubId = clubsSnap.docs[0].id;
    const uid = user.uid;

    await db.doc(`clubs/${clubId}/members/${uid}`).set({
      userId: uid,
      role: "chairman",
      status: "active",
      joined_at: new Date()
    });

    await db.collection("users").doc(uid).update({
      joined_clubs: require("firebase-admin").firestore.FieldValue.arrayUnion(clubId),
      [`roles.${clubId}`]: "chairman"
    });

    res.send(`Success: ${user.email} (UID: ${uid}) is now chairman of Coding Club (${clubId})`);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Auth middleware
const { verifyToken } = require("./middleware/auth");

// Protected test route
app.get("/protected", verifyToken, (req, res) => {
  res.json({
    message: "You are authenticated",
    user: req.user,
  });
});

// 🔥 IMPORT ROUTES
const clubRoutes = require("./routes/clubs.routes");

// 🔥 MOUNT ROUTES
app.use("/clubs", clubRoutes);

const eventRoutes = require("./routes/events.routes");
app.use("/events", eventRoutes);

const postRoutes = require("./routes/posts.routes");
app.use("/posts", postRoutes);

const teamRoutes = require("./routes/teams.routes");
app.use("/teams", teamRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("🏁 GLOBAL ERROR:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

module.exports = app;
