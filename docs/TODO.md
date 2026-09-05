# To-Do List

## High Priority
- [x] **SQLite Database Integration**: Implement SQLite with SQLAlchemy (or similar ORM) in FastAPI to persistently store game histories and player statistics.
- [x] **Match History API**: Create endpoints to retrieve past games, showing the outcome, total score, and duration.
- [x] **Player Statistics**: Track wins, losses, average score, and favorite factions for returning player names.

## Medium Priority
- [x] **State Persistence**: Currently, if the server restarts, active game state is lost. Consider saving active state to SQLite or Redis to survive reboots.
- [ ] **Frontend Testing**: Introduce a lightweight testing framework (like Jest) for the vanilla JS logic.
- [ ] **Backend Testing**: Add unit tests using `pytest` for the FastAPI routes and Socket.IO events.
- [x] **Text-to-Speech:** All AI-generated briefings can be read aloud using Gemini's TTS engine, giving your game a "Ship AI" voice.

## Low Priority
- [ ] **PWA Support**: Add a `manifest.json` and service worker so the app can be installed natively on iOS/Android as a Progressive Web App (PWA).
- [ ] **Custom Starting Settings**: Allow customizing the increments/decrements (+1, -1, +5, -5) based on the specific game being played, expanding beyond *Star Realms*.