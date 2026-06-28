// ========== STATE ==========
let apiKeys = JSON.parse(localStorage.getItem('apiKeys') || '[]');
let alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
let usageHistory = JSON.parse(localStorage.getItem('usageHistory') || '[]');
let usageChart, serviceChart;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    renderAll();
    initCharts();
    setupListeners();
});

// ========== THEME ==========
function loadTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
}

// ========== ADD KEY ==========
function addKey() {
    const name = document.getElementById('apiKeyName').value.trim();
    const key = document.getElementById('apiKeyId').value.trim();
    const limit = parseInt(document.getElementById('rateLimit').value) || 60;

    if (!name || !key) return alert('Please enter service name and API key');

    apiKeys.push({
        id: Date.now(),
        name,
        key,
        limit,
        used: 0,
        history: [],
        createdAt: new Date().toISOString()
    });

    save();
    renderAll();

    document.getElementById('apiKeyName').value = '';
    document.getElementById('apiKeyId').value = '';
    document.getElementById('rateLimit').value = '60';

    addAlert('info', `${name} API key added (limit: ${limit}/min)`);
}

// ========== DELETE KEY ==========
function deleteKey(id) {
    if (!confirm('Delete this API key?')) return;
    const key = apiKeys.find(k => k.id === id);
    apiKeys = apiKeys.filter(k => k.id !== id);
    save();
    renderAll();
    addAlert('info', `${key.name} API key removed`);
}

// ========== RESET KEY ==========
function resetKey(id) {
    const key = apiKeys.find(k => k.id === id);
    if (key) {
        key.used = 0;
        key.history = [];
        save();
        renderAll();
        addAlert('info', `${key.name} usage reset`);
    }
}

// ========== RESET ALL ==========
function resetAll() {
    if (!confirm('Reset all API key usage?')) return;
    apiKeys.forEach(k => { k.used = 0; k.history = []; });
    alerts = [];
    save();
    renderAll();
    addAlert('info', 'All usage data reset');
}

// ========== SIMULATE ==========
function simulateRequests() {
    const keyId = document.getElementById('simulateKey').value;
    const count = parseInt(document.getElementById('simulateCount').value) || 10;

    if (!keyId) return alert('Select an API key first');

    const key = apiKeys.find(k => k.id === parseInt(keyId));
    if (!key) return;

    for (let i = 0; i < count; i++) {
        key.used++;
        const usagePercent = (key.used / key.limit) * 100;

        if (usagePercent >= 100) {
            addAlert('danger', `${key.name}: Rate limit EXCEEDED! (${key.used}/${key.limit})`);
        } else if (usagePercent >= 80) {
            addAlert('warning', `${key.name}: Usage at ${Math.round(usagePercent)}% (${key.used}/${key.limit})`);
        }

        key.history.push({
            time: new Date().toISOString(),
            used: key.used
        });
    }

    // Record usage snapshot
    usageHistory.push({
        time: new Date().toISOString(),
        total: apiKeys.reduce((sum, k) => sum + k.used, 0)
    });

    // Keep only last 50 history entries
    if (usageHistory.length > 50) usageHistory = usageHistory.slice(-50);

    save();
    renderAll();
    updateCharts();
}

// ========== ALERTS ==========
function addAlert(type, message) {
    alerts.unshift({
        type,
        message,
        time: new Date().toISOString()
    });

    if (alerts.length > 50) alerts = alerts.slice(0, 50);
    localStorage.setItem('alerts', JSON.stringify(alerts));
    renderAlerts();
}

// ========== RENDER ==========
function renderAll() {
    renderStats();
    renderTable();
    renderAlerts();
    renderSimulateOptions();
}

function renderStats() {
    document.getElementById('totalKeys').textContent = apiKeys.length;
    document.getElementById('totalRequests').textContent = apiKeys.reduce((sum, k) => sum + k.used, 0);
    document.getElementById('warningCount').textContent = alerts.filter(a => a.type === 'warning').length;
    document.getElementById('blockedCount').textContent = alerts.filter(a => a.type === 'danger').length;
}

function renderTable() {
    const tbody = document.getElementById('keysBody');

    if (apiKeys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No API keys added yet</td></tr>';
        return;
    }

    tbody.innerHTML = apiKeys.map(key => {
        const usagePercent = Math.min((key.used / key.limit) * 100, 100);
        let status = 'ok', statusText = 'OK', progressClass = 'progress-ok';
        if (usagePercent >= 100) { status = 'blocked'; statusText = 'BLOCKED'; progressClass = 'progress-blocked'; }
        else if (usagePercent >= 80) { status = 'warn'; statusText = 'WARNING'; progressClass = 'progress-warn'; }

        const maskedKey = key.key.substring(0, 8) + '••••••••' + key.key.substring(key.key.length - 4);

        return `<tr>
            <td><strong>${key.name}</strong></td>
            <td><span class="key-mask">${maskedKey}</span></td>
            <td>${key.limit}/min</td>
            <td>${key.used}</td>
            <td><span class="status-badge status-${status}">${statusText}</span></td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill ${progressClass}" style="width: ${usagePercent}%"></div>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="resetKey(${key.id})">Reset</button>
                <button class="btn btn-sm btn-danger" onclick="deleteKey(${key.id})">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

function renderAlerts() {
    const log = document.getElementById('alertsLog');

    if (alerts.length === 0) {
        log.innerHTML = '<p class="empty-state">No alerts yet. Add API keys to start monitoring.</p>';
        return;
    }

    log.innerHTML = alerts.slice(0, 20).map(a => {
        const icon = a.type === 'danger' ? '🚫' : a.type === 'warning' ? '⚠️' : 'ℹ️';
        const time = new Date(a.time).toLocaleTimeString();
        return `<div class="alert-item">
            <span>${icon}</span>
            <span class="alert-time">${time}</span>
            <span>${a.message}</span>
        </div>`;
    }).join('');
}

function renderSimulateOptions() {
    const select = document.getElementById('simulateKey');
    select.innerHTML = '<option value="">Select API Key</option>' +
        apiKeys.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
}

// ========== CHARTS ==========
function initCharts() {
    const usageCtx = document.getElementById('usageChart').getContext('2d');
    const serviceCtx = document.getElementById('serviceChart').getContext('2d');

    usageChart = new Chart(usageCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Requests',
                data: [],
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#6c5ce7'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9999b3', font: { size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9999b3', font: { size: 11 } }, beginAtZero: true }
            }
        }
    });

    serviceChart = new Chart(serviceCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#6c5ce7', '#00d2a0', '#ffc048', '#ff4757', '#4da6ff', '#a855f7']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#9999b3', padding: 16 } } }
        }
    });

    updateCharts();
}

function updateCharts() {
    // Usage over time
    const labels = usageHistory.slice(-15).map(h => new Date(h.time).toLocaleTimeString());
    const data = usageHistory.slice(-15).map(h => h.total);
    usageChart.data.labels = labels;
    usageChart.data.datasets[0].data = data;
    usageChart.update();

    // By service
    serviceChart.data.labels = apiKeys.map(k => k.name);
    serviceChart.data.datasets[0].data = apiKeys.map(k => k.used);
    serviceChart.update();
}

// ========== EXPORT / IMPORT ==========
function exportData() {
    const data = { apiKeys, alerts, usageHistory, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-rate-limiter-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addAlert('info', 'Data exported successfully');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.apiKeys) apiKeys = data.apiKeys;
            if (data.alerts) alerts = data.alerts;
            if (data.usageHistory) usageHistory = data.usageHistory;
            save();
            renderAll();
            updateCharts();
            addAlert('info', 'Data imported successfully');
        } catch {
            alert('Invalid backup file');
        }
    };
    reader.readAsText(file);
}

// ========== PERSISTENCE ==========
function save() {
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    localStorage.setItem('alerts', JSON.stringify(alerts));
    localStorage.setItem('usageHistory', JSON.stringify(usageHistory));
}

// ========== LISTENERS ==========
function setupListeners() {
    document.getElementById('addKeyBtn').addEventListener('click', addKey);
    document.getElementById('simulateBtn').addEventListener('click', simulateRequests);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);

    // Enter key to add
    document.getElementById('apiKeyName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addKey();
    });
}
