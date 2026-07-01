// ========== API PRESETS ==========
const API_PRESETS = [
    { name: 'OpenAI', limit: 60, color: '#10a37f', window: 60, category: 'AI' },
    { name: 'Claude', limit: 50, color: '#d97757', window: 60, category: 'AI' },
    { name: 'Gemini', limit: 60, color: '#4285f4', window: 60, category: 'AI' },
    { name: 'Groq', limit: 30, color: '#f55036', window: 60, category: 'AI' },
    { name: 'HuggingFace', limit: 100, color: '#ffd21e', window: 60, category: 'AI' },
    { name: 'GitHub', limit: 60, color: '#f0f6fc', window: 3600, category: 'Dev' },
    { name: 'GitLab', limit: 30, color: '#fc6d26', window: 60, category: 'Dev' },
    { name: 'NPM', limit: 60, color: '#cb3837', window: 60, category: 'Dev' },
    { name: 'Docker Hub', limit: 100, color: '#2496ed', window: 60, category: 'Dev' },
    { name: 'Stripe', limit: 100, color: '#635bff', window: 60, category: 'Payment' },
    { name: 'Razorpay', limit: 100, color: '#072654', window: 60, category: 'Payment' },
    { name: 'PayPal', limit: 50, color: '#003087', window: 60, category: 'Payment' },
    { name: 'Twitter/X', limit: 15, color: '#1da1f2', window: 900, category: 'Social' },
    { name: 'Discord', limit: 50, color: '#5865f2', window: 60, category: 'Social' },
    { name: 'Telegram', limit: 30, color: '#0088cc', window: 60, category: 'Social' },
    { name: 'Spotify', limit: 180, color: '#1db954', window: 60, category: 'Media' },
    { name: 'YouTube', limit: 10000, color: '#ff0000', window: 86400, category: 'Media' },
    { name: 'Twilio', limit: 50, color: '#f22f46', window: 60, category: 'Comm' },
    { name: 'SendGrid', limit: 600, color: '#1a82e2', window: 60, category: 'Comm' },
    { name: 'Mailgun', limit: 100, color: '#f05b3f', window: 60, category: 'Comm' },
    { name: 'Firebase', limit: 50, color: '#ffca28', window: 60, category: 'Cloud' },
    { name: 'AWS', limit: 100, color: '#ff9900', window: 60, category: 'Cloud' },
    { name: 'Cloudflare', limit: 1200, color: '#f38020', window: 60, category: 'Cloud' },
    { name: 'Supabase', limit: 500, color: '#3ecf8e', window: 60, category: 'Cloud' },
    { name: 'MongoDB', limit: 100, color: '#47a248', window: 60, category: 'DB' },
    { name: 'Redis', limit: 1000, color: '#dc382d', window: 60, category: 'DB' },
];

// ========== STATE ==========
let apiKeys = [];
let alerts = [];
let requestLogs = [];
let usageHistory = [];
let folders = ['Default'];
let selectedKeys = new Set();
let ws = null;
let usageChart, serviceChart;
let currentChartPeriod = 'day';

// ========== API HELPERS ==========
const API_BASE = '/api';

async function api(path, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`API Error: ${path}`, err);
        showToast('API request failed', 'error');
        throw err;
    }
}

// ========== WEBSOCKET ==========
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
        console.log('[WS] Connected');
        updateConnectionStatus(true);
    };

    ws.onmessage = (event) => {
        try {
            const { type, data } = JSON.parse(event.data);
            handleWSMessage(type, data);
        } catch (err) {
            console.error('[WS] Parse error:', err);
        }
    };

    ws.onclose = () => {
        console.log('[WS] Disconnected');
        updateConnectionStatus(false);
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
        updateConnectionStatus(false);
    };
}

function handleWSMessage(type, data) {
    switch (type) {
        case 'key:created':
        case 'key:updated':
            const idx = apiKeys.findIndex(k => k.id === data.id);
            if (idx >= 0) apiKeys[idx] = data;
            else apiKeys.push(data);
            renderAll();
            updateCharts();
            break;
        case 'key:deleted':
            apiKeys = apiKeys.filter(k => k.id !== data.id);
            selectedKeys.delete(data.id);
            renderAll();
            updateCharts();
            break;
        case 'keys:bulk-deleted':
            apiKeys = apiKeys.filter(k => !data.ids.includes(k.id));
            data.ids.forEach(id => selectedKeys.delete(id));
            renderAll();
            updateCharts();
            break;
        case 'keys:bulk-updated':
            loadKeys();
            break;
        case 'request:logged':
            requestLogs.unshift(data);
            if (requestLogs.length > 200) requestLogs = requestLogs.slice(0, 200);
            renderRequestLog();
            break;
    }
}

function updateConnectionStatus(connected) {
    const el = document.getElementById('connectionStatus');
    if (el) {
        el.className = `connection-dot ${connected ? 'connected' : 'disconnected'}`;
        el.title = connected ? 'Connected to server' : 'Disconnected - reconnecting...';
    }
}

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '!' : 'i'}</span>
        <span class="toast-msg">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// ========== BROWSER NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body, icon) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: icon || undefined });
    }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    renderPresets();
    connectWebSocket();
    requestNotificationPermission();
    loadKeys();
    loadAlerts();
    loadLogs();
    loadFolders();
    initCharts();
    setupListeners();
    startCooldownTicker();
});

// ========== THEME ==========
function loadTheme() {
    const t = localStorage.getItem('rl_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    updateThemeIcon(t);
}

function toggleTheme() {
    const c = document.documentElement.getAttribute('data-theme');
    const n = c === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('rl_theme', n);
    updateThemeIcon(n);
    updateCharts();
}

function updateThemeIcon(t) {
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = t === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

// ========== DATA LOADING ==========
async function loadKeys() {
    try {
        const search = document.getElementById('logSearch')?.value || '';
        const folder = document.getElementById('folderFilter')?.value || '';
        let query = '?';
        if (search) query += `search=${encodeURIComponent(search)}&`;
        if (folder) query += `folder=${encodeURIComponent(folder)}&`;
        apiKeys = await api(`/keys${query}`);
        renderAll();
        updateCharts();
    } catch (err) {
        console.error('Failed to load keys:', err);
    }
}

async function loadAlerts() {
    try {
        const data = await api('/alerts');
        alerts = data.alerts || [];
        renderAlerts();
        renderStats();
    } catch (err) {
        console.error('Failed to load alerts:', err);
    }
}

async function loadLogs() {
    try {
        const data = await api('/logs?limit=200');
        requestLogs = data.logs || [];
        renderRequestLog();
    } catch (err) {
        console.error('Failed to load logs:', err);
    }
}

async function loadFolders() {
    try {
        const data = await api('/keys/meta/folders');
        folders = data.map(f => f.name);
        renderFolderFilter();
    } catch (err) {
        console.error('Failed to load folders:', err);
    }
}

// ========== PRESETS ==========
function renderPresets() {
    const grid = document.getElementById('presetsGrid');
    grid.innerHTML = API_PRESETS.map((p, i) =>
        `<button class="preset-btn" data-index="${i}">
            <span class="preset-dot" style="background:${p.color}"></span>
            ${p.name}
        </button>`
    ).join('');

    grid.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = API_PRESETS[btn.dataset.index];
            addPresetKey(preset);
        });
    });
}

async function addPresetKey(preset) {
    const key = prompt(`Enter your ${preset.name} API key:`);
    if (!key) return;

    try {
        await api('/keys', {
            method: 'POST',
            body: JSON.stringify({
                name: preset.name,
                key: key,
                service: preset.name,
                category: preset.category,
                color: preset.color,
                rate_limit: preset.limit,
                window: preset.window
            })
        });
        await loadKeys();
        showToast(`${preset.name} key added`, 'success');
        sendNotification('API Key Added', `${preset.name} key has been added to monitoring`);
    } catch (err) {
        showToast('Failed to add key', 'error');
    }
}

// ========== ADD KEY ==========
async function addKey() {
    const name = document.getElementById('apiKeyName').value.trim();
    const key = document.getElementById('apiKeyId').value.trim();
    const presetLimit = document.getElementById('rateLimitPreset').value;
    const customLimit = parseInt(document.getElementById('rateLimit').value) || 60;
    const window = parseInt(document.getElementById('resetWindow').value) || 60;
    const folder = document.getElementById('keyFolder')?.value || 'Default';

    if (!name || !key) return;

    const limit = presetLimit === 'custom' ? customLimit : parseInt(presetLimit);

    try {
        await api('/keys', {
            method: 'POST',
            body: JSON.stringify({
                name,
                key,
                service: name,
                category: 'Custom',
                rate_limit: limit,
                window,
                folder
            })
        });
        await loadKeys();
        showToast(`${name} key added`, 'success');

        document.getElementById('apiKeyName').value = '';
        document.getElementById('apiKeyId').value = '';
    } catch (err) {
        showToast('Failed to add key', 'error');
    }
}

// ========== DELETE / RESET ==========
async function deleteKey(id) {
    if (!confirm('Delete this API key?')) return;
    try {
        await api(`/keys/${id}`, { method: 'DELETE' });
        apiKeys = apiKeys.filter(k => k.id !== id);
        selectedKeys.delete(id);
        renderAll();
        updateCharts();
        showToast('Key deleted', 'info');
    } catch (err) {
        showToast('Failed to delete key', 'error');
    }
}

async function resetKey(id) {
    try {
        await api(`/keys/${id}/reset`, { method: 'POST' });
        await loadKeys();
        showToast('Key reset', 'success');
    } catch (err) {
        showToast('Failed to reset key', 'error');
    }
}

async function resetAll() {
    if (!confirm('Reset all keys?')) return;
    try {
        const ids = apiKeys.map(k => k.id);
        await api('/keys/bulk', {
            method: 'POST',
            body: JSON.stringify({ action: 'reset', ids })
        });
        await loadKeys();
        showToast('All keys reset', 'success');
    } catch (err) {
        showToast('Failed to reset all keys', 'error');
    }
}

// ========== BULK OPERATIONS ==========
async function bulkDelete() {
    if (selectedKeys.size === 0) return showToast('No keys selected', 'warning');
    if (!confirm(`Delete ${selectedKeys.size} keys?`)) return;

    try {
        await api('/keys/bulk', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', ids: [...selectedKeys] })
        });
        selectedKeys.clear();
        await loadKeys();
        showToast('Selected keys deleted', 'success');
    } catch (err) {
        showToast('Bulk delete failed', 'error');
    }
}

async function bulkReset() {
    if (selectedKeys.size === 0) return showToast('No keys selected', 'warning');

    try {
        await api('/keys/bulk', {
            method: 'POST',
            body: JSON.stringify({ action: 'reset', ids: [...selectedKeys] })
        });
        selectedKeys.clear();
        await loadKeys();
        showToast('Selected keys reset', 'success');
    } catch (err) {
        showToast('Bulk reset failed', 'error');
    }
}

function toggleSelectAll() {
    const allSelected = apiKeys.every(k => selectedKeys.has(k.id));
    if (allSelected) {
        selectedKeys.clear();
    } else {
        apiKeys.forEach(k => selectedKeys.add(k.id));
    }
    renderTable();
}

// ========== SIMULATE ==========
async function simulateRequests(burst) {
    const keyId = document.getElementById('simulateKey').value;
    const count = parseInt(document.getElementById('simulateCount').value) || 10;
    const delay = burst ? 0 : parseInt(document.getElementById('simulateDelay').value) || 100;

    if (!keyId) return;
    const key = apiKeys.find(k => k.id === keyId);
    if (!key) return;

    let sent = 0;
    const sendOne = async () => {
        if (sent >= count) return;
        try {
            const result = await api(`/keys/${keyId}/simulate`, { method: 'POST' });
            sent++;
            if (result.status === 'BLOCKED') {
                showToast(`${key.name}: RATE LIMITED!`, 'error');
                sendNotification('Rate Limited!', `${key.name} has hit its rate limit`);
            } else if (result.status === 'WARN') {
                showToast(`${key.name}: ${Math.round((result.used / result.limit) * 100)}% used`, 'warning');
            }
        } catch (err) {
            sent++;
        }
    };

    if (delay === 0) {
        for (let i = 0; i < count; i++) await sendOne();
    } else {
        for (let i = 0; i < count; i++) {
            await sendOne();
            await new Promise(r => setTimeout(r, delay));
        }
    }

    await loadKeys();
    await loadAlerts();
    await loadLogs();
}

// ========== COOLDOWN TICKER ==========
function startCooldownTicker() {
    setInterval(() => {
        renderCooldowns();
        renderTable();
    }, 1000);
}

// ========== ALERTS ==========
async function markAlertRead(id) {
    await api(`/alerts/${id}/read`, { method: 'PUT' });
    await loadAlerts();
}

async function markAllAlertsRead() {
    await api('/alerts/read-all', { method: 'PUT' });
    await loadAlerts();
}

async function clearAlerts() {
    if (!confirm('Clear all alerts?')) return;
    await api('/alerts', { method: 'DELETE' });
    alerts = [];
    renderAlerts();
    renderStats();
}

// ========== REQUEST LOG ==========
async function clearLogs() {
    if (!confirm('Clear all logs?')) return;
    await api('/logs', { method: 'DELETE' });
    requestLogs = [];
    renderRequestLog();
}

// ========== FOLDER MANAGEMENT ==========
async function addFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;
    try {
        await api('/keys/meta/folders', {
            method: 'POST',
            body: JSON.stringify({ name, color: '#6c5ce7' })
        });
        await loadFolders();
        showToast(`Folder "${name}" created`, 'success');
    } catch (err) {
        showToast('Failed to create folder', 'error');
    }
}

function renderFolderFilter() {
    const select = document.getElementById('folderFilter');
    if (!select) return;
    select.innerHTML = '<option value="">All Folders</option>' +
        folders.map(f => `<option value="${f}">${f}</option>`).join('');

    // Also update key form folder select
    const keyFolder = document.getElementById('keyFolder');
    if (keyFolder) {
        keyFolder.innerHTML = folders.map(f => `<option value="${f}">${f}</option>`).join('');
    }
}

// ========== RENDER ==========
function renderAll() {
    renderStats();
    renderTable();
    renderAlerts();
    renderRequestLog();
    renderCooldowns();
    renderSimulateOptions();
}

function renderStats() {
    document.getElementById('totalKeys').textContent = apiKeys.length;
    document.getElementById('totalRequests').textContent = apiKeys.reduce((s, k) => s + (k.used || 0), 0);
    document.getElementById('warningCount').textContent = alerts.filter(a => a.type === 'warning').length;
    document.getElementById('blockedCount').textContent = alerts.filter(a => a.type === 'danger').length;

    // New stats from analytics
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const requestsToday = requestLogs.filter(l => l.timestamp > todayMs).length;
    document.getElementById('requestsToday').textContent = requestsToday;

    const avgRT = requestLogs.filter(l => l.timestamp > todayMs && l.response_time)
        .reduce((acc, l, _, arr) => acc + l.response_time / arr.length, 0);
    document.getElementById('avgResponseTime').textContent = Math.round(avgRT) + 'ms';

    const cooldowns = apiKeys.filter(k => k.cooldown_until && now < k.cooldown_until).length;
    document.getElementById('cooldownCount').textContent = cooldowns;

    const active = apiKeys.filter(k => k.is_active !== 0).length;
    document.getElementById('activeKeys').textContent = active;

    // Category breakdown
    renderCategoryBreakdown();
}

function renderTable() {
    const tbody = document.getElementById('keysBody');

    if (!apiKeys.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No API keys added. Use Quick Add above.</td></tr>';
        return;
    }

    tbody.innerHTML = apiKeys.map(k => {
        const pct = Math.min(((k.used || 0) / (k.rate_limit || 60)) * 100, 100);
        let status = 'ok', st = 'OK', pc = 'progress-ok';
        const now = Date.now();
        if (k.cooldown_until && now < k.cooldown_until) {
            status = 'cooldown'; st = 'COOLDOWN'; pc = 'progress-blocked';
        } else if (pct >= 100) {
            status = 'blocked'; st = 'BLOCKED'; pc = 'progress-blocked';
        } else if (pct >= (k.custom_warning_threshold || 80)) {
            status = 'warn'; st = 'WARNING'; pc = 'progress-warn';
        }

        const masked = (k.key || '').length > 16
            ? k.key.substring(0, 8) + '****' + k.key.substring(k.key.length - 4)
            : (k.key || '').substring(0, 4) + '****';

        const window = k.window || 60;
        const resetIn = k.cooldown_until && now < k.cooldown_until
            ? formatCountdown(k.cooldown_until - now)
            : window === 60 ? '1m' : window === 3600 ? '1h' : '1d';

        const isSelected = selectedKeys.has(k.id);
        const expiryWarning = k.expiry_date && new Date(k.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        return `<tr class="${isSelected ? 'row-selected' : ''}">
            <td><input type="checkbox" class="row-check" data-id="${k.id}" ${isSelected ? 'checked' : ''}></td>
            <td>
                <strong>${k.name}</strong>
                ${k.folder && k.folder !== 'Default' ? `<span class="folder-tag">${k.folder}</span>` : ''}
            </td>
            <td><span class="key-mask">${masked}</span></td>
            <td>${k.rate_limit || 60}/${formatWindowShort(window)}</td>
            <td>${k.used || 0}</td>
            <td><span class="cooldown-timer">${resetIn}</span></td>
            <td><span class="status-badge status-${status}">${st}</span></td>
            <td><div class="progress-bar"><div class="progress-fill ${pc}" style="width:${pct}%"></div></div></td>
            <td class="actions-cell">
                <button class="btn btn-sm btn-primary" onclick="resetKey('${k.id}')" title="Reset">↺</button>
                <button class="btn btn-sm btn-outline" onclick="openEditModal('${k.id}')" title="Edit">✎</button>
                <button class="btn btn-sm btn-outline" onclick="showKeyHealth('${k.id}')" title="Health Check">♥</button>
                <button class="btn btn-sm btn-outline" onclick="copyKey('${k.id}')" title="Copy Key">📋</button>
                <button class="btn btn-sm btn-danger" onclick="deleteKey('${k.id}')" title="Delete">✕</button>
                ${expiryWarning ? '<span class="expiry-badge">!</span>' : ''}
            </td>
        </tr>`;
    }).join('');

    // Add checkbox listeners
    tbody.querySelectorAll('.row-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) selectedKeys.add(id);
            else selectedKeys.delete(id);
            renderTable();
        });
    });

    // Update bulk action buttons visibility
    const bulkBar = document.getElementById('bulkActions');
    if (bulkBar) {
        bulkBar.style.display = selectedKeys.size > 0 ? 'flex' : 'none';
        document.getElementById('bulkCount').textContent = selectedKeys.size;
    }
}

function renderAlerts() {
    const log = document.getElementById('alertsLog');
    if (!alerts.length) {
        log.innerHTML = '<p class="empty-state">No alerts yet.</p>';
        return;
    }
    log.innerHTML = alerts.slice(0, 30).map(a => {
        const icon = a.type === 'danger' ? '✕' : a.type === 'warning' ? '!' : 'i';
        const cls = a.type === 'danger' ? 'method-blocked' : a.type === 'warning' ? 'method-warn' : 'method-ok';
        return `<div class="alert-item ${a.read ? 'alert-read' : ''}">
            <span class="log-method ${cls}">${icon}</span>
            <span class="alert-time">${formatTimestamp(a.timestamp)}</span>
            <span>${a.message}</span>
            ${!a.read ? `<button class="btn-link" onclick="markAlertRead(${a.id})">Mark read</button>` : ''}
        </div>`;
    }).join('');
}

function renderRequestLog() {
    const log = document.getElementById('requestLog');
    const search = document.getElementById('logSearch')?.value?.toLowerCase() || '';
    const filtered = requestLogs.filter(l => !search || (l.service || '').toLowerCase().includes(search) || (l.status || '').toLowerCase().includes(search));

    if (!filtered.length) {
        log.innerHTML = '<p class="empty-state">No requests logged yet.</p>';
        return;
    }
    log.innerHTML = filtered.slice(0, 50).map(l => {
        const cls = l.status === 'BLOCKED' ? 'method-blocked' : l.status === 'WARN' ? 'method-warn' : 'method-ok';
        return `<div class="log-entry">
            <span class="log-method ${cls}">${l.status}</span>
            <span class="log-time">${formatTimestamp(l.timestamp)}</span>
            <span>${l.service}</span>
            ${l.response_time ? `<span class="log-rt">${l.response_time}ms</span>` : ''}
        </div>`;
    }).join('');
}

function renderCooldowns() {
    const el = document.getElementById('cooldowns');
    const now = Date.now();
    const active = apiKeys.filter(k => k.cooldown_until && now < k.cooldown_until);

    if (!active.length) {
        el.innerHTML = '<p class="empty-state">No active cooldowns.</p>';
        return;
    }

    el.innerHTML = active.map(k => {
        const remaining = k.cooldown_until - now;
        return `<div class="cooldown-card">
            <span class="cooldown-name">${k.name}</span>
            <span class="cooldown-timer">${formatCountdown(remaining)}</span>
        </div>`;
    }).join('');
}

function renderSimulateOptions() {
    const s = document.getElementById('simulateKey');
    s.innerHTML = '<option value="">Select API Key</option>' +
        apiKeys.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
}

// ========== CHARTS ==========
async function initCharts() {
    const theme = document.documentElement.getAttribute('data-theme');
    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const tickColor = theme === 'dark' ? '#7a7a95' : '#666680';

    usageChart = new Chart(document.getElementById('usageChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Requests',
                data: [],
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108,92,231,0.08)',
                fill: true, tension: 0.4, pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } }, beginAtZero: true }
            }
        }
    });

    serviceChart = new Chart(document.getElementById('serviceChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{ data: [], backgroundColor: [] }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: tickColor, padding: 12, font: { size: 11 } } } }
        }
    });

    await updateCharts();
}

async function updateCharts() {
    try {
        const [usageData, serviceData] = await Promise.all([
            api(`/analytics/usage?period=${currentChartPeriod}`),
            api('/analytics/services')
        ]);

        const last20 = (usageData || []).slice(-20);
        usageChart.data.labels = last20.map(h => formatTimestamp(h.timestamp));
        usageChart.data.datasets[0].data = last20.map(h => h.total_used);
        usageChart.update('none');

        serviceChart.data.labels = serviceData.map(k => k.name);
        serviceChart.data.datasets[0].data = serviceData.map(k => k.used || 0);
        serviceChart.data.datasets[0].backgroundColor = serviceData.map(k => k.color || '#6c5ce7');
        serviceChart.update('none');
    } catch (err) {
        console.error('Chart update failed:', err);
    }
}

// ========== COPY KEY ==========
function copyKey(id) {
    const key = apiKeys.find(k => k.id === id);
    if (key) {
        navigator.clipboard.writeText(key.key).then(() => {
            showToast('API key copied to clipboard', 'success');
        });
    }
}

// ========== HELPERS ==========
function formatWindowShort(s) {
    if (s < 3600) return 'min';
    if (s < 86400) return 'hr';
    return 'day';
}

function formatCountdown(ms) {
    if (ms <= 0) return '0s';
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
}

function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : parseInt(ts));
    return d.toLocaleTimeString();
}

// ========== LISTENERS ==========
function setupListeners() {
    document.getElementById('addKeyBtn').addEventListener('click', addKey);
    document.getElementById('simulateBtn').addEventListener('click', () => simulateRequests(false));
    document.getElementById('simulateBurstBtn').addEventListener('click', () => simulateRequests(true));
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
    document.getElementById('clearAlertsBtn')?.addEventListener('click', clearAlerts);
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAllAlertsRead);
    document.getElementById('logSearch')?.addEventListener('input', () => loadKeys());
    document.getElementById('folderFilter')?.addEventListener('change', () => loadKeys());
    document.getElementById('addFolderBtn')?.addEventListener('click', addFolder);

    // Bulk actions
    document.getElementById('bulkDeleteBtn')?.addEventListener('click', bulkDelete);
    document.getElementById('bulkResetBtn')?.addEventListener('click', bulkReset);
    document.getElementById('selectAllBtn')?.addEventListener('click', toggleSelectAll);

    // Preset filter
    document.querySelectorAll('.preset-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.dataset.category;
            document.querySelectorAll('.preset-btn').forEach(p => {
                const preset = API_PRESETS[p.dataset.index];
                p.style.display = (!cat || cat === 'all' || preset.category === cat) ? '' : 'none';
            });
        });
    });

    document.getElementById('rateLimitPreset').addEventListener('change', function() {
        if (this.value !== 'custom') document.getElementById('rateLimit').value = this.value;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch(e.key) {
            case 'n': document.getElementById('apiKeyName')?.focus(); break;
            case 'r': if (e.ctrlKey) { e.preventDefault(); loadKeys(); } break;
            case '/': document.getElementById('logSearch')?.focus(); e.preventDefault(); break;
            case '?': showShortcuts(); break;
        }
    });
}

function showShortcuts() {
    showToast('Shortcuts: N=focus name, Ctrl+R=refresh, /=search, ?=help', 'info');
}

// ========== CATEGORY BREAKDOWN ==========
function renderCategoryBreakdown() {
    const el = document.getElementById('categoryBreakdown');
    if (!el) return;

    const categories = {};
    apiKeys.forEach(k => {
        const cat = k.category || 'Custom';
        if (!categories[cat]) categories[cat] = { count: 0, used: 0, limit: 0 };
        categories[cat].count++;
        categories[cat].used += k.used || 0;
        categories[cat].limit += k.rate_limit || 60;
    });

    const catColors = {
        AI: '#6c5ce7', Dev: '#00d2a0', Payment: '#ffc048', Social: '#1da1f2',
        Media: '#ff4757', Comm: '#4da6ff', Cloud: '#ff9900', DB: '#47a248', Custom: '#7a7a95'
    };

    el.innerHTML = Object.entries(categories).map(([cat, data]) => {
        const pct = data.limit > 0 ? Math.round((data.used / data.limit) * 100) : 0;
        const color = catColors[cat] || '#6c5ce7';
        return `<div class="category-card">
            <div class="category-header">
                <span class="category-dot" style="background:${color}"></span>
                <span class="category-name">${cat}</span>
                <span class="category-count">${data.count} keys</span>
            </div>
            <div class="category-stats">
                <span>${data.used}/${data.limit} req</span>
                <span>${pct}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div></div>
        </div>`;
    }).join('');
}

// ========== CHART PERIOD ==========
function changeChartPeriod(period, btn) {
    currentChartPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateCharts();
}

// ========== EXPORT / IMPORT ==========
async function exportData() {
    try {
        const [keys, logs, alertsData] = await Promise.all([
            api('/keys'),
            api('/logs?limit=9999'),
            api('/alerts?limit=9999')
        ]);
        const data = {
            apiKeys: keys,
            requestLogs: logs.logs || [],
            alerts: alertsData.alerts || [],
            exportedAt: new Date().toISOString(),
            version: '2.0'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `rate-limiter-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showToast('Data exported successfully', 'success');
    } catch (err) {
        showToast('Export failed', 'error');
    }
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const d = JSON.parse(ev.target.result);
            if (d.apiKeys) {
                for (const k of d.apiKeys) {
                    await api('/keys', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: k.name,
                            key: k.key,
                            service: k.service || k.name,
                            category: k.category || 'Custom',
                            color: k.color || '#6c5ce7',
                            rate_limit: k.rate_limit || k.limit || 60,
                            window: k.window || 60,
                            notes: k.notes || '',
                            folder: k.folder || 'Default'
                        })
                    });
                }
            }
            await loadKeys();
            await loadAlerts();
            await loadLogs();
            showToast('Data imported successfully', 'success');
        } catch (err) {
            showToast('Invalid backup file', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ========== AUTO-REFRESH ==========
setInterval(async () => {
    await loadKeys();
    await loadAlerts();
}, 30000);

// ========== EDIT KEY MODAL ==========
let editingKeyId = null;

function openEditModal(id) {
    editingKeyId = id;
    const key = apiKeys.find(k => k.id === id);
    if (!key) return;

    const modal = document.getElementById('editModal');
    document.getElementById('editKeyName').value = key.name || '';
    document.getElementById('editKeyService').value = key.service || '';
    document.getElementById('editKeyCategory').value = key.category || 'Custom';
    document.getElementById('editKeyColor').value = key.color || '#6c5ce7';
    document.getElementById('editKeyLimit').value = key.rate_limit || 60;
    document.getElementById('editKeyWindow').value = key.window || 60;
    document.getElementById('editKeyFolder').value = key.folder || 'Default';
    document.getElementById('editKeyNotes').value = key.notes || '';
    document.getElementById('editKeyExpiry').value = key.expiry_date || '';
    document.getElementById('editKeyThreshold').value = key.custom_warning_threshold || 80;

    // Populate folder select
    const folderSelect = document.getElementById('editKeyFolder');
    folderSelect.innerHTML = folders.map(f => `<option value="${f}" ${f === key.folder ? 'selected' : ''}>${f}</option>`).join('');

    modal.classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editingKeyId = null;
}

async function saveEditKey() {
    if (!editingKeyId) return;

    try {
        await api(`/keys/${editingKeyId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: document.getElementById('editKeyName').value,
                service: document.getElementById('editKeyService').value,
                category: document.getElementById('editKeyCategory').value,
                color: document.getElementById('editKeyColor').value,
                rate_limit: parseInt(document.getElementById('editKeyLimit').value),
                window: parseInt(document.getElementById('editKeyWindow').value),
                folder: document.getElementById('editKeyFolder').value,
                notes: document.getElementById('editKeyNotes').value,
                expiry_date: document.getElementById('editKeyExpiry').value || null,
                custom_warning_threshold: parseInt(document.getElementById('editKeyThreshold').value)
            })
        });
        closeEditModal();
        await loadKeys();
        showToast('Key updated successfully', 'success');
    } catch (err) {
        showToast('Failed to update key', 'error');
    }
}

// ========== KEY HEALTH CHECK ==========
async function showKeyHealth(id) {
    try {
        const health = await api(`/analytics/health/${id}`);
        const key = apiKeys.find(k => k.id === id);
        const statusColors = {
            healthy: 'var(--green)',
            warning: 'var(--yellow)',
            critical: 'var(--red)',
            cooldown: 'var(--primary)',
            expired: 'var(--text2)'
        };

        showToast(
            `${key?.name}: ${health.health.toUpperCase()} — ${health.used}/${health.limit} (${health.percentage}%)` +
            (health.isOnCooldown ? ` — Cooldown: ${formatCountdown(health.cooldownRemaining)}` : '') +
            (health.isExpired ? ' — EXPIRED' : ''),
            health.health === 'healthy' ? 'success' : health.health === 'warning' ? 'warning' : 'error'
        );
    } catch (err) {
        showToast('Health check failed', 'error');
    }
}

// ========== TOGGLE KEY ACTIVE ==========
async function toggleKeyActive(id) {
    const key = apiKeys.find(k => k.id === id);
    if (!key) return;

    try {
        await api(`/keys/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: key.is_active ? 0 : 1 })
        });
        await loadKeys();
        showToast(`Key ${key.is_active ? 'disabled' : 'enabled'}`, 'info');
    } catch (err) {
        showToast('Failed to toggle key', 'error');
    }
}
