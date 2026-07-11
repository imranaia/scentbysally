require("dotenv").config();

const { client, migrate } = require("./db");
const { hashPassword } = require("./utils/password");

const {
  SEED_SUPERADMIN_NAME,
  SEED_SUPERADMIN_EMAIL,
  SEED_SUPERADMIN_PASSWORD,
} = process.env;

async function main() {
  if (!SEED_SUPERADMIN_EMAIL || !SEED_SUPERADMIN_PASSWORD) {
    console.error(
      "Set SEED_SUPERADMIN_NAME, SEED_SUPERADMIN_EMAIL, and SEED_SUPERADMIN_PASSWORD in backend/.env before seeding."
    );
    process.exit(1);
  }

  await migrate();

  const email = SEED_SUPERADMIN_EMAIL.toLowerCase().trim();
  const existingResult = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });
  const existing = existingResult.rows[0];

  if (existing) {
    console.log(`Superadmin ${SEED_SUPERADMIN_EMAIL} already exists (id=${existing.id}) - nothing to do.`);
    return;
  }

  const insertResult = await client.execute({
    sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'superadmin')",
    args: [SEED_SUPERADMIN_NAME || "Sally", email, hashPassword(SEED_SUPERADMIN_PASSWORD)],
  });

  console.log(
    `Created superadmin "${SEED_SUPERADMIN_NAME || "Sally"}" <${SEED_SUPERADMIN_EMAIL}> (id=${Number(insertResult.lastInsertRowid)}).`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  });
