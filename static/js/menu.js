// Menu overlay: opening/closing panels, and the battle log / match history /
// stats panels that fetch from the REST API.
import { state } from './state.js';
import {
    mainMenuContent, namesMenuContent, rotateMenuContent, battleLogMenuContent,
    historyMenuContent, statsMenuContent, menuOverlay, menuBtn, menuBtnEndgame,
    closeMenuBtn, aiStatusBtn, battleLogBtn, closeBattleLogBtn, battleLogContainer,
    historyBtn, closeHistoryBtn, historyContainer, statsBtn, closeStatsBtn, statsContainer,
    editNamesBtn, namesInputsContainer, rotateMenuBtn, closeRotateBtn, rotateInputsContainer,
    cancelNamesBtn, saveNamesBtn, resetBtn, newGameBtn, gameScreen, setupScreen
} from './dom.js';
import { socket, broadcastState, broadcastStartGame } from './socket.js';
import { handleRotate, resetGame, menuButtonEndgame } from './game.js';

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
// --- Event Listeners: Menu ---
menuBtnEndgame.addEventListener('click', () => {
    resetGame()
    menuButtonEndgame()
});

closeMenuBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
});

export function renderLogEntry(log, prepend = false) {
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

aiStatusBtn.addEventListener('click', () => {
    socket.emit('request_status_report');
    menuOverlay.classList.add('hidden');
});

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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        btn.style.borderColor = `var(--p${i + 1}-color)`;
        btn.style.color = `var(--p${i + 1}-color)`;
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

// NOTE: this duplicates the cancelNamesBtn listener above (identical
// duplicate registration existed in the original single-file script.js too
// — both fire on click, harmlessly). Kept as-is rather than silently
// "fixing" behavior during a refactor; worth cleaning up separately.
cancelNamesBtn.addEventListener('click', () => {
    namesMenuContent.classList.add('hidden');
    mainMenuContent.classList.remove('hidden');
});

newGameBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    gameScreen.classList.remove('active');
    setupScreen.classList.add('active');
});
