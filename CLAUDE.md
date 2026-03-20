# CLAUDE.md

## Build & Dev

```bash
npm install          # Install dependencies
npm run dev          # Dev build (no minification)
npm run build        # Production build + Firefox ZIP
```

## Lint

```bash
npx eslint .
```

Style: ES2025, double quotes, semicolons, Unix line breaks.

## Code Conventions

- ES6 modules throughout (`"type": "module"`)
- async/await for async operations
- IPC via `browser.runtime.sendMessage({ method: "module.action", ... })`
- UI strings via `browser.i18n.getMessage()`
- Copyright headers on all source files

## No Tests

There is no test suite in this repository currently.
