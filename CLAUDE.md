# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Authority Tracker is a mobile-first web app for tracking authority/points in 1-to-4 player card games, themed around *Star Realms*. Frontend is vanilla HTML5/CSS3/ES6+ JavaScript (no build step, no framework). Backend is a single-process FastAPI + python-socketio app that serves the static frontend, exposes a small REST API, and broadcasts live game state over Socket.IO for real-time cross-device sync. Persistence is SQLite via SQLAlchemy.

## Commands

Dependency/environment management uses `uv` (Python 3.13+ required, see `.python-version`).

```bash
# Install dependencies
uv sync

# Run the app from the project root (serves frontend + API on :8090, per main()/uvicorn.run)
uv run python -m app.main

# Run directly with uvicorn (note: README documents :8000, main.py's main() uses :8090 with reload=True)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open `http://localhost:<port>`, or the machine's LAN IP, to test from another device (multi-device sync is a core feature).

There is no test suite or linter currently configured in this repo (no pytest/ruff config, no JS test framework). If asked to add backend tests, use `pytest` (`uv run pytest path/to/test_file.py::test_function_name` for a single test); if asked to lint/format Python, use `ruff` (`uv run ruff check .` / `uv run ruff format .`). Confirm with the user before introducing a frontend test framework.

### Optional AI features

Copy `.env.example` to `.env` to enable:
- `GEMINI_API_KEY` — AI-generated "Live Announcer" game briefings (Gemini API).
- `GOOGLE_APPLICATION_CREDENTIALS` — path to a GCP service account JSON, enables Chirp3 text-to-speech narration of those briefings.

Both are optional; absence just disables `gemini_client`/`tts_client` (checked as `None` before use).

### Deployment

`deploy/authority-tracker.service` is a systemd unit that runs `python -m app.main` from `/opt/Authority-Tracker` (`WorkingDirectory`) via the project's `.venv` — reference for how this is deployed in production, not something you normally need to touch. If `app/`'s location or entry point ever changes, this file (and the actual deployed copy on the server, which is separate from this repo checkout) needs updating too.

## Architecture

### Backend (`app/main.py`, `app/models.py`, `app/schemas.py`, `app/database.py`)

The backend is a proper Python package (`app/`, with `__init__.py`) so modules import each other via relative imports (`from . import database, models, schemas` / `from .database import Base`) rather than flat top-level imports.

- **`database.py`** — SQLite engine (`tracker.db`, created at the project root since the SQLite URL is relative to the process's working directory) + `SessionLocal`/`Base`. `get_db()` is the FastAPI dependency used by REST routes; Socket.IO handlers instead open their own `with database.SessionLocal() as db:` block since they aren't part of the FastAPI DI chain.
- **`models.py`** — SQLAlchemy models: `Game` (one per match, has many `PlayerStat` and `BattleLog`, cascade-deletes), `PlayerStat` (per-player result for a game: name/score/is_winner), `BattleLog` (one row per authority change, used for the in-game log and match history), `ActiveState` — a **single-row table** holding the entire live game state as JSON (`state_data`). This is how server-restart persistence of "the game in progress" works: there's no per-room state, just one global active game.
- **`schemas.py`** — Pydantic request/response models for the REST API only (`GameCreate`/`GameResponse` etc.); the Socket.IO events pass raw dicts, not validated against these schemas.
- **`main.py`** — wires it all together:
  - REST endpoints (`/api/games` GET/POST, `/api/state`, `/api/current_log`, `/api/stats`) are mostly for match history/statistics; they read from `ActiveState`/`Game`/`BattleLog`/`PlayerStat`.
  - Socket.IO events (`connect`, `join_room`, `leave_room`, `start_game`, `state_change`, `log_action`, `request_status_report`) drive live gameplay. `state_change` is the workhorse: on every authority change the whole frontend `state` object is broadcast, upserted into the single `ActiveState` row, and used to keep `PlayerStat` rows in sync (matched by DB row id order, not by an explicit index — see the comment in `state_change`).
  - The `"tts"` room (joined by every client via `join_room`) is used to fan out `play_audio` events (base64 MP3) to all connected clients when the Gemini/TTS "Live Announcer" fires — triggered from `log_action` when a change is `<= -10` or a player is eliminated (`new_score <= 0`).
  - `socket_app = socketio.ASGIApp(sio, other_asgi_app=app)` is the actual ASGI app that gets served; `app` (plain FastAPI) only handles HTTP routes and is wrapped by it.

### Frontend (`index.html`, `static/js/*.js`, `style.css`)

The frontend logic was split from a single `script.js` into native ES modules under `static/js/`, loaded via a single `<script type="module" src="js/main.js">` in `static/index.html` (no bundler/build step — the browser resolves the relative `import`s directly):

- `static/js/state.js` — the single global `state` object (source of truth for player count, names, authority values, per-widget rotation, `game_id`), exported as a stable `const` reference. Because imported `let`/`const` bindings are read-only to other modules, wholesale replacement (on `state_updated` from the server, and on initial boot) goes through `replaceState()` rather than reassigning `state` directly.
- `static/js/dom.js` — cached DOM element references (`const`s), imported by whichever module needs them.
- `static/js/socket.js` — the Socket.IO connection and all `socket.on(...)` handlers, plus `broadcastState()`/`broadcastStartGame()`. `socket.on('state_updated', ...)` (the counterpart to the backend's broadcasts) replaces local `state` wholesale and then either calls `initGame(false)` (if player count changed, i.e. structural re-layout needed) or patches individual DOM nodes (name/value/rotation) for a lighter-weight update. The `isSyncing` flag (exported from this module) prevents echoing a received update back out via `broadcastState()`/`broadcastStartGame()`.
- `static/js/identity.js` — ensures `localStorage.getItem('user')` is set (prompted once on first load) *before* `socket.js` joins the shared `"tts"` room with it; imported as `socket.js`'s first import specifically to guarantee that ordering.
- `static/js/game.js` — core gameplay logic: building tracker widgets, `handleRotate`/`updateWidgetDimension` (see rotation note below), authority adjustment, danger/warning states, endgame sequence.
- `static/js/menu.js` — the menu overlay and its panels (names, rotate, battle log, match history, stats), including the REST fetches for `/api/current_log`, `/api/games`, `/api/stats`.
- `static/js/main.js` — entry point: boots state from `/api/state`, wires up the setup-screen listeners, and (via side-effect imports) pulls in `socket.js`/`menu.js` so their event listeners register.
- `static/js/toast.js` — thin wrapper around the globally-loaded Toastify library.
- Several of these modules import each other circularly (e.g. `game.js` ↔ `socket.js`, `socket.js` ↔ `menu.js`); this is safe only because every cross-module call happens inside an event-handler callback invoked well after the whole module graph has finished loading, never at a module's top level — keep new cross-module calls inside functions/callbacks, not at module top level, or the circular imports will break.
- Faction/player theming is done via CSS custom properties in `style.css` (`--p1-color` … `--p4-color` map to Trade Federation/Blob/Star Empire/Machine Cult respectively) — reuse these variables rather than hardcoding colors.
- Layout is mobile-first and must keep working when a `tracker-widget` is rotated 90/180/270° (`handleRotate`/`updateWidgetDimension` in `static/js/game.js`) to match players seated on different sides of one device; a `ResizeObserver` keeps rotated widgets correctly sized.

### Static assets

The whole frontend lives under `static/` at the project root (`app/main.py` resolves this as `Path(__file__).resolve().parent.parent / "static"`, since `main.py` itself is one level down in `app/`). `static/media/` (images, sound, video, third-party JS libs) is mounted at `/media` via `StaticFiles`; `static/js/` (this app's own ES modules) is likewise mounted at `/js` via `StaticFiles`. `static/index.html`/`static/style.css` are still served by explicit FastAPI routes rather than a generic static mount.

## Conventions

- Python: type hints in signatures, Google-style docstrings for non-trivial functions, `snake_case` for functions/variables, `PascalCase` for classes.
- JavaScript: `camelCase` for functions/variables, modern ES6+ (`let`/`const`, arrow functions, template literals, destructuring); avoid introducing frontend frameworks or heavy dependencies.
- HTML/CSS: `kebab-case` for ids/classes and for CSS custom properties (`--accent-color`).
- Keep animations to `transform`/`opacity` (avoid animating `width`/`height`) for performance, per existing CSS.
