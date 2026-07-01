const express = require('express');
const router = express.Router();

// GET logs
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { status, service, limit, offset, search } = req.query;

    let query = 'SELECT * FROM request_logs WHERE 1=1';
    const params = [];

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }
    if (service) {
        query += ' AND service = ?';
        params.push(service);
    }
    if (search) {
        query += ' AND (service LIKE ? OR status LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY timestamp DESC';
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit) || 100, parseInt(offset) || 0);

    const logs = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM request_logs').get().count;

    res.json({ logs, total, limit: parseInt(limit) || 100, offset: parseInt(offset) || 0 });
});

// DELETE clear logs
router.delete('/', (req, res) => {
    const db = req.app.locals.db;
    db.prepare('DELETE FROM request_logs').run();
    res.json({ success: true });
});

module.exports = router;
