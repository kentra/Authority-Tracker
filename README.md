# Authority Tracker

A mobile-first web app for tracking authority/points in 1-to-4 player card games, themed around *Star Realms*. It's built with vanilla HTML5, CSS3, and JavaScript, backed by a lightweight FastAPI + Socket.IO server for real-time cross-device syncing and persistence.

## Key Features

- Supports 1 to 4 players, with responsive layouts (e.g. the top player's view is inverted for 2 players sitting across from each other).
- Real-time synchronization across multiple devices via Socket.IO.
- Persistent match history and player statistics (wins, losses, average score, favorite factions), stored in SQLite via SQLAlchemy.
- Animated history of rapid point changes (+/-).
- Themed to match Star Realms factions (Blob, Trade Federation, Star Empire, Machine Cult).
- Optional AI-generated game briefings, read aloud via Gemini's text-to-speech engine.

## Getting Started

This project uses [`uv`](https://docs.astral.sh/uv/) to manage the Python environment and dependencies. Python 3.13+ is required.

```bash
# Install dependencies
uv sync

# Run the app
uv run python main.py
# ...or directly with uvicorn:
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then open `http://localhost:8000`, or the machine's local network IP, for mobile testing on another device.

### Optional: AI briefings & text-to-speech

Copy `.env.example` to `.env` and fill in the values to enable AI-generated briefings and voice narration:

```bash
cp .env.example .env
```

- `GEMINI_API_KEY` — enables AI-generated game briefings via the Gemini API.
- `GOOGLE_APPLICATION_CREDENTIALS` — path to a Google Cloud service account JSON file, enables text-to-speech narration of briefings.

Both are optional; the app runs fine without them.

## Project Structure

- `main.py` — FastAPI application: serves the frontend, exposes REST + Socket.IO endpoints, and integrates with Gemini/TTS.
- `models.py` / `schemas.py` / `database.py` — SQLAlchemy models, Pydantic schemas, and DB setup.
- `index.html` / `style.css` / `script.js` — the frontend application.
- `media/` — static media assets.

## Contributing

See [AGENTS.md](AGENTS.md) for code style guidelines, naming conventions, and development workflow rules, and [TODO.md](TODO.md) for planned work.
