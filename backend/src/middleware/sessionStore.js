const session = require("express-session");
const db = require("../db");

// Minimal SQLite-backed express-session store using node:sqlite, so we don't
// need a native module (connect-sqlite3) just to persist sessions.
class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare("SELECT sess, expires FROM sessions WHERE sid = ?");
    this.setStmt = db.prepare(
      "INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) " +
        "ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires"
    );
    this.destroyStmt = db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.pruneStmt = db.prepare("DELETE FROM sessions WHERE expires < ?");
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row || row.expires < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      this.setStmt.run(sid, JSON.stringify(sessionData), expires);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.destroyStmt.run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }

  prune() {
    this.pruneStmt.run(Date.now());
  }
}

module.exports = SqliteSessionStore;
