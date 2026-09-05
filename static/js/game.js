// Core gameplay logic: building the tracker widgets, adjusting authority,
// rotation, danger/warning states, and the endgame sequence.
import { state } from './state.js';
import { trackerContainer, setupScreen, gameScreen, victoryText, menuBtn } from './dom.js';
import { socket, isSyncing, broadcastState } from './socket.js';

// Timers for diff accumulation (e.g., rapid clicking +1 +1 +1 shows +3)
let diffTimers = {};
let currentDiffs = {};

let resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        updateWidgetDimension(entry.target);
    }
});

// --- Game Logic ---
export function initGame(isNewGame = true) {
    if (isNewGame) {
        // Initialize authority values
        state.authValues = Array(state.players).fill(state.startingAuth);

        // Initialize default rotations based on player count
        if (state.players === 2) {
            state.rotations = [0, 0, 0, 0];
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
            <div class="inner-widget" id="inner-widget-${i}">
                <div class="player-name-glow" id="name-display-${i}">${state.playerNames[i]}</div>
                <div class="auth-display" id="auth-display-${i}">
                    <div class="auth-value" id="auth-val-${i}">${state.startingAuth}</div>
                    <div class="auth-history" id="auth-hist-${i}">0</div>
                </div>
                <div class="skull-container" id="skull-container-${i}">
                    <img src="media/pic/skull.png" class="skull">
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
        var minusFiveSoundRef = new Audio('media/sound/4f.wav');
        var minusOneSoundRef = new Audio('media/sound/D61.wav');
        var plusOneSoundRef = new Audio('media/sound/7E.wav');
        var plusFiveSoundRef = new Audio('media/sound/bA.wav');
        btn.addEventListener('click', function(e) {
            handleAdjustment(e)
            if (btn.getAttribute("data-amount") == "-5") {
                minusFiveSoundRef.play()
            }
            else if (btn.getAttribute("data-amount") == "-1") {
                minusOneSoundRef.play()
            }
            else if (btn.getAttribute("data-amount") == "1") {
                plusOneSoundRef.play()
            }
            else if (btn.getAttribute("data-amount") == "5") {
                plusFiveSoundRef.play()
            }
        });
        // Prevent double fire on touch devices
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); btn.click(); }, { passive: false });
    });

    // Switch screens
    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

export function handleRotate(e) {
    const btn = e.currentTarget;
    const playerIdx = parseInt(btn.dataset.player);
    state.rotations[playerIdx] = (state.rotations[playerIdx] + 90) % 360;

    // const widget = document.querySelector(`.tracker-widget[data-player="${playerIdx + 1}"]`);
    const widget = document.querySelector(`.tracker-widget[data-player="${playerIdx}"]`);
    if (widget) {
        updateWidgetDimension(widget);
    }
    broadcastState();
}

export function updateWidgetDimension(widget) {
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

export function handleAdjustment(e) {
    const playerIdx = parseInt(e.target.dataset.player);
    const amount = parseInt(e.target.dataset.amount);
    updateAuthority(playerIdx, amount);
}

export function updateAuthority(playerIdx, amount) {
    var newGameAudioRef = new Audio('media/sound/Dh.wav');

    // Update raw value
    state.authValues[playerIdx] += amount;

    // Prevent negative numbers (optional depending on game rules, but standard is 0 means dead)
    if (state.authValues[playerIdx] <= 0) {
        state.authValues[playerIdx] = 0;
        newGameAudioRef.play();
        victoryText.textContent = state.playerNames[playerIdx] + " got dominated"
        runEndgame();
    }

    update_dom();

    // Handle Diff (History)
    updateDiff(playerIdx, amount);

    broadcastState(playerIdx);
}

export function update_dom() {
    for (let playerIdx = 0; playerIdx < state.players; playerIdx++) {
        const skull = document.getElementById(`skull-container-${playerIdx}`);
        const valEl = document.getElementById(`auth-val-${playerIdx}`);
        valEl.textContent = state.authValues[playerIdx];

        if (state.authValues[playerIdx] <= 15 && !valEl.classList.contains("danger") && !skull.classList.contains("danger")){
            valEl.classList.add("danger")
            skull.classList.add("danger")
            skull.classList.remove("warning")
        }
        else if (state.authValues[playerIdx] >= 16 && valEl.classList.contains("danger") && skull.classList.contains("danger")){
            valEl.classList.remove("danger")
            skull.classList.remove("danger")
            valEl.classList.add("warning")
            skull.classList.add("warning")
        }
        else if (state.authValues[playerIdx] <= 30 && !valEl.classList.contains("warning") && !skull.classList.contains("warning")){
            valEl.classList.add("warning")
            skull.classList.add("warning")
        }
        else if (state.authValues[playerIdx] >= 31 && valEl.classList.contains("warning") && skull.classList.contains("warning")){
            valEl.classList.remove("warning")
            skull.classList.remove("warning")
        }
        // Pop animation
        valEl.classList.remove('pop');
        void valEl.offsetWidth; // trigger reflow
        valEl.classList.add('pop');
    }
}

export function updateDiff(playerIdx, amount) {
    const histEl = document.getElementById(`auth-hist-${playerIdx}`);

    // Initialize or accumulate diff
    currentDiffs[playerIdx] = (currentDiffs[playerIdx] || 0) + amount;

    const diff = currentDiffs[playerIdx];
    const sign = diff > 0 ? '+' : '';
    histEl.textContent = `${sign}${diff}`;

    // Set color class
    histEl.className = 'auth-history visible';
    if (diff > 0) {
        histEl.classList.add('positive');
    }
    else if (diff < 0) {
        histEl.classList.add('negative');
    }

    // Reset timer
    if (diffTimers[playerIdx]) clearTimeout(diffTimers[playerIdx]);

    // Fade out diff after 2 seconds of inactivity and log the action
    diffTimers[playerIdx] = setTimeout(() => {
        histEl.classList.remove('visible');

        if (currentDiffs[playerIdx] !== 0) {
            const log_data = {
                timestamp: new Date().toISOString(),
                player_name: state.playerNames[playerIdx],
                amount_changed: currentDiffs[playerIdx],
                new_score: state.authValues[playerIdx]
            };
            if (!isSyncing) {
                // main.py's log_action(sid, log_data) handler reads
                // log_data["timestamp"] etc. directly, so send the fields
                // unwrapped rather than nested under a "log_data" key.
                socket.emit('log_action', log_data);
            }
        }

        currentDiffs[playerIdx] = 0;
    }, 2000);
}

export function runEndgame() {
    player.show()
    player.autoplay("muted")
    var overlay = document.getElementById("endgame-overlay")
    overlay.className += " show";

    var explosion = document.getElementById("videojs-endgame_html5_api")
    explosion.className += " explosion-video"
}

export function menuButtonEndgame() {
    player.hide()
    player.autoplay("muted")
    var overlay = document.getElementById("endgame-overlay")
    overlay.className = "endgame-overlay";

    var explosion = document.getElementById("videojs-endgame_html5_api")
    explosion.className = "videojs-endgame_html5_api"
    menuBtn.click()
}

export function resetGame() {
    state.battleLog = [];
    for (let i = 0; i < state.players; i++) {
        state.authValues[i] = state.startingAuth;
        document.getElementById(`skull-container-${i}`).classList.remove("danger");
        document.getElementById(`skull-container-${i}`).classList.remove("warning");
        document.getElementById(`auth-val-${i}`).textContent = state.startingAuth;
        document.getElementById(`auth-val-${i}`).classList.remove("danger");
        document.getElementById(`auth-val-${i}`).classList.remove("warning");
        document.getElementById(`auth-hist-${i}`).classList.remove('visible');
        currentDiffs[i] = 0;
    }
}
