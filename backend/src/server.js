require("dotenv").config();

const path = require("node:path");
const express = require("express");
const session = require("express-session");

const SqliteSessionStore = require("./middleware/sessionStore");
const { attachUser, requireRole } = require("./middleware/auth");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// Render (and most PaaS hosts) terminate TLS at a proxy in front of us, so
// without this Express thinks every request is plain HTTP - breaking the
// "secure" cookie flag and the req.protocol used in password-reset emails.
if (isProduction) app.set("trust proxy", 1);

app.use(express.json());

app.use(
  session({
    name: "scentbysally.sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    store: new SqliteSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(attachUser);

app.use("/api/auth", authRoutes);

// Minimal namespaces just to prove role-gating works end to end; the real
// routes (products, orders, custom requests, etc.) land in later phases.
app.get("/api/admin/dashboard-check", requireRole("admin", "superadmin"), (req, res) => {
  res.json({ ok: true, role: req.user.role });
});
app.get("/api/superadmin/dashboard-check", requireRole("superadmin"), (req, res) => {
  res.json({ ok: true, role: req.user.role });
});

// Serve the existing static frontend, unchanged, from the same origin as
// the API - avoids CORS/token complexity entirely.
const frontendDir = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendDir));

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Scentbysally server running at http://localhost:${PORT}`);
});
