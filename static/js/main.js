// Entry point: bootstraps state from the server, wires up the setup-screen
// listeners, and (via side-effect imports) registers every other module's
// event listeners. This is the only file loaded from index.html
// (`<script type="module" src="js/main.js">`).
import { state, replaceState } from './state.js';
import { playerBtns, startBtn, startingAuthInput } from './dom.js';
import { initGame } from './game.js';
import { broadcastStartGame } from './socket.js';
import './menu.js';

// --- Initialization ---
async function bootGame() {
    try {
        const response = await fetch('/api/state');
        if (response.ok) {
            const serverState = await response.json();
            if (serverState) {
                replaceState(serverState);
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
