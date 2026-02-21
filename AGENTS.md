# AGENTS.md
# Authority Tracker - AGENT INSTRUCTIONS

This document contains rules and guidelines for AI agents and developers working on the `Authority-Tracker` repository.

## 1. Project Overview

**Authority Tracker** is a mobile-first web application designed as a one-to-four person authority/point tracker for board games, specifically themed around the *Star Realms* card game. 
The application is built on fastapi-fullstack, utilising WebSocket Streaming, SQLite, redis and taskiq.
For frontend it is using  Next.js 15(React 19 + TypeScript + Tailwind CSS v4) with Dark Mode + i18n.



The application relies on a lightweight stack without heavy frontend frameworks. It uses vanilla HTML5, CSS3, and JavaScript (ES6+). Python (via `uv` and `fastapi`) is currently used as a backend to serve the static files and provide a foundation for future extensions (like database integration).

### Key Features
- Supports 1 to 4 players.
- Mobile-first, responsive layouts (e.g., top player view is inverted for 2 players sitting across).
- Built-in history showing rapid point changes (+/- animations).
- Themed to match Star Realms factions (Blob, Trade Federation, Star Empire, Machine Cult).
- Match History API: Create endpoints to retrieve past games, showing the outcome, total score, and duration.
- Player Statistics Track wins, losses, average score, and favorite factions for returning player names.
- State Persistence, active game state is being saved to SQLite or Redis to survive reboots.
- Text-to-Speech - All AI-generated briefings will be read aloud using Gemini's TTS engine, giving your game a "Ship AI" voice.

**fastapi-fullstack** is an interactive CLI tool that generates FastAPI projects with Logfire observability integration. It uses Cookiecutter templates to scaffold complete project structures with configurable options for databases, authentication, background tasks, and various integrations.

---



## Commands

```bash
# Install dependencies
uv sync

# Run tests
pytest

# Run a single test file
pytest tests/test_cli.py -v

# Linting and formatting (always run before committing)
ruff check . --fix
ruff format .

# Type checking
mypy fastapi_gen
```

## CLI Usage

```bash
# Interactive wizard
fastapi-fullstack new

# Quick project creation
fastapi-fullstack create my_project --database postgresql --auth jwt

# Minimal project (no extras)
fastapi-fullstack create my_project --minimal
```

## Architecture

### Core Modules (`fastapi_gen/`)

| Module | Purpose |
|--------|---------|
| `cli.py` | Click-based CLI with commands: `new`, `create`, `templates` |
| `config.py` | Pydantic models for configuration options |
| `prompts.py` | Interactive prompts using Questionary |
| `generator.py` | Cookiecutter invocation and messaging |

### Template System (`template/`)

```
template/
├── cookiecutter.json                    # Default context (~75 variables)
├── hooks/post_gen_project.py            # Post-generation cleanup
└── {{cookiecutter.project_slug}}/
    ├── backend/app/                     # FastAPI application
    └── frontend/                        # Next.js 15 (optional)
```

Template files use Jinja2 conditionals: `{% if cookiecutter.use_jwt %}...{% endif %}`

## Key Design Decisions

- **Async-first**: All database options except SQLite use async drivers (asyncpg, motor)
- **Naming**: Project names must match `^[a-z][a-z0-9_]*$`
- **Package management**: Generated projects use UV
- **Data access**: Repository pattern throughout

## Testing Guidelines

- Tests live in `tests/` and mirror the `fastapi_gen/` structure
- Use `pytest` fixtures from `conftest.py` for common setup
- Template generation tests should use temporary directories
- Run the full test suite before submitting changes

## Common Tasks

**Adding a new CLI option:**
1. Add the option to `config.py` (Pydantic model)
2. Add the prompt to `prompts.py`
3. Update `cookiecutter.json` with the new variable
4. Add conditional logic to relevant template files

**Modifying template output:**
1. Edit files under `template/{{cookiecutter.project_slug}}/`
2. Use `{% if cookiecutter.variable %}` for conditional content
3. Test with `fastapi-fullstack create test_project --<relevant-flags>`
4. Check `hooks/post_gen_project.py` if files need conditional deletion

## Reference

| Resource | Location |
|----------|----------|
| Template variables | `template/cookiecutter.json` |
| Post-generation hooks | `template/hooks/post_gen_project.py` |
| Sprint planning | `notes/sprint_0_1_7/` |
| CLI help | `fastapi-fullstack --help` |
