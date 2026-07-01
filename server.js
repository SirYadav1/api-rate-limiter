require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db');
const keysRouter = require('./routes/keys');
const logsRouter = require('./routes/logs');
const alertsRouter = require('./routes/alerts');
const analyticsRouter = require('./routes/analytics');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/rate-limiter.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = initDB(DB_PATH);

// Make db accessible to routes
app.locals.db = db;
app.locals.wss = wss;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/keys', keysRouter);
app.use('/api/logs', logsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/analytics', analyticsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Serve frontend (Express 5 requires {*path} instead of *)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[WS] Client disconnected (${clients.size} total)`);
    });

    ws.on('error', (err) => {
        console.error('[WS] Error:', err.message);
        clients.delete(ws);
    });
});

// Broadcast to all connected clients
function broadcast(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
}

app.locals.broadcast = broadcast;

// Cleanup old data periodically (every hour)
setInterval(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    db.prepare('DELETE FROM request_logs WHERE timestamp < ?').run(oneWeekAgo);
    db.prepare('DELETE FROM alerts WHERE timestamp < ?').run(oneWeekAgo);
    db.prepare('DELETE FROM usage_history WHERE timestamp < ?').run(oneWeekAgo);
}, 60 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket ready on ws://localhost:${PORT}`);
});

module.exports = { server, broadcast };
