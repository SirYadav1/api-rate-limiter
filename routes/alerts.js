const express = require('express');
const router = express.Router();

// GET alerts
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { type, unread_only, limit } = req.query;

    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }
    if (unread_only === 'true') {
        query += ' AND read = 0';
    }

    query += ' ORDER BY timestamp DESC';
    query += ` LIMIT ?`;
    params.push(parseInt(limit) || 50);

    const alerts = db.prepare(query).all(...params);
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE read = 0').get().count;

    res.json({ alerts, unreadCount });
});

// PUT mark alert as read
router.put('/:id/read', (req, res) => {
    const db = req.app.locals.db;
    db.prepare('UPDATE alerts SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// PUT mark all as read
router.put('/read-all', (req, res) => {
    const db = req.app.locals.db;
    db.prepare('UPDATE alerts SET read = 1 WHERE read = 0').run();
    res.json({ success: true });
});

// DELETE clear alerts
router.delete('/', (req, res) => {
    const db = req.app.locals.db;
    db.prepare('DELETE FROM alerts').run();
    res.json({ success: true });
});

module.exports = router;
