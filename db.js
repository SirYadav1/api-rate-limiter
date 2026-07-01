const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

function initDB(dbPath) {
    const db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            key TEXT NOT NULL,
            service TEXT,
            category TEXT DEFAULT 'Custom',
            color TEXT DEFAULT '#6c5ce7',
            rate_limit INTEGER DEFAULT 60,
            used INTEGER DEFAULT 0,
            window INTEGER DEFAULT 60,
            notes TEXT DEFAULT '',
            folder TEXT DEFAULT 'Default',
            expiry_date TEXT,
            custom_warning_threshold INTEGER DEFAULT 80,
            is_active INTEGER DEFAULT 1,
            cooldown_until INTEGER,
            history TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS request_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id TEXT,
            service TEXT NOT NULL,
            status TEXT NOT NULL,
            response_time INTEGER,
            timestamp INTEGER DEFAULT (unixepoch() * 1000),
            FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id TEXT,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp INTEGER DEFAULT (unixepoch() * 1000),
            read INTEGER DEFAULT 0,
            FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS usage_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_used INTEGER DEFAULT 0,
            total_keys INTEGER DEFAULT 0,
            timestamp INTEGER DEFAULT (unixepoch() * 1000)
        );

        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            color TEXT DEFAULT '#6c5ce7',
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Insert default folder if empty
    const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders').get();
    if (folderCount.count === 0) {
        db.prepare('INSERT INTO folders (name, color) VALUES (?, ?)').run('Default', '#6c5ce7');
    }

    return db;
}

module.exports = { initDB };
