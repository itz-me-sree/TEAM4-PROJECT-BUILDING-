
let state = {
    activeSector: 'hospital',
    tokens: [],
    users: [],
    currentUser: null,
    currentView: 'admin',
    selectedDept: null,
    activeCounter: "1"
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initLucide();
    loadState();
    setupNav();
    updateAuthUI();

    // Default to admin view check
    if (state.currentUser && state.currentUser.role === 'staff') {
        refreshViews();
    } else {
        openAuthModal();
    }

    window.addEventListener('storage', () => {
        loadState();
        refreshViews();
    });

    const counterSelect = document.getElementById('counter-select');
    if (counterSelect) {
        counterSelect.addEventListener('change', (e) => {
            state.activeCounter = e.target.value;
            refreshAdmin();
        });
    }

    // Auto refresh lobby every 5 seconds for visual updates
    setInterval(() => {
        if (state.currentView === 'lobby') {
            loadState(); // force reload from storage
            refreshLobby();
        }
    }, 5000);
});

function initLucide() {
    if (window.lucide) lucide.createIcons();
}

function loadState() {
    const saved = localStorage.getItem('queue_state_v3');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
    }

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
    }

    // Ensure activeSector is synced
    const savedSector = localStorage.getItem('activeSector');
    if (savedSector) state.activeSector = savedSector;
}

function saveState() {
    localStorage.setItem('queue_state_v3', JSON.stringify({
        tokens: state.tokens,
        users: state.users,
        activeSector: state.activeSector
    }));
    refreshViews();
}

// NAVIGATION & VIEWS
function setupNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (e.target.getAttribute('onclick')) return; // Allow proper redirects
            e.preventDefault();
            const view = e.target.getAttribute('data-view');
            switchView(view);
        });
    });
}

function switchView(viewId) {
    if (state.currentView === viewId) return;

    if (viewId === 'admin' && (!state.currentUser || state.currentUser.role !== 'staff')) {
        showToast("Staff authentication required.", "danger");
        openAuthModal();
        return;
    }

    const currentSection = document.getElementById(`${state.currentView}-view`);
    const nextSection = document.getElementById(`${viewId}-view`);

    if (currentSection) currentSection.classList.remove('view-active');
    if (nextSection) {
        nextSection.classList.add('view-active');
        state.currentView = viewId;
        refreshViews();
    }

    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-view') === viewId);
    });
}

function refreshViews() {
    if (state.currentView === 'admin') refreshAdmin();
    if (state.currentView === 'lobby') refreshLobby();
}

// AUTHENTICATION LOGIC (Simplified for Admin)
function openAuthModal() {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('auth-modal').style.display = 'block';
}

function closeAllModals() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('auth-modal').style.display = 'none';
}

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if (!email || !pass) return showToast("Fields required.", "warning");

    if (email.includes('staff')) {
        state.currentUser = { id: 'staff-1', name: 'Duty Manager', email: email, role: 'staff' };
        localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
        updateAuthUI();
        showToast(`Welcome, ${state.currentUser.name}`, "success");
        closeAllModals();
        refreshViews();
    } else {
        return showToast("Admin access only (use staff@example.com).", "danger");
    }
}

function updateAuthUI() {
    // No auth UI in top bar for admin, handled internally
}

// ADMIN LOGIC
function refreshAdmin() {
    const list = document.getElementById('admin-queue-list');
    const waiting = state.tokens.filter(t => t.status === 'waiting' && t.sector === state.activeSector).sort((a, b) => a.timestamp - b.timestamp);
    const servingHere = state.tokens.find(t => t.status === 'serving' && t.counter === state.activeCounter && t.sector === state.activeSector);
    document.getElementById('serving-token').innerText = servingHere ? servingHere.number : '--';
    list.innerHTML = waiting.map(t => `
        <div class="glass-card" style="padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
            <div><strong>${t.number}</strong><br><small>${t.name}</small></div>
            <span>${t.type.toUpperCase()}</span>
        </div>
    `).join('');
}

function callNext() {
    const serving = state.tokens.find(t => t.status === 'serving' && t.counter === state.activeCounter);
    if (serving) serving.status = 'done';
    const waiting = state.tokens.filter(t => t.status === 'waiting' && t.sector === state.activeSector).sort((a, b) => a.timestamp - b.timestamp);
    if (waiting.length > 0) {
        const next = waiting[0];
        next.status = 'serving';
        next.counter = state.activeCounter;
        announceToken(next.number, state.activeCounter);
        saveState();
        showToast(`Calling ${next.number}`, 'accent');
    } else {
        // If we just finished one but no more waiting
        if (serving) saveState();
        refreshAdmin();
    }
}

function repeatCall() {
    const serving = state.tokens.find(t => t.status === 'serving' && t.counter === state.activeCounter);
    if (serving) {
        announceToken(serving.number, state.activeCounter);
        showToast(`Repeating call for ${serving.number}`, 'primary');
    }
}

function announceToken(number, counter) {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.4;
    audio.play().catch(e => console.log("Audio play failed (user interaction needed)"));
    setTimeout(() => {
        const msg = new SpeechSynthesisUtterance();
        msg.text = `Token ${number.split('').join(' ')}, proceed to Counter ${counter}`;
        window.speechSynthesis.speak(msg);
    }, 1000);
}

function refreshLobby() {
    const grid = document.getElementById('lobby-serving-grid');
    const waitingList = document.getElementById('lobby-waiting-list');

    const serving = state.tokens.filter(t => t.status === 'serving' && t.sector === state.activeSector).sort((a, b) => a.counter - b.counter);
    grid.innerHTML = serving.map(t => `
        <div class="glass-card" style="text-align: center; padding: 2rem;">
            <h3>DESK ${t.counter}</h3>
            <div class="counter-token">${t.number}</div>
        </div>
    `).join('') || "<h3 style='grid-column: 1/-1; text-align:center;'>All counters available.</h3>";

    const waiting = state.tokens.filter(t => t.status === 'waiting' && t.sector === state.activeSector).slice(0, 10);
    waitingList.innerHTML = waiting.map(t => `
        <div class="glass-card" style="min-width: 150px; text-align: center; padding: 1rem;">
            <div style="font-size: 2rem; font-weight: 800; color: var(--text-primary);">${t.number}</div>
            <div style="font-size: 0.8rem; opacity: 0.7;">${t.type}</div>
        </div>
    `).join('') || "<div style='padding: 1rem;'>No tokens in queue.</div>";
}


function showToast(msg, type = 'primary') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderLeftColor = `var(--${type})`;
    t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 4000);
}
