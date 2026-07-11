require("dotenv").config();

const { migrate } = require("./db");
const { ensureSuperadminSeeded } = require("./seedSuperadmin");

async function main() {
  if (!process.env.SEED_SUPERADMIN_EMAIL || !process.env.SEED_SUPERADMIN_PASSWORD) {
    console.error(
      "Set SEED_SUPERADMIN_NAME, SEED_SUPERADMIN_EMAIL, and SEED_SUPERADMIN_PASSWORD in backend/.env before seeding."
    );
    process.exit(1);
  }

  await migrate();
  const result = await ensureSuperadminSeeded();

  if (result.created) {
    console.log(`Created superadmin "${result.name}" <${result.email}> (id=${result.id}).`);
  } else {
    console.log(`Superadmin already exists (id=${result.id}) - nothing to do.`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
