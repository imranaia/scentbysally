const express = require("express");
const crypto = require("node:crypto");
const db = require("../db");
const { hashPassword, verifyPassword } = require("../utils/password");
const { requireAuth } = require("../middleware/auth");
const { sendEmail } = require("../services/email");

const router = express.Router();

const findByEmailStmt = db.prepare("SELECT * FROM users WHERE email = ?");
const insertUserStmt = db.prepare(
  "INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, 'buyer', ?)"
);
const findByIdStmt = db.prepare(
  "SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?"
);
const updatePasswordStmt = db.prepare(
  "UPDATE users SET password_hash = ? WHERE id = ?"
);
const insertTokenStmt = db.prepare(
  "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)"
);
const findTokenStmt = db.prepare(
  "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0"
);
const useTokenStmt = db.prepare(
  "UPDATE password_reset_tokens SET used = 1 WHERE id = ?"
);

function toSafeUser(row) {
  const { password_hash, ...safe } = row;
  return safe;
}

router.post("/register", (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (findByEmailStmt.get(email.toLowerCase())) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const info = insertUserStmt.run(
    name.trim(),
    email.toLowerCase().trim(),
    hashPassword(password),
    phone || null
  );

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start session" });
    req.session.userId = info.lastInsertRowid;
    res.status(201).json(toSafeUser(findByIdStmt.get(info.lastInsertRowid)));
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = findByEmailStmt.get(email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start session" });
    req.session.userId = user.id;
    res.json(toSafeUser(user));
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("scentbysally.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

router.post("/forgot-password", (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const user = findByEmailStmt.get(email.toLowerCase().trim());
  // Always respond 200 whether or not the account exists, so this endpoint
  // can't be used to discover which emails are registered.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    insertTokenStmt.run(user.id, token, expiresAt);

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password.html?token=${token}`;
    sendEmail({
      to: user.email,
      subject: "Reset your Scentbysally password",
      html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    });
  }

  res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
});

router.post("/reset-password", (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const row = findTokenStmt.get(token);
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired" });
  }

  updatePasswordStmt.run(hashPassword(newPassword), row.user_id);
  useTokenStmt.run(row.id);
  res.json({ ok: true });
});

module.exports = router;
