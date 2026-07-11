const { client } = require("../db");

// Runs on every request: if the session has a logged-in user id, load the
// (safe, no password_hash) user record onto req.user. Doesn't reject
// unauthenticated requests - that's requireAuth's job - so public routes
// can still optionally read req.user (e.g. "is this buyer logged in?").
async function attachUser(req, res, next) {
  if (req.session?.userId) {
    try {
      const result = await client.execute({
        sql: "SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?",
        args: [req.session.userId],
      });
      req.user = result.rows[0] || null;
      if (!req.user) req.session.userId = null; // stale session, user was deleted
    } catch (err) {
      return next(err);
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized for this action" });
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
