// State
let state = {
    game_id: null,
    players: 2,
    startingAuth: 50,
    authValues: [],
    playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    rotations: [0, 0, 0, 0]
};

// Socket.IO
const socket = io();
let isSyncing = false;

socket.on('state_updated', (newState) => {
    isSyncing = true;
    
    // Check if player count changed
    const needsReinit = state.players !== newState.players;
    
    // Update state
    state = { ...newState };
    
    if (needsReinit) {
        initGame(false);
    } else {
        // Just update DOM elements
        for (let i = 0; i < state.players; i++) {
            // Name
            const nameEl = document.getElementById(`name-display-${i}`);
            if (nameEl) nameEl.textContent = state.playerNames[i];
            
            // Value
            const valEl = document.getElementById(`auth-val-${i}`);
            if (valEl && parseInt(valEl.textContent) !== state.authValues[i]) {
                const diff = state.authValues[i] - parseInt(valEl.textContent);
                valEl.textContent = state.authValues[i];
                valEl.classList.remove('pop');
                void valEl.offsetWidth; // trigger reflow
                valEl.classList.add('pop');
                
                // Show diff
                updateDiff(i, diff);
            }
            
            // Rotation
            const widget = document.querySelector(`.tracker-widget[data-player="${i + 1}"]`);
            if (widget) {
                updateWidgetDimension(widget);
            }
        }
        
        // Ensure screens are correct
        setupScreen.classList.remove('active');
        gameScreen.classList.add('active');
    }
    isSyncing = false;
});

function broadcastState() {
    if (!isSyncing) {
        socket.emit('state_change', state);
    }
}

function broadcastStartGame() {
    if (!isSyncing) {
        socket.emit('start_game', state);
    }
}

// Append new actions to the log if the menu is open
socket.on('action_logged', (log_data) => {
    if (!battleLogMenuContent.classList.contains('hidden')) {
        renderLogEntry(log_data, true);
    }
});

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
const endGameBtn = document.getElementById('end-game-btn');

const mainMenuContent = document.getElementById('main-menu-content');
const namesMenuContent = document.getElementById('names-menu-content');
const editNamesBtn = document.getElementById('edit-names-btn');
const saveNamesBtn = document.getElementById('save-names-btn');
const cancelNamesBtn = document.getElementById('cancel-names-btn');
const namesInputsContainer = document.getElementById('names-inputs-container');

const rotateMenuBtn = document.getElementById('rotate-menu-btn');
const rotateMenuContent = document.getElementById('rotate-menu-content');
const closeRotateBtn = document.getElementById('close-rotate-btn');
const rotateInputsContainer = document.getElementById('rotate-inputs-container');

const battleLogBtn = document.getElementById('battle-log-btn');
const battleLogMenuContent = document.getElementById('battle-log-menu-content');
const closeBattleLogBtn = document.getElementById('close-battle-log-btn');
const battleLogContainer = document.getElementById('battle-log-container');

const historyBtn = document.getElementById('history-btn');
const historyMenuContent = document.getElementById('history-menu-content');
const closeHistoryBtn = document.getElementById('close-history-btn');
const historyContainer = document.getElementById('history-container');

const statsBtn = document.getElementById('stats-btn');
const statsMenuContent = document.getElementById('stats-menu-content');
const closeStatsBtn = document.getElementById('close-stats-btn');
const statsContainer = document.getElementById('stats-container');

// --- Initialization ---
async function bootGame() {
    try {
        const response = await fetch('/api/state');
        if (response.ok) {
            const serverState = await response.json();
            if (serverState) {
                state = serverState;
                initGame(false);
                return;
            }
        }
    } catch (e) {
        console.warn("Could not load initial state from server", e);
    }
    // Fallback or nothing to load
}

bootGame();

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
    broadcastStartGame();
});

// --- Event Listeners: Menu ---
menuBtn.addEventListener('click', () => {
    mainMenuContent.classList.remove('hidden');
    namesMenuContent.classList.add('hidden');
    rotateMenuContent.classList.add('hidden');
    battleLogMenuContent.classList.add('hidden');
    historyMenuContent.classList.add('hidden');
    statsMenuContent.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
});

closeMenuBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
});

function renderLogEntry(log, prepend = false) {
    // Remove "no actions" message if it exists
    if (battleLogContainer.innerHTML.includes('No actions logged yet')) {
        battleLogContainer.innerHTML = '';
    }
    
    const card = document.createElement('div');
    card.className = 'data-card';
    
    const d = new Date(log.timestamp).toLocaleTimeString();
    const actionText = log.amount_changed > 0 ? `gained ${log.amount_changed}` : `lost ${Math.abs(log.amount_changed)}`;
    const actionColor = log.amount_changed > 0 ? 'color: #0f0' : 'color: #f00';
    
    card.innerHTML = `
        <div style="font-size: 0.8rem; color: #888;">${d}</div>
        <strong style="margin: 2px 0;">${log.player_name}</strong>
        <div style="${actionColor}">Authority ${actionText}</div>
        <div style="font-size: 0.8rem;">New Score: ${log.new_score}</div>
    `;
    
    if (prepend) {
        battleLogContainer.prepend(card);
    } else {
        battleLogContainer.appendChild(card);
    }
}

battleLogBtn.addEventListener('click', async () => {
    mainMenuContent.classList.add('hidden');
    battleLogMenuContent.classList.remove('hidden');
    
    battleLogContainer.innerHTML = '<p>Loading...</p>';
    
    try {
        const res = await fetch('/api/current_log');
        const logs = await res.json();
        
        battleLogContainer.innerHTML = '';
        if (logs.length === 0) {
            battleLogContainer.innerHTML = '<p>No actions logged yet.</p>';
            return;
        }
        
        logs.forEach(log => renderLogEntry(log, false));
    } catch(err) {
        battleLogContainer.innerHTML = '<p>Error loading log.</p>';
    }
});

closeBattleLogBtn.addEventListener('click', () => {
    battleLogMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
});

historyBtn.addEventListener('click', async () => {
    mainMenuContent.classList.add('hidden');
    historyMenuContent.classList.remove('hidden');
    historyContainer.innerHTML = '<p>Loading...</p>';
    
    try {
        const res = await fetch('/api/games');
        const games = await res.json();
        
        historyContainer.innerHTML = '';
        if (games.length === 0) {
            historyContainer.innerHTML = '<p>No games played yet.</p>';
            return;
        }
        
        games.forEach(game => {
            const d = new Date(game.date).toLocaleDateString();
            const card = document.createElement('div');
            card.className = 'data-card';
            
            let html = `<strong>Game on ${d}</strong>`;
            game.players.forEach(p => {
                const cls = p.is_winner ? 'winner' : '';
                html += `<div class="${cls}">${p.player_name}: ${p.score} pts ${p.is_winner ? '(Winner)' : ''}</div>`;
            });
            card.innerHTML = html;
            historyContainer.appendChild(card);
        });
    } catch(err) {
        historyContainer.innerHTML = '<p>Error loading history.</p>';
    }
});

closeHistoryBtn.addEventListener('click', () => {
    historyMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
});

statsBtn.addEventListener('click', async () => {
    mainMenuContent.classList.add('hidden');
    statsMenuContent.classList.remove('hidden');
    statsContainer.innerHTML = '<p>Loading...</p>';
    
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        
        statsContainer.innerHTML = '';
        if (stats.length === 0) {
            statsContainer.innerHTML = '<p>No stats available.</p>';
            return;
        }
        
        stats.forEach(s => {
            const card = document.createElement('div');
            card.className = 'data-card';
            card.innerHTML = `
                <strong>${s.player_name}</strong>
                <div>Games Played: ${s.games_played}</div>
                <div class="winner">Wins: ${s.wins}</div>
                <div>Losses: ${s.losses}</div>
                <div>Avg Score: ${s.avg_score}</div>
            `;
            statsContainer.appendChild(card);
        });
    } catch(err) {
        statsContainer.innerHTML = '<p>Error loading stats.</p>';
    }
});

closeStatsBtn.addEventListener('click', () => {
    statsMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
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

rotateMenuBtn.addEventListener('click', () => {
    mainMenuContent.classList.add('hidden');
    rotateMenuContent.classList.remove('hidden');
    
    // Populate rotate buttons
    rotateInputsContainer.innerHTML = '';
    for (let i = 0; i < state.players; i++) {
        const btn = document.createElement('button');
        btn.className = 'menu-btn rotate-player-btn';
        btn.style.borderColor = `var(--p${i+1}-color)`;
        btn.style.color = `var(--p${i+1}-color)`;
        btn.style.background = 'transparent';
        btn.style.borderWidth = '2px';
        btn.style.borderStyle = 'solid';
        btn.textContent = `Rotate ${state.playerNames[i]}`;
        btn.dataset.player = i;
        btn.addEventListener('click', handleRotate);
        rotateInputsContainer.appendChild(btn);
    }
});

closeRotateBtn.addEventListener('click', () => {
    rotateMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
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
    
    broadcastState();
});

resetBtn.addEventListener('click', () => {
    resetGame();
    menuOverlay.classList.add('hidden');
    broadcastStartGame();
});

endGameBtn.addEventListener('click', async () => {
    // Determine winner (highest score)
    let maxScore = -1;
    for (let i = 0; i < state.players; i++) {
        if (state.authValues[i] > maxScore) {
            maxScore = state.authValues[i];
        }
    }
    
    const gameData = {
        player_count: state.players,
        players: [],
        logs: state.battleLog || []
    };
    
    for (let i = 0; i < state.players; i++) {
        gameData.players.push({
            player_name: state.playerNames[i],
            score: state.authValues[i],
            is_winner: state.authValues[i] === maxScore
        });
    }
    
    try {
        endGameBtn.textContent = 'Saving...';
        endGameBtn.disabled = true;
        
        const response = await fetch('/api/games', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameData)
        });
        
        if (response.ok) {
            alert('Game saved successfully!');
            resetGame();
            menuOverlay.classList.add('hidden');
            broadcastState();
        } else {
            alert('Failed to save game.');
        }
    } catch (err) {
        console.error('Error saving game:', err);
        alert('Error saving game.');
    } finally {
        endGameBtn.textContent = 'End Game & Save';
        endGameBtn.disabled = false;
    }
});

newGameBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    gameScreen.classList.remove('active');
    setupScreen.classList.add('active');
});

// --- Game Logic ---
function initGame(isNewGame = true) {
    if (isNewGame) {
        // Initialize authority values
        state.authValues = Array(state.players).fill(state.startingAuth);
        
        // Initialize default rotations based on player count
        if (state.players === 2) {
            state.rotations = [180, 0, 0, 0];
        } else {
            state.rotations = [0, 0, 0, 0];
        }
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

    // Switch screens
    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

function handleRotate(e) {
    const btn = e.currentTarget;
    const playerIdx = parseInt(btn.dataset.player);
    state.rotations[playerIdx] = (state.rotations[playerIdx] + 90) % 360;
    
    const widget = document.querySelector(`.tracker-widget[data-player="${playerIdx + 1}"]`);
    if (widget) {
        updateWidgetDimension(widget);
    }
    broadcastState();
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
    
    broadcastState();
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
    
    // Fade out diff after 2 seconds of inactivity and log the action
    diffTimers[playerIdx] = setTimeout(() => {
        histEl.classList.remove('visible');
        
        if (currentDiffs[playerIdx] !== 0) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                player_name: state.playerNames[playerIdx],
                amount_changed: currentDiffs[playerIdx],
                new_score: state.authValues[playerIdx]
            };
            if (!isSyncing) {
                socket.emit('log_action', logEntry);
            }
        }
        
        currentDiffs[playerIdx] = 0;
    }, 2000);
}

function resetGame() {
    state.battleLog = [];
    for (let i = 0; i < state.players; i++) {
        state.authValues[i] = state.startingAuth;
        document.getElementById(`auth-val-${i}`).textContent = state.startingAuth;
        document.getElementById(`auth-hist-${i}`).classList.remove('visible');
        currentDiffs[i] = 0;
    }
}
