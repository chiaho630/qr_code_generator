const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'qr_codes.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS url_mappings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT    UNIQUE NOT NULL,
    original_url TEXT  NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scan_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL,
    scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_agent TEXT,
    ip_address TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_url_token      ON url_mappings(token);
  CREATE INDEX IF NOT EXISTS idx_token_scanned  ON scan_events(token, scanned_at);
`);

module.exports = db;
