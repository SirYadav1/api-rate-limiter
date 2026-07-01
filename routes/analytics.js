const express = require('express');
const router = express.Router();

// GET usage history for charts
router.get('/usage', (req, res) => {
    const db = req.app.locals.db;
    const { period } = req.query; // hour, day, week

    let interval;
    if (period === 'hour') interval = 60 * 60 * 1000;
    else if (period === 'week') interval = 7 * 24 * 60 * 60 * 1000;
    else interval = 24 * 60 * 60 * 1000; // day

    const since = Date.now() - interval;
    const history = db.prepare('SELECT * FROM usage_history WHERE timestamp > ? ORDER BY timestamp ASC').all(since);

    res.json(history);
});

// GET service breakdown
router.get('/services', (req, res) => {
    const db = req.app.locals.db;
    const breakdown = db.prepare(`
        SELECT name, service, color, used, rate_limit, category
        FROM api_keys
        WHERE is_active = 1
        ORDER BY used DESC
    `).all();

    res.json(breakdown);
});

// GET overall stats
router.get('/stats', (req, res) => {
    const db = req.app.locals.db;

    const totalKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys').get().count;
    const totalRequests = db.prepare('SELECT SUM(used) as total FROM api_keys').get().total || 0;
    const warningCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE type = 'warning'").get().count;
    const blockedCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE type = 'danger'").get().count;
    const activeKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1').get().count;
    const cooldownKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE cooldown_until > ?').run(Date.now()).get().count;

    // Top used keys
    const topKeys = db.prepare('SELECT name, used, rate_limit, color FROM api_keys ORDER BY used DESC LIMIT 5').all();

    // Requests today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const requestsToday = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE timestamp > ?').get(todayStart.getTime()).count;

    // Average response time
    const avgResponseTime = db.prepare('SELECT AVG(response_time) as avg FROM request_logs WHERE timestamp > ?').get(todayStart.getTime()).avg || 0;

    // Category breakdown
    const categoryBreakdown = db.prepare(`
        SELECT category, COUNT(*) as count, SUM(used) as total_used
        FROM api_keys
        GROUP BY category
        ORDER BY total_used DESC
    `).all();

    res.json({
        totalKeys,
        activeKeys,
        totalRequests,
        warningCount,
        blockedCount,
        cooldownKeys,
        topKeys,
        requestsToday,
        avgResponseTime: Math.round(avgResponseTime),
        categoryBreakdown
    });
});

// GET key health
router.get('/health/:id', (req, res) => {
    const db = req.app.locals.db;
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });

    const pct = (key.used / key.rate_limit) * 100;
    const isOnCooldown = key.cooldown_until && Date.now() < key.cooldown_until;
    const isExpired = key.expiry_date && new Date(key.expiry_date) < new Date();

    let health = 'healthy';
    if (isExpired) health = 'expired';
    else if (isOnCooldown) health = 'cooldown';
    else if (pct >= 100) health = 'critical';
    else if (pct >= key.custom_warning_threshold) health = 'warning';

    res.json({
        health,
        used: key.used,
        limit: key.rate_limit,
        percentage: Math.round(pct),
        isOnCooldown,
        cooldownRemaining: isOnCooldown ? key.cooldown_until - Date.now() : 0,
        isExpired,
        expiryDate: key.expiry_date
    });
});

module.exports = router;
