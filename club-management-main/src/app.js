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

<<<<<<< HEAD
const notificationRoutes = require("./routes/notifications.routes");
app.use("/notifications", notificationRoutes);

const teamRoutes = require("./routes/teams.routes");
app.use("/teams", teamRoutes);

const teamChatRoutes = require("./routes/chat.routes");
app.use("/teams", teamChatRoutes);


=======
>>>>>>> 1b01de9af77f472fa0faf6670c6b250ee70ee80e
module.exports = app;
