const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// GET all keys
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { folder, category, search, sort } = req.query;

    let query = 'SELECT * FROM api_keys WHERE 1=1';
    const params = [];

    if (folder) {
        query += ' AND folder = ?';
        params.push(folder);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND (name LIKE ? OR service LIKE ? OR notes LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (sort === 'name') query += ' ORDER BY name ASC';
    else if (sort === 'usage') query += ' ORDER BY used DESC';
    else if (sort === 'limit') query += ' ORDER BY rate_limit DESC';
    else query += ' ORDER BY created_at DESC';

    const keys = db.prepare(query).all(...params);
    // Parse history JSON
    keys.forEach(k => {
        try { k.history = JSON.parse(k.history); } catch { k.history = []; }
    });
    res.json(keys);
});

// GET single key
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });
    try { key.history = JSON.parse(key.history); } catch { key.history = []; }
    res.json(key);
});

// POST create key
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const broadcast = req.app.locals.broadcast;
    const { name, key, service, category, color, rate_limit, window, notes, folder, expiry_date, custom_warning_threshold } = req.body;

    if (!name || !key) return res.status(400).json({ error: 'Name and key are required' });

    const id = uuidv4();
    const stmt = db.prepare(`
        INSERT INTO api_keys (id, name, key, service, category, color, rate_limit, window, notes, folder, expiry_date, custom_warning_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, key, service || name, category || 'Custom', color || '#6c5ce7', rate_limit || 60, window || 60, notes || '', folder || 'Default', expiry_date || null, custom_warning_threshold || 80);

    const newKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    try { newKey.history = JSON.parse(newKey.history); } catch { newKey.history = []; }

    broadcast('key:created', newKey);
    res.status(201).json(newKey);
});

// PUT update key
router.put('/:id', (req, res) => {
    const db = req.app.locals.db;
    const broadcast = req.app.locals.broadcast;
    const { name, key, service, category, color, rate_limit, window, notes, folder, expiry_date, custom_warning_threshold, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Key not found' });

    const stmt = db.prepare(`
        UPDATE api_keys SET
            name = COALESCE(?, name),
            key = COALESCE(?, key),
            service = COALESCE(?, service),
            category = COALESCE(?, category),
            color = COALESCE(?, color),
            rate_limit = COALESCE(?, rate_limit),
            window = COALESCE(?, window),
            notes = COALESCE(?, notes),
            folder = COALESCE(?, folder),
            expiry_date = COALESCE(?, expiry_date),
            custom_warning_threshold = COALESCE(?, custom_warning_threshold),
            is_active = COALESCE(?, is_active),
            updated_at = datetime('now')
        WHERE id = ?
    `);

    stmt.run(name, key, service, category, color, rate_limit, window, notes, folder, expiry_date, custom_warning_threshold, is_active, req.params.id);

    const updated = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    try { updated.history = JSON.parse(updated.history); } catch { updated.history = []; }

    broadcast('key:updated', updated);
    res.json(updated);
});

// POST simulate request
router.post('/:id/simulate', (req, res) => {
    const db = req.app.locals.db;
    const broadcast = req.app.locals.broadcast;
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);

    if (!key) return res.status(404).json({ error: 'Key not found' });

    const responseTime = Math.floor(Math.random() * 500) + 50;
    let status = 'OK';
    const pct = ((key.used + 1) / key.rate_limit) * 100;

    if (pct > 100) status = 'BLOCKED';
    else if (pct >= key.custom_warning_threshold) status = 'WARN';

    key.used += 1;
    const history = JSON.parse(key.history || '[]');
    history.push({ time: Date.now(), used: key.used });
    if (history.length > 100) history.splice(0, history.length - 100);

    // Update cooldown if blocked
    if (status === 'BLOCKED' && !key.cooldown_until) {
        key.cooldown_until = Date.now() + key.window * 1000;
    }

    db.prepare(`
        UPDATE api_keys SET used = ?, history = ?, cooldown_until = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(key.used, JSON.stringify(history), key.cooldown_until, key.id);

    // Log request
    db.prepare('INSERT INTO request_logs (key_id, service, status, response_time) VALUES (?, ?, ?, ?)').run(key.id, key.service || key.name, status, responseTime);

    // Create alert if needed
    if (status === 'BLOCKED') {
        db.prepare('INSERT INTO alerts (key_id, type, message) VALUES (?, ?, ?)').run(key.id, 'danger', `${key.name}: RATE LIMITED (${key.used}/${key.rate_limit})`);
    } else if (status === 'WARN') {
        db.prepare('INSERT INTO alerts (key_id, type, message) VALUES (?, ?, ?)').run(key.id, 'warning', `${key.name}: ${Math.round(pct)}% used (${key.used}/${key.rate_limit})`);
    }

    // Update usage history
    const totalUsed = db.prepare('SELECT SUM(used) as total FROM api_keys').get().total || 0;
    const totalKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys').get().count;
    db.prepare('INSERT INTO usage_history (total_used, total_keys) VALUES (?, ?)').run(totalUsed, totalKeys);

    // Trim old usage history
    db.prepare('DELETE FROM usage_history WHERE id NOT IN (SELECT id FROM usage_history ORDER BY timestamp DESC LIMIT 100)').run();

    // Broadcast update
    const updated = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(key.id);
    try { updated.history = JSON.parse(updated.history); } catch { updated.history = []; }

    broadcast('key:updated', updated);
    broadcast('request:logged', { service: key.service || key.name, status, response_time: responseTime, timestamp: Date.now() });

    res.json({ status, response_time: responseTime, used: key.used, limit: key.rate_limit, cooldown_until: key.cooldown_until });
});

// POST reset key
router.post('/:id/reset', (req, res) => {
    const db = req.app.locals.db;
    const broadcast = req.app.locals.broadcast;
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });

    db.prepare('UPDATE api_keys SET used = 0, history = ?, cooldown_until = NULL, updated_at = datetime(\'now\') WHERE id = ?').run('[]', key.id);

    const updated = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(key.id);
    updated.history = [];

    broadcast('key:updated', updated);
    res.json(updated);
});

// DELETE key
router.delete('/:id', (req, res) => {
    const db = req.app.locals.db;
    const broadcast = req.app.locals.broadcast;
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });

    db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id);
    broadcast('key:deleted', { id: req.params.id });
    res.json({ success: true });
});

// POST bulk operations
router.post('/bulk', (req, res) => {
    const db = req.app.locals.db;
    const broadcast = req.app.locals.broadcast;
    const { action, ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    const placeholders = ids.map(() => '?').join(',');

    if (action === 'delete') {
        db.prepare(`DELETE FROM api_keys WHERE id IN (${placeholders})`).run(...ids);
        broadcast('keys:bulk-deleted', { ids });
        res.json({ success: true, deleted: ids.length });
    } else if (action === 'reset') {
        db.prepare(`UPDATE api_keys SET used = 0, history = ?, cooldown_until = NULL WHERE id IN (${placeholders})`).run('[]', ...ids);
        broadcast('keys:bulk-updated', { ids });
        res.json({ success: true, reset: ids.length });
    } else {
        res.status(400).json({ error: 'Invalid action' });
    }
});

// GET folders
router.get('/meta/folders', (req, res) => {
    const db = req.app.locals.db;
    const folders = db.prepare('SELECT * FROM folders ORDER BY name').all();
    res.json(folders);
});

// POST folder
router.post('/meta/folders', (req, res) => {
    const db = req.app.locals.db;
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        db.prepare('INSERT INTO folders (name, color) VALUES (?, ?)').run(name, color || '#6c5ce7');
        res.status(201).json({ name, color: color || '#6c5ce7' });
    } catch (e) {
        res.status(409).json({ error: 'Folder already exists' });
    }
});

// DELETE folder
router.delete('/meta/folders/:name', (req, res) => {
    const db = req.app.locals.db;
    db.prepare('DELETE FROM folders WHERE name = ?').run(req.params.name);
    db.prepare("UPDATE api_keys SET folder = 'Default' WHERE folder = ?").run(req.params.name);
    res.json({ success: true });
});

module.exports = router;
