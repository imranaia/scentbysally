const path = require("node:path");
const fs = require("node:fs");
const { createClient } = require("@libsql/client");

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, DATA_DIR } = process.env;

let url;
let authToken;

if (TURSO_DATABASE_URL) {
  // Production: a real hosted database (Turso's free tier), so the data
  // survives even on a host with no persistent disk (e.g. Render Free).
  url = TURSO_DATABASE_URL;
  authToken = TURSO_AUTH_TOKEN;
} else {
  // Local dev: an embedded SQLite file on disk, no Turso account needed.
  const dataDir = DATA_DIR || path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  url = `file:${path.join(dataDir, "scentbysally.db")}`;
}

// intMode: "number" so INTEGER columns (ids, timestamps) come back as plain
// JS numbers - our ids are always small, and BigInt would break JSON.stringify.
const client = createClient({ url, authToken, intMode: "number" });

// Full schema for the whole planned build (see plan) - only users/
// admin_permissions are actively used by the API in Phase 0/1, the rest is
// created now so later phases are pure route/logic work, not migrations.
async function migrate() {
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('buyer','admin','superadmin')),
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_permissions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      inventory INTEGER NOT NULL DEFAULT 0,
      orders INTEGER NOT NULL DEFAULT 0,
      customers INTEGER NOT NULL DEFAULT 0,
      products INTEGER NOT NULL DEFAULT 0,
      boxes INTEGER NOT NULL DEFAULT 0,
      custom_order_pricing INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS category_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      multiplier REAL NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      base_price REAL NOT NULL,
      description TEXT,
      scent_notes TEXT,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_label TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS boxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      piece_count INTEGER NOT NULL,
      discount_type TEXT CHECK (discount_type IN ('percentage','fixed')),
      discount_value REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))
    );

    CREATE TABLE IF NOT EXISTS box_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      box_id INTEGER NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      size_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_box_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','priced','accepted','declined','paid')),
      price REAL,
      priced_by INTEGER REFERENCES users(id),
      priced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_box_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES custom_box_requests(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      size_label TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT,
      full_name TEXT NOT NULL,
      phone TEXT,
      street TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard','custom_box')),
      custom_request_id INTEGER REFERENCES custom_box_requests(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
      delivery_method TEXT NOT NULL DEFAULT 'delivery' CHECK (delivery_method IN ('delivery','pickup')),
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL DEFAULT 0,
      commission REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_ref TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed')),
      address_id INTEGER REFERENCES addresses(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      box_id INTEGER REFERENCES boxes(id),
      size_label TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL
    );

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title TEXT,
      content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      size_label TEXT NOT NULL,
      change INTEGER NOT NULL,
      reason TEXT,
      changed_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
  `);
}

module.exports = { client, migrate };
