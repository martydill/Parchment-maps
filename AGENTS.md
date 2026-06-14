# Repository Guide

## Project overview

The Gilded Archipelago is a dependency-free, browser-based merchant sailing
game. It is implemented with HTML, CSS, JavaScript ES modules, and the Canvas
2D API. The application does not use a build step or a front-end framework.

## Important paths

- `index.html` contains the application shell, HUD, dialogs, and panels.
- `styles.css` contains all visual styling and responsive behavior.
- `src/app.js` owns browser integration, rendering, input, world data, and the
  main game loop.
- `src/core/` contains reusable game-domain modules. Keep logic here when it
  can be independent of the DOM and Canvas APIs.
- `test/` contains Node.js tests for the matching modules in `src/core/`.
- `eslint.config.js` contains the JavaScript lint configuration.

## Development commands

Run commands from the repository root:

- `npm test` runs the complete Node.js test suite.
- `npm run test:coverage` runs the tests and requires 100% line, function, and
  branch coverage for `src/core/*.js`.
- `npm run lint` checks JavaScript with ESLint.
- `npm run format` formats the repository with Prettier.
- `npm run format:check` verifies formatting without changing files.

There is no development-server dependency. To exercise the application in a
browser, serve the repository root with any static HTTP server rather than
opening `index.html` directly, because the application uses ES modules. For
example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Change guidelines

- Use modern JavaScript and ES module `import`/`export` syntax.
- Do not add a framework or runtime dependency unless the task explicitly
  requires it.
- Keep deterministic calculations and state transitions in `src/core/`; keep
  DOM access, Canvas drawing, and event wiring in `src/app.js`.
- Preserve save compatibility when changing persisted state. Add normalization
  or migration behavior for fields that may be absent from older saves.
- Account for the horizontally wrapping world when changing navigation,
  distances, routes, visibility, or camera behavior.
- Keep mouse, touch, and keyboard controls working when changing interaction
  code.
- Match each core behavior change with focused tests in `test/`, including
  boundary cases and failure paths.
- Do not edit generated coverage output or commit local server artifacts.

## Required validation

For every code change, run the formatter, linter, and tests before committing:

```sh
npm run format
npm run lint
npm test
npm run test:coverage
```

For perceptible UI changes, also launch the game in a browser, verify the
affected desktop and mobile layouts, and capture a screenshot when the
environment supports it.
