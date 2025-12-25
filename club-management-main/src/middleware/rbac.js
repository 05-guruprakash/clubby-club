// src/middleware/rbac.js
const { ROLE_PRIORITY } = require("../utils/roles");

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const clubId = req.params.clubId; // 🔥 SINGLE SOURCE OF TRUTH
      const userRoles = req.user.roles;

      if (!clubId) {
        return res.status(400).json({ error: "clubId missing in URL" });
      }

      if (!userRoles || !userRoles[clubId]) {
        return res.status(403).json({ error: "No role in this club" });
      }

      const userRole = userRoles[clubId];

      const userPriority = ROLE_PRIORITY[userRole];
      const requiredPriority = Math.min(
        ...allowedRoles.map(r => ROLE_PRIORITY[r])
      );

      if (userPriority < requiredPriority) {
        return res.status(403).json({ error: "Insufficient permission" });
      }

      next();
    } catch (err) {
      return res.status(500).json({ error: "Role check failed" });
    }
  };
};

module.exports = { requireRole };
