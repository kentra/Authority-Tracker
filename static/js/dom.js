// Cached references to DOM elements used across modules.
// Module scripts are deferred until after the document is fully parsed, so
// every element referenced here is guaranteed to exist by the time this
// module evaluates.
export const setupScreen = document.getElementById('setup-screen');
export const gameScreen = document.getElementById('game-screen');
export const playerBtns = document.querySelectorAll('.player-btn');
export const startBtn = document.getElementById('start-btn');
export const startingAuthInput = document.getElementById('starting-auth');
export const trackerContainer = document.getElementById('tracker-container');
export const menuBtn = document.getElementById('menu-btn');
export const menuBtnEndgame = document.getElementById('endgame-menu-btn');
export const menuOverlay = document.getElementById('menu-overlay');
export const resetBtn = document.getElementById('reset-btn');
export const newGameBtn = document.getElementById('new-game-btn');
export const closeMenuBtn = document.getElementById('close-menu-btn');

export const aiStatusBtn = document.getElementById('ai-status-btn');
export const aiAudioPlayer = document.getElementById('ai-audio-player');

export const mainMenuContent = document.getElementById('main-menu-content');
export const namesMenuContent = document.getElementById('names-menu-content');
export const editNamesBtn = document.getElementById('edit-names-btn');
export const saveNamesBtn = document.getElementById('save-names-btn');
export const cancelNamesBtn = document.getElementById('cancel-names-btn');
export const namesInputsContainer = document.getElementById('names-inputs-container');

export const rotateMenuBtn = document.getElementById('rotate-menu-btn');
export const rotateMenuContent = document.getElementById('rotate-menu-content');
export const closeRotateBtn = document.getElementById('close-rotate-btn');
export const rotateInputsContainer = document.getElementById('rotate-inputs-container');

export const battleLogBtn = document.getElementById('battle-log-btn');
export const battleLogMenuContent = document.getElementById('battle-log-menu-content');
export const closeBattleLogBtn = document.getElementById('close-battle-log-btn');
export const battleLogContainer = document.getElementById('battle-log-container');

export const historyBtn = document.getElementById('history-btn');
export const historyMenuContent = document.getElementById('history-menu-content');
export const closeHistoryBtn = document.getElementById('close-history-btn');
export const historyContainer = document.getElementById('history-container');

export const statsBtn = document.getElementById('stats-btn');
export const statsMenuContent = document.getElementById('stats-menu-content');
export const closeStatsBtn = document.getElementById('close-stats-btn');
export const statsContainer = document.getElementById('stats-container');
export const victoryText = document.getElementById('victory-text');
