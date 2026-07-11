require("dotenv").config();

const db = require("./db");
const { hashPassword } = require("./utils/password");

const {
  SEED_SUPERADMIN_NAME,
  SEED_SUPERADMIN_EMAIL,
  SEED_SUPERADMIN_PASSWORD,
} = process.env;

if (!SEED_SUPERADMIN_EMAIL || !SEED_SUPERADMIN_PASSWORD) {
  console.error(
    "Set SEED_SUPERADMIN_NAME, SEED_SUPERADMIN_EMAIL, and SEED_SUPERADMIN_PASSWORD in backend/.env before seeding."
  );
  process.exit(1);
}

const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(SEED_SUPERADMIN_EMAIL.toLowerCase().trim());

if (existing) {
  console.log(`Superadmin ${SEED_SUPERADMIN_EMAIL} already exists (id=${existing.id}) - nothing to do.`);
  process.exit(0);
}

const info = db
  .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'superadmin')")
  .run(
    SEED_SUPERADMIN_NAME || "Sally",
    SEED_SUPERADMIN_EMAIL.toLowerCase().trim(),
    hashPassword(SEED_SUPERADMIN_PASSWORD)
  );

console.log(`Created superadmin "${SEED_SUPERADMIN_NAME || "Sally"}" <${SEED_SUPERADMIN_EMAIL}> (id=${info.lastInsertRowid}).`);
