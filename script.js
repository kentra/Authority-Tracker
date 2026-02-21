// State
let state = {
    players: 2,
    startingAuth: 50,
    authValues: [],
    playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    rotations: [0, 0, 0, 0]
};

let resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        updateWidgetDimension(entry.target);
    }
});

// Timers for diff accumulation (e.g., rapid clicking +1 +1 +1 shows +3)
let diffTimers = {};
let currentDiffs = {};

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const playerBtns = document.querySelectorAll('.player-btn');
const startBtn = document.getElementById('start-btn');
const startingAuthInput = document.getElementById('starting-auth');
const trackerContainer = document.getElementById('tracker-container');
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const resetBtn = document.getElementById('reset-btn');
const newGameBtn = document.getElementById('new-game-btn');
const closeMenuBtn = document.getElementById('close-menu-btn');

const mainMenuContent = document.getElementById('main-menu-content');
const namesMenuContent = document.getElementById('names-menu-content');
const editNamesBtn = document.getElementById('edit-names-btn');
const saveNamesBtn = document.getElementById('save-names-btn');
const cancelNamesBtn = document.getElementById('cancel-names-btn');
const namesInputsContainer = document.getElementById('names-inputs-container');

// --- Event Listeners: Setup ---
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.players = parseInt(e.target.dataset.count);
    });
});

startBtn.addEventListener('click', () => {
    let auth = parseInt(startingAuthInput.value);
    if (isNaN(auth) || auth < 1) auth = 50;
    state.startingAuth = auth;
    
    initGame();
});

// --- Event Listeners: Menu ---
menuBtn.addEventListener('click', () => {
    mainMenuContent.classList.remove('hidden');
    namesMenuContent.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
});

closeMenuBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
});

editNamesBtn.addEventListener('click', () => {
    mainMenuContent.classList.add('hidden');
    namesMenuContent.classList.remove('hidden');
    
    // Populate inputs
    namesInputsContainer.innerHTML = '';
    for (let i = 0; i < state.players; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'name-input';
        input.value = state.playerNames[i];
        input.dataset.index = i;
        namesInputsContainer.appendChild(input);
    }
});

cancelNamesBtn.addEventListener('click', () => {
    namesMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
});

saveNamesBtn.addEventListener('click', () => {
    const inputs = namesInputsContainer.querySelectorAll('.name-input');
    inputs.forEach(input => {
        const idx = parseInt(input.dataset.index);
        state.playerNames[idx] = input.value.trim() || `Player ${idx + 1}`;
        
        // Update DOM
        const nameEl = document.getElementById(`name-display-${idx}`);
        if (nameEl) nameEl.textContent = state.playerNames[idx];
    });
    
    namesMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
});

resetBtn.addEventListener('click', () => {
    resetGame();
    menuOverlay.classList.add('hidden');
});

newGameBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    gameScreen.classList.remove('active');
    setupScreen.classList.add('active');
});

// --- Game Logic ---
function initGame() {
    // Initialize authority values
    state.authValues = Array(state.players).fill(state.startingAuth);
    
    // Initialize default rotations based on player count
    if (state.players === 2) {
        state.rotations = [180, 0, 0, 0];
    } else {
        state.rotations = [0, 0, 0, 0];
    }
    
    // Clear existing trackers
    trackerContainer.innerHTML = '';
    
    // Disconnect old observer
    resizeObserver.disconnect();
    
    // Set layout classes
    trackerContainer.className = `players-${state.players}`;
    
    // Generate tracker HTML
    for (let i = 0; i < state.players; i++) {
        const pNum = i + 1;
        const widget = document.createElement('div');
        widget.className = 'tracker-widget';
        widget.dataset.player = pNum;
        
        widget.innerHTML = `
            <div class="inner-widget">
                <button class="rotate-btn" data-player="${i}" aria-label="Rotate Widget">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6M3 12a9 9 0 1 0 2.63-6.37L2 8"/></svg>
                </button>
                <div class="player-name" id="name-display-${i}">${state.playerNames[i]}</div>
                <div class="auth-display">
                    <div class="auth-value" id="auth-val-${i}">${state.startingAuth}</div>
                    <div class="auth-history" id="auth-hist-${i}">0</div>
                </div>
                
                <div class="controls-row">
                    <button class="adj-btn minus" data-player="${i}" data-amount="-5">-5</button>
                    <button class="adj-btn minus" data-player="${i}" data-amount="-1">-1</button>
                    <button class="adj-btn plus" data-player="${i}" data-amount="1">+1</button>
                    <button class="adj-btn plus" data-player="${i}" data-amount="5">+5</button>
                </div>
            </div>
        `;
        trackerContainer.appendChild(widget);
        resizeObserver.observe(widget);
    }
    
    // Add listeners to new buttons
    document.querySelectorAll('.adj-btn').forEach(btn => {
        btn.addEventListener('click', handleAdjustment);
        // Prevent double fire on touch devices
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); btn.click(); }, {passive: false});
    });

    document.querySelectorAll('.rotate-btn').forEach(btn => {
        btn.addEventListener('click', handleRotate);
    });

    // Switch screens
    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

function handleRotate(e) {
    const btn = e.currentTarget;
    const playerIdx = parseInt(btn.dataset.player);
    state.rotations[playerIdx] = (state.rotations[playerIdx] + 90) % 360;
    
    const widget = btn.closest('.tracker-widget');
    updateWidgetDimension(widget);
}

function updateWidgetDimension(widget) {
    const idx = parseInt(widget.dataset.player) - 1;
    const inner = widget.querySelector('.inner-widget');
    if (!inner) return;
    
    const rot = state.rotations[idx];
    const w = widget.clientWidth;
    const h = widget.clientHeight;
    
    if (rot === 90 || rot === 270) {
        inner.style.width = `${h}px`;
        inner.style.height = `${w}px`;
    } else {
        inner.style.width = `${w}px`;
        inner.style.height = `${h}px`;
    }
    inner.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
}

function handleAdjustment(e) {
    const playerIdx = parseInt(e.target.dataset.player);
    const amount = parseInt(e.target.dataset.amount);
    
    updateAuthority(playerIdx, amount);
}

function updateAuthority(playerIdx, amount) {
    // Update raw value
    state.authValues[playerIdx] += amount;
    
    // Prevent negative numbers (optional depending on game rules, but standard is 0 means dead)
    if (state.authValues[playerIdx] < 0) {
        state.authValues[playerIdx] = 0;
    }
    
    // Update DOM Value
    const valEl = document.getElementById(`auth-val-${playerIdx}`);
    valEl.textContent = state.authValues[playerIdx];
    
    // Pop animation
    valEl.classList.remove('pop');
    void valEl.offsetWidth; // trigger reflow
    valEl.classList.add('pop');
    
    // Handle Diff (History)
    updateDiff(playerIdx, amount);
}

function updateDiff(playerIdx, amount) {
    const histEl = document.getElementById(`auth-hist-${playerIdx}`);
    
    // Initialize or accumulate diff
    currentDiffs[playerIdx] = (currentDiffs[playerIdx] || 0) + amount;
    
    const diff = currentDiffs[playerIdx];
    const sign = diff > 0 ? '+' : '';
    histEl.textContent = `${sign}${diff}`;
    
    // Set color class
    histEl.className = 'auth-history visible';
    if (diff > 0) histEl.classList.add('positive');
    else if (diff < 0) histEl.classList.add('negative');
    
    // Reset timer
    if (diffTimers[playerIdx]) clearTimeout(diffTimers[playerIdx]);
    
    // Fade out diff after 2 seconds of inactivity
    diffTimers[playerIdx] = setTimeout(() => {
        histEl.classList.remove('visible');
        currentDiffs[playerIdx] = 0;
    }, 2000);
}

function resetGame() {
    for (let i = 0; i < state.players; i++) {
        state.authValues[i] = state.startingAuth;
        document.getElementById(`auth-val-${i}`).textContent = state.startingAuth;
        document.getElementById(`auth-hist-${i}`).classList.remove('visible');
        currentDiffs[i] = 0;
    }
}
