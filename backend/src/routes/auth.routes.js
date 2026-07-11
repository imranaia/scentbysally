const express = require("express");
const crypto = require("node:crypto");
const { client } = require("../db");
const { hashPassword, verifyPassword } = require("../utils/password");
const { requireAuth } = require("../middleware/auth");
const { sendEmail } = require("../services/email");

const router = express.Router();

function toSafeUser(row) {
  const { password_hash, ...safe } = row;
  return safe;
}

async function findUserByEmail(email) {
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email],
  });
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await client.execute({
    sql: "SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?",
    args: [id],
  });
  return result.rows[0] || null;
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (await findUserByEmail(email.toLowerCase())) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const insertResult = await client.execute({
      sql: "INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, 'buyer', ?)",
      args: [name.trim(), email.toLowerCase().trim(), hashPassword(password), phone || null],
    });
    // @libsql/client always returns lastInsertRowid as a BigInt regardless of
    // intMode (that only affects row values) - convert it or it'll silently
    // break JSON.stringify (session serialization, res.json, etc.) later.
    const newUserId = Number(insertResult.lastInsertRowid);

    req.session.regenerate(async (err) => {
      if (err) return res.status(500).json({ error: "Could not start session" });
      req.session.userId = newUserId;
      res.status(201).json(toSafeUser(await findUserById(newUserId)));
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await findUserByEmail(email.toLowerCase().trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Could not start session" });
      req.session.userId = user.id;
      res.json(toSafeUser(user));
    });
  } catch (err) {
    next(err);
  }
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

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await findUserByEmail(email.toLowerCase().trim());
    // Always respond 200 whether or not the account exists, so this endpoint
    // can't be used to discover which emails are registered.
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      await client.execute({
        sql: "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        args: [user.id, token, expiresAt],
      });

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password.html?token=${token}`;
      sendEmail({
        to: user.email,
        subject: "Reset your Scentbysally password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      });
    }

    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const tokenResult = await client.execute({
      sql: "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0",
      args: [token],
    });
    const row = tokenResult.rows[0];
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "This reset link is invalid or has expired" });
    }

    await client.execute({
      sql: "UPDATE users SET password_hash = ? WHERE id = ?",
      args: [hashPassword(newPassword), row.user_id],
    });
    await client.execute({
      sql: "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
      args: [row.id],
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
