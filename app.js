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
let apiKeys = JSON.parse(localStorage.getItem('rl_keys') || '[]');
let alerts = JSON.parse(localStorage.getItem('rl_alerts') || '[]');
let requestLogs = JSON.parse(localStorage.getItem('rl_logs') || '[]');
let usageHistory = JSON.parse(localStorage.getItem('rl_usage') || '[]');
let cooldowns = {};
let usageChart, serviceChart;
let simulateInterval = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    renderPresets();
    renderAll();
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
}

function updateThemeIcon(t) {
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = t === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
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

function addPresetKey(preset) {
    const key = prompt(`Enter your ${preset.name} API key:`);
    if (!key) return;

    apiKeys.push({
        id: Date.now(),
        name: preset.name,
        key: key,
        limit: preset.limit,
        used: 0,
        window: preset.window,
        color: preset.color,
        history: [],
        cooldownUntil: null,
        createdAt: new Date().toISOString()
    });

    save();
    renderAll();
    updateCharts();
    addAlert('info', `${preset.name} key added (${preset.limit} req/${formatWindow(preset.window)})`);
}

// ========== ADD KEY ==========
function addKey() {
    const name = document.getElementById('apiKeyName').value.trim();
    const key = document.getElementById('apiKeyId').value.trim();
    const presetLimit = document.getElementById('rateLimitPreset').value;
    const customLimit = parseInt(document.getElementById('rateLimit').value) || 60;
    const window = parseInt(document.getElementById('resetWindow').value) || 60;

    if (!name || !key) return;

    const limit = presetLimit === 'custom' ? customLimit : parseInt(presetLimit);

    apiKeys.push({
        id: Date.now(),
        name,
        key,
        limit,
        used: 0,
        window,
        color: '#6c5ce7',
        history: [],
        cooldownUntil: null,
        createdAt: new Date().toISOString()
    });

    save();
    renderAll();
    updateCharts();

    document.getElementById('apiKeyName').value = '';
    document.getElementById('apiKeyId').value = '';
    addAlert('info', `${name} key added (${limit} req/${formatWindow(window)})`);
}

// ========== DELETE / RESET ==========
function deleteKey(id) {
    const k = apiKeys.find(x => x.id === id);
    apiKeys = apiKeys.filter(x => x.id !== id);
    delete cooldowns[id];
    save();
    renderAll();
    updateCharts();
    if (k) addAlert('info', `${k.name} removed`);
}

function resetKey(id) {
    const k = apiKeys.find(x => x.id === id);
    if (k) { k.used = 0; k.history = []; k.cooldownUntil = null; delete cooldowns[id]; }
    save();
    renderAll();
    updateCharts();
}

function resetAll() {
    if (!confirm('Reset all data?')) return;
    apiKeys.forEach(k => { k.used = 0; k.history = []; k.cooldownUntil = null; });
    cooldowns = {};
    alerts = [];
    requestLogs = [];
    usageHistory = [];
    save();
    renderAll();
    updateCharts();
}

// ========== SIMULATE ==========
function simulateRequests(burst) {
    const keyId = document.getElementById('simulateKey').value;
    const count = parseInt(document.getElementById('simulateCount').value) || 10;
    const delay = burst ? 0 : parseInt(document.getElementById('simulateDelay').value) || 100;

    if (!keyId) return;
    const key = apiKeys.find(k => k.id === parseInt(keyId));
    if (!key) return;

    if (simulateInterval) { clearInterval(simulateInterval); simulateInterval = null; }

    let sent = 0;
    const sendOne = () => {
        if (sent >= count || key.used >= key.limit) {
            if (simulateInterval) { clearInterval(simulateInterval); simulateInterval = null; }
            return;
        }

        key.used++;
        sent++;
        key.history.push({ time: Date.now(), used: key.used });

        const pct = (key.used / key.limit) * 100;
        const method = pct >= 100 ? 'BLOCKED' : pct >= 80 ? 'WARN' : 'OK';
        addRequestLog(key.name, method);

        if (pct >= 100) {
            if (!key.cooldownUntil) {
                key.cooldownUntil = Date.now() + key.window * 1000;
                cooldowns[key.id] = { name: key.name, until: key.cooldownUntil, window: key.window };
            }
            addAlert('danger', `${key.name}: RATE LIMITED (${key.used}/${key.limit})`);
        } else if (pct >= 80) {
            addAlert('warning', `${key.name}: ${Math.round(pct)}% used (${key.used}/${key.limit})`);
        }

        usageHistory.push({ time: Date.now(), total: apiKeys.reduce((s, k) => s + k.used, 0) });
        if (usageHistory.length > 100) usageHistory = usageHistory.slice(-100);

        save();
        renderAll();
        updateCharts();
    };

    if (delay === 0) {
        for (let i = 0; i < count; i++) sendOne();
    } else {
        simulateInterval = setInterval(() => {
            sendOne();
            if (sent >= count) clearInterval(simulateInterval);
        }, delay);
    }
}

// ========== COOLDOWN TICKER ==========
function startCooldownTicker() {
    setInterval(() => {
        const now = Date.now();
        let changed = false;

        apiKeys.forEach(k => {
            if (k.cooldownUntil && now >= k.cooldownUntil) {
                k.cooldownUntil = null;
                k.used = 0;
                k.history = [];
                delete cooldowns[k.id];
                changed = true;
                addAlert('info', `${k.name}: Cooldown reset, ready for new requests`);
            }
        });

        if (changed) { save(); renderAll(); updateCharts(); }
        renderCooldowns();
    }, 1000);
}

// ========== ALERTS ==========
function addAlert(type, message) {
    alerts.unshift({ type, message, time: new Date().toISOString() });
    if (alerts.length > 100) alerts = alerts.slice(0, 100);
    localStorage.setItem('rl_alerts', JSON.stringify(alerts));
    renderAlerts();
    renderStats();
}

// ========== REQUEST LOG ==========
function addRequestLog(service, status) {
    requestLogs.unshift({
        service,
        status,
        time: new Date().toISOString()
    });
    if (requestLogs.length > 200) requestLogs = requestLogs.slice(0, 200);
    localStorage.setItem('rl_logs', JSON.stringify(requestLogs));
    renderRequestLog();
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
    document.getElementById('totalRequests').textContent = apiKeys.reduce((s, k) => s + k.used, 0);
    document.getElementById('warningCount').textContent = alerts.filter(a => a.type === 'warning').length;
    document.getElementById('blockedCount').textContent = alerts.filter(a => a.type === 'danger').length;
}

function renderTable() {
    const tbody = document.getElementById('keysBody');

    if (!apiKeys.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No API keys added. Use Quick Add above.</td></tr>';
        return;
    }

    tbody.innerHTML = apiKeys.map(k => {
        const pct = Math.min((k.used / k.limit) * 100, 100);
        let status = 'ok', st = 'OK', pc = 'progress-ok';
        if (k.cooldownUntil && Date.now() < k.cooldownUntil) {
            status = 'cooldown'; st = 'COOLDOWN'; pc = 'progress-blocked';
        } else if (pct >= 100) {
            status = 'blocked'; st = 'BLOCKED'; pc = 'progress-blocked';
        } else if (pct >= 80) {
            status = 'warn'; st = 'WARNING'; pc = 'progress-warn';
        }

        const masked = k.key.length > 16
            ? k.key.substring(0, 8) + '****' + k.key.substring(k.key.length - 4)
            : k.key.substring(0, 4) + '****';

        const resetIn = k.cooldownUntil
            ? formatCountdown(k.cooldownUntil - Date.now())
            : k.window === 60 ? '1m' : k.window === 3600 ? '1h' : '1d';

        return `<tr>
            <td><strong>${k.name}</strong></td>
            <td><span class="key-mask">${masked}</span></td>
            <td>${k.limit}/${formatWindowShort(k.window)}</td>
            <td>${k.used}</td>
            <td><span class="cooldown-timer">${resetIn}</span></td>
            <td><span class="status-badge status-${status}">${st}</span></td>
            <td><div class="progress-bar"><div class="progress-fill ${pc}" style="width:${pct}%"></div></div></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="resetKey(${k.id})">Reset</button>
                <button class="btn btn-sm btn-danger" onclick="deleteKey(${k.id})">X</button>
            </td>
        </tr>`;
    }).join('');
}

function renderAlerts() {
    const log = document.getElementById('alertsLog');
    if (!alerts.length) {
        log.innerHTML = '<p class="empty-state">No alerts yet.</p>';
        return;
    }
    log.innerHTML = alerts.slice(0, 30).map(a => {
        const icon = a.type === 'danger' ? 'X' : a.type === 'warning' ? '!' : 'i';
        const cls = a.type === 'danger' ? 'method-blocked' : a.type === 'warning' ? 'method-warn' : 'method-ok';
        return `<div class="alert-item">
            <span class="log-method ${cls}">${icon}</span>
            <span class="alert-time">${new Date(a.time).toLocaleTimeString()}</span>
            <span>${a.message}</span>
        </div>`;
    }).join('');
}

function renderRequestLog() {
    const log = document.getElementById('requestLog');
    const search = document.getElementById('logSearch').value.toLowerCase();
    const filtered = requestLogs.filter(l => !search || l.service.toLowerCase().includes(search) || l.status.toLowerCase().includes(search));

    if (!filtered.length) {
        log.innerHTML = '<p class="empty-state">No requests logged yet.</p>';
        return;
    }
    log.innerHTML = filtered.slice(0, 50).map(l => {
        const cls = l.status === 'BLOCKED' ? 'method-blocked' : l.status === 'WARN' ? 'method-warn' : 'method-ok';
        return `<div class="log-entry">
            <span class="log-method ${cls}">${l.status}</span>
            <span class="log-time">${new Date(l.time).toLocaleTimeString()}</span>
            <span>${l.service}</span>
        </div>`;
    }).join('');
}

function renderCooldowns() {
    const el = document.getElementById('cooldowns');
    const active = Object.values(cooldowns).filter(c => Date.now() < c.until);

    if (!active.length) {
        el.innerHTML = '<p class="empty-state">No active cooldowns.</p>';
        return;
    }

    el.innerHTML = active.map(c => {
        const remaining = c.until - Date.now();
        return `<div class="cooldown-card">
            <span class="cooldown-name">${c.name}</span>
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
function initCharts() {
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
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7a95', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7a95', font: { size: 10 } }, beginAtZero: true }
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
            plugins: { legend: { position: 'bottom', labels: { color: '#7a7a95', padding: 12, font: { size: 11 } } } }
        }
    });

    updateCharts();
}

function updateCharts() {
    const last20 = usageHistory.slice(-20);
    usageChart.data.labels = last20.map(h => new Date(h.time).toLocaleTimeString());
    usageChart.data.datasets[0].data = last20.map(h => h.total);
    usageChart.update('none');

    serviceChart.data.labels = apiKeys.map(k => k.name);
    serviceChart.data.datasets[0].data = apiKeys.map(k => k.used);
    serviceChart.data.datasets[0].backgroundColor = apiKeys.map(k => k.color || '#6c5ce7');
    serviceChart.update('none');
}

// ========== EXPORT / IMPORT ==========
function exportData() {
    const data = { apiKeys, alerts, requestLogs, usageHistory, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rate-limiter-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    addAlert('info', 'Data exported');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const d = JSON.parse(ev.target.result);
            if (d.apiKeys) apiKeys = d.apiKeys;
            if (d.alerts) alerts = d.alerts;
            if (d.requestLogs) requestLogs = d.requestLogs;
            if (d.usageHistory) usageHistory = d.usageHistory;
            save();
            renderAll();
            updateCharts();
            addAlert('info', 'Data imported');
        } catch { alert('Invalid backup file'); }
    };
    reader.readAsText(file);
}

// ========== HELPERS ==========
function formatWindow(s) {
    if (s < 3600) return `${s / 60} min`;
    if (s < 86400) return `${s / 3600} hour`;
    return `${s / 86400} day`;
}

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

function save() {
    localStorage.setItem('rl_keys', JSON.stringify(apiKeys));
    localStorage.setItem('rl_alerts', JSON.stringify(alerts));
    localStorage.setItem('rl_logs', JSON.stringify(requestLogs));
    localStorage.setItem('rl_usage', JSON.stringify(usageHistory));
}

// ========== LISTENERS ==========
function setupListeners() {
    document.getElementById('addKeyBtn').addEventListener('click', addKey);
    document.getElementById('simulateBtn').addEventListener('click', () => simulateRequests(false));
    document.getElementById('simulateBurstBtn').addEventListener('click', () => simulateRequests(true));
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('clearLogsBtn').addEventListener('click', () => { requestLogs = []; save(); renderRequestLog(); });
    document.getElementById('logSearch').addEventListener('input', renderRequestLog);

    document.getElementById('rateLimitPreset').addEventListener('change', function() {
        if (this.value !== 'custom') document.getElementById('rateLimit').value = this.value;
    });
}
