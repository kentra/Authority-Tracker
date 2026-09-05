// Central mutable game state, shared by every other module.
//
// `state` is exported as a `const` binding — the object itself is mutated
// in place, and its *reference* never changes. This matters because ES
// module bindings for imported `let`/`const` values are read-only from the
// importer's side: another module cannot do `state = {...}` on an imported
// binding. Anywhere the original single-file script replaced the whole
// state object wholesale (on `state_updated` from the server, and on initial
// boot), use `replaceState()` below instead.
export const state = {
    game_id: null,
    activeMatch: null,
    players: 2,
    startingAuth: 50,
    authValues: [],
    playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    users: [
        {name: "Player 1", sid: null, authority: 50},
        {name: "Player 2", sid: null, authority: 50},
        {name: "Player 3", sid: null, authority: 50},
        {name: "Player 4", sid: null, authority: 50},
    ],
    rotations: [0, 0, 0, 0]
};

/**
 * Replace the contents of `state` in place with `newState`, preserving the
 * object identity every module imported. Equivalent to the old
 * `state = { ...newState }` / `state = serverState` reassignments.
 */
export function replaceState(newState) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, newState);
}
