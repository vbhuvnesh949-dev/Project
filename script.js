// --- State & DOM ---
let isLogin = true;
let currentTab = 'url';
const API_BASE = 'http://localhost:5000/api'; // Change this to your Render URL

// --- Theme Management ---
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            toggle.innerText = next === 'dark' ? '☀️' : '🌙';
        });
    }
}

// --- Auth Logic ---
function initAuth() {
    const authForm = document.getElementById('auth-form');
    if (!authForm) return;

    document.getElementById('switch-link').addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        document.getElementById('auth-title').innerText = isLogin ? 'Welcome Back' : 'Create Account';
        document.getElementById('auth-subtitle').innerText = isLogin ? 'Login to protect yourself.' : 'Start securing your digital life.';
        document.getElementById('submit-btn').innerText = isLogin ? 'Login' : 'Register';
        document.getElementById('switch-text').innerText = isLogin ? "Don't have an account?" : "Already have an account?";
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const endpoint = isLogin ? '/login' : '/register';

        try {
            const res = await fetch(API_BASE + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('email', data.user.email);
                window.location.href = 'dashboard.html';
            } else {
                alert(data.message || 'Authentication failed');
            }
        } catch (error) {
            // Fallback for static demo without backend
            console.warn('Backend not connected. Running local demo mode.');
            localStorage.setItem('token', 'demo-token');
            localStorage.setItem('email', email);
            window.location.href = 'dashboard.html';
        }
    });
}

// --- Dashboard Logic ---
function initDashboard() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return; // Not on dashboard page

    if (!localStorage.getItem('token')) {
        window.location.href = 'index.html';
        return;
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('email');
        window.location.href = 'index.html';
    });

    // Tab Switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.tab.active').classList.remove('active');
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            document.getElementById('scan-input').placeholder = `Paste ${currentTab.toUpperCase()} content here...`;
        });
    });

    // Scan Logic
    document.getElementById('scan-btn').addEventListener('click', async () => {
        const content = document.getElementById('scan-input').value.trim();
        if (!content) return alert('Please enter content to scan');

        const resultArea = document.getElementById('result-area');
        resultArea.classList.remove('hidden');
        document.getElementById('status-badge').innerText = 'Analyzing...';
        document.getElementById('status-badge').className = 'status-badge';
        document.getElementById('risk-score').innerText = '0';
        document.getElementById('risk-fill').style.width = '0%';

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(API_BASE + '/scan', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ type: currentTab, content })
            });
            const data = await res.json();
            renderResult(data.riskScore, data.status, data.details);
            loadHistory();
        } catch (error) {
            // Fallback Local AI Logic
            console.warn('Backend not connected. Running local AI scan.');
            const localResult = localAIScan(currentTab, content);
            renderResult(localResult.riskScore, localResult.status, localResult.details);
            saveLocalHistory(currentTab, content, localResult.riskScore, localResult.status);
            loadHistory();
        }
    });

    loadHistory();
}

function renderResult(score, status, details) {
    document.getElementById('risk-score').innerText = score;
    document.getElementById('risk-fill').style.width = score + '%';
    
    const badge = document.getElementById('status-badge');
    badge.innerText = status;
    
    if (status === 'Safe') badge.className = 'status-badge safe';
    else if (status === 'Suspicious') badge.className = 'status-badge suspicious';
    else badge.className = 'status-badge high-risk';

    document.getElementById('scan-details').innerText = details;
}

// --- Frontend Fallback AI Logic ---
function localAIScan(type, content) {
    let score = 0;
    const lower = content.toLowerCase();
    const keywords = ['urgent', 'password', 'verify', 'bank', 'wire', 'click here', 'free', 'gift', 'ssn', 'credit card'];
    
    keywords.forEach(kw => { if (lower.includes(kw)) score += 15; });
    
    if (type === 'url') {
        if (content.startsWith('http://')) score += 30;
        if (content.match(/\d+\.\d+\.\d+\.\d+/)) score += 40;
        if (content.length > 60) score += 20;
    } else if (type === 'email') {
        if (!lower.includes('unsubscribe')) score += 20;
        if (lower.includes('dear customer')) score += 15;
    } else if (type === 'sms') {
        if (content.length < 50 && score > 0) score += 20;
        if (lower.includes('reply') || lower.includes('stop')) score += 15;
    }

    score = Math.min(score, 100);
    const status = score > 70 ? 'High Risk' : score > 35 ? 'Suspicious' : 'Safe';
    const details = status === 'Safe' ? 'No immediate threat indicators found. Always stay vigilant.' : 'Multiple suspicious indicators detected. Do not click links or provide personal information.';
    
    return { riskScore: score, status, details };
}

// --- History Management ---
function saveLocalHistory(type, content, score, status) {
    let history = JSON.parse(localStorage.getItem('localHistory') || '[]');
    history.unshift({ type, content, riskScore: score, status, date: new Date().toISOString() });
    localStorage.setItem('localHistory', JSON.stringify(history));
}

async function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '<div class="empty-state">Loading history...</div>';

    let history = [];
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(API_BASE + '/history', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) history = await res.json();
        else throw new Error('Not connected');
    } catch (error) {
        // Load local fallback history
        history = JSON.parse(localStorage.getItem('localHistory') || '[]');
    }

    if (history.length === 0) {
        list.innerHTML = '<div class="empty-state">Your recent scans will appear here.</div>';
        return;
    }

    list.innerHTML = history.map(item => `
        <div class="history-item" style="border-left-color: ${item.status === 'Safe' ? '#10b981' : item.status === 'Suspicious' ? '#f59e0b' : '#ef4444'}">
            <div class="history-type">${item.type}</div>
            <div class="history-content">${item.content.substring(0, 50)}...</div>
            <div class="history-status" style="color: ${item.status === 'Safe' ? '#10b981' : item.status === 'Suspicious' ? '#f59e0b' : '#ef4444'}">
                ${item.status} (Risk: ${item.riskScore}%)
            </div>
        </div>
    `).join('');
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAuth();
    initDashboard();
});
