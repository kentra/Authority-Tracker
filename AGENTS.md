# Authority Tracker - AGENT INSTRUCTIONS

This document contains rules and guidelines for AI agents and developers working on the `Authority-Tracker` repository.

## 1. Project Overview

**Authority Tracker** is a mobile-first web application designed as a one-to-four person authority/point tracker for board games, specifically themed around the *Star Realms* card game. 
The application relies on a lightweight stack without heavy frontend frameworks. It uses vanilla HTML5, CSS3, and JavaScript (ES6+). Python (via `uv` and `fastapi`) is currently used as a backend to serve the static files and provide a foundation for future extensions (like database integration).

### Key Features
- Supports 1 to 4 players.
- Mobile-first, responsive layouts (e.g., top player view is inverted for 2 players sitting across).
- Built-in history showing rapid point changes (+/- animations).
- Themed to match Star Realms factions (Blob, Trade Federation, Star Empire, Machine Cult).

---

## 2. Build, Lint, and Test Commands

Because this is a vanilla frontend application with a minimal Python environment, there are no heavy build steps (like Webpack or Vite) involved in the frontend. 

### Running the Application locally
To serve the static files and run the backend, use Uvicorn via `uv`:
```bash
uv run python main.py
# Alternatively, to run directly with uvicorn:
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Then navigate to `http://localhost:8000` or the local network IP for mobile testing.

### Testing
- **Frontend Tests:** There is currently no frontend testing framework (like Jest or Cypress) configured. If you are instructed to add tests, prefer setting up `jest` or a lightweight alternative, but ask the user for confirmation first.
- **Backend Tests (Python):** If Python functionality is extended, use `pytest`. To run a single test, use:
  ```bash
  uv run pytest path/to/test_file.py::test_function_name
  ```

### Linting & Formatting
- **JavaScript:** Adhere to standard ES6+ conventions. If a linter like `eslint` is introduced later, use the default recommended rules.
- **CSS:** Keep rules organized. No post-processor is configured.
- **Python:** Use `ruff` for linting and formatting if extending the backend.
  ```bash
  uv run ruff check .
  uv run ruff format .
  ```

---

## 3. Code Style Guidelines

When writing or modifying code in this repository, rigidly adhere to the following stylistic rules:

### 3.1 JavaScript (Frontend)
- **Vanilla JS:** Avoid introducing heavy dependencies (React, Vue, etc.) unless explicitly instructed. Keep it lightweight.
- **Modern ES6+:** Use `let`/`const`, arrow functions, template literals, and destructuring.
- **DOM Manipulation:** Cache DOM elements in variables at the top of the script if they are used repeatedly (e.g., `const gameScreen = document.getElementById('game-screen');`).
- **State Management:** Keep application state clearly separated from DOM logic. Currently, state is managed in a simple global `state` object.
- **Event Listeners:** Clean up event listeners if you dynamically create/destroy elements to prevent memory leaks.

### 3.2 CSS & Styling
- **CSS Variables:** Strictly use the defined CSS variables in `:root` for colors and theming. Faction colors must match:
  - Blob: Green (`--p2-color`)
  - Trade Federation: Blue (`--p1-color`)
  - Star Empire: Yellow (`--p3-color`)
  - Machine Cult: Red (`--p4-color`)
- **Responsive Design:** 
  - ALWAYS build mobile-first. 
  - Use `flexbox` and `grid` for layout distribution.
  - Test on smaller viewports (`max-width: 400px`, `max-height: 600px`).
- **Animations:** Keep animations lightweight (e.g., CSS transitions on `transform` or `opacity`). Avoid animating `width` or `height` for performance reasons.

### 3.3 HTML Structure
- Keep semantic HTML where possible.
- Ensure buttons have distinct touch targets appropriate for mobile use. Disable user-select text (`user-select: none`) globally for a native app feel.

### 3.4 Python (Backend / Scripts)
- **Version:** Python 3.13+ is required.
- **Type Hints:** ALWAYS use type hints in function signatures and complex variable declarations.
- **Docstrings:** Use Google-style docstrings for any non-trivial functions or classes.

---

## 4. Naming Conventions

- **HTML IDs and Classes:** Use `kebab-case` for classes and ids (e.g., `setup-screen`, `tracker-widget`). 
- **JavaScript Variables & Functions:** Use `camelCase` (e.g., `initGame`, `startingAuth`).
- **Python Variables & Functions:** Use `snake_case` (e.g., `update_tracker`).
- **Python Classes:** Use `PascalCase` (e.g., `TrackerManager`).
- **CSS Variables:** Prefix with `--` and use `kebab-case` (e.g., `--accent-color`).

---

## 5. Error Handling & Edge Cases

- **JavaScript Fallbacks:** When parsing inputs, always provide a fallback value if the input is `NaN` or invalid. For example, if a user enters no value for starting authority, default it to `50`.
- **UI Feedback:** Provide visual feedback on buttons or actions (e.g., using `:active` pseudo-classes to scale down buttons to mimic a press). 
- **Console Errors:** Ensure the application runs without any errors in the browser console. Use `try...catch` blocks when parsing local storage or dealing with external APIs (if introduced).
- **Python Exceptions:** Raise specific exceptions instead of generic `Exception`. Use custom exceptions if necessary.

---

## 6. Development Workflow Rules (For Agents)

- **Read Before Writing:** Always use `read` tools to read `script.js`, `style.css`, or `index.html` to understand the current state before making edits.
- **No Unnecessary Files:** Do not create extraneous files or frameworks unless explicitly required by the user.
- **Edit Context:** When using the `edit` tool, assure exact matches of the `oldString` retaining indentations.
- **Absolute Paths:** Always use absolute paths when reading or modifying files.
