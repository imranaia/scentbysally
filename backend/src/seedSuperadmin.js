const { client } = require("./db");
const { hashPassword } = require("./utils/password");

// Shared by the standalone `npm run seed` script and server.js's own startup
// (for hosts with no Shell access, e.g. Render's Free plan, where a one-off
// command can't be run after deploy). Safe to call on every boot: no-ops
// quietly if the env vars aren't set, or if the account already exists.
async function ensureSuperadminSeeded() {
  const {
    SEED_SUPERADMIN_NAME,
    SEED_SUPERADMIN_EMAIL,
    SEED_SUPERADMIN_PASSWORD,
  } = process.env;

  if (!SEED_SUPERADMIN_EMAIL || !SEED_SUPERADMIN_PASSWORD) {
    return { created: false, reason: "not-configured" };
  }

  const email = SEED_SUPERADMIN_EMAIL.toLowerCase().trim();
  const existingResult = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });

  if (existingResult.rows[0]) {
    return { created: false, reason: "already-exists", id: existingResult.rows[0].id };
  }

  const insertResult = await client.execute({
    sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'superadmin')",
    args: [SEED_SUPERADMIN_NAME || "Sally", email, hashPassword(SEED_SUPERADMIN_PASSWORD)],
  });

  return { created: true, id: Number(insertResult.lastInsertRowid), email, name: SEED_SUPERADMIN_NAME || "Sally" };
}

module.exports = { ensureSuperadminSeeded };
