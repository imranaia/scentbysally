const session = require("express-session");
const { client } = require("../db");

// Minimal SQLite-backed express-session store on top of our own db.js, so we
// don't need a separate package (connect-sqlite3) just to persist sessions.
// express-session's Store interface is callback-based, but @libsql/client is
// promise-based, so each method awaits internally and calls back with the
// resolved/rejected result.
class SqliteSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const result = await client.execute({
        sql: "SELECT sess, expires FROM sessions WHERE sid = ?",
        args: [sid],
      });
      const row = result.rows[0];
      if (!row || row.expires < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      await client.execute({
        sql:
          "INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) " +
          "ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires",
        args: [sid, JSON.stringify(sessionData), expires],
      });
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await client.execute({ sql: "DELETE FROM sessions WHERE sid = ?", args: [sid] });
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }

  async prune() {
    await client.execute({ sql: "DELETE FROM sessions WHERE expires < ?", args: [Date.now()] });
  }
}

module.exports = SqliteSessionStore;
