// Socket.IO connection and all real-time event handlers.
//
// Note: this module and game.js import from each other (game.js calls
// `broadcastState`/reads `isSyncing`; this module calls back into game.js
// to apply incoming state). That's a circular import, but it's safe here
// because every cross-module call happens inside an event-handler callback
// (invoked later, after user interaction or a server push) rather than at
// module-evaluation time — so by the time any of these functions actually
// run, the whole module graph has finished loading.
import './identity.js'; // must run before we join the "tts" room below
import { state, replaceState } from './state.js';
import { setupScreen, gameScreen, battleLogMenuContent, aiAudioPlayer } from './dom.js';
import { toast } from './toast.js';
import { initGame, updateWidgetDimension, updateDiff, update_dom } from './game.js';
import { renderLogEntry } from './menu.js';

export const socket = io();
export let isSyncing = false;

socket.on('connect', (data) => {
    console.debug("Socket connected with user: " + localStorage.getItem("user") + " sid: " + socket.id)
    toast("SocketIO connected with user: " + localStorage.getItem("user"))
});

socket.on('disconnect', (data) => {
    console.debug("Socket connected - sid: " + socket.id)
    toast("SocketIO disconnected")
});

// Request to join a specific room
const roomName = "tts";
socket.emit('join_room', { room: roomName, user: localStorage.getItem('user') });

// Listen for a confirmation or messages from that room
socket.on('status', (data) => {
    console.debug("Current status:", data);
    toast(data["message"])
});

socket.on('state_updated', (newState) => {
    isSyncing = true;
    // Check if player count changed
    const needsReinit = state.players !== newState.players;

    // Update state
    replaceState(newState);
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
            update_dom()
        }

        // Ensure screens are correct
        setupScreen.classList.remove('active');
        gameScreen.classList.add('active');
    }
    isSyncing = false;
});

export function broadcastState() {
    if (!isSyncing) {
        socket.emit('state_change', state);
    }
}

export function broadcastStartGame() {
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

socket.on('play_audio', (data) => {
    const audioSrc = 'data:audio/mp3;base64,' + data.audio;
    aiAudioPlayer.src = audioSrc;
    aiAudioPlayer.play().catch(e => console.error("Audio play failed:", e));
});

export function sendDirectMessage(targetSid, text) {
    socket.emit('private_message', {
        recipient_sid: targetSid,
        message: text
    });
}
