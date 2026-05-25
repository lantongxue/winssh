# web — Independent Brand-Site Subproject

**Parent**: root AGENTS.md (commands, aliases, cross-cutting constraints)

## OVERVIEW

Fully independent Vite subproject for brand site / docs landing. Shares root `node_modules` but has own package.json, tsconfig, vite config, vitest config, and tests.

## WHERE TO LOOK

| Task | File(s) | Notes |
|------|---------|-------|
| Add site page | web/src/ + web/vite.config.ts (rollupOptions.input) | Multi-page build: home + docs |
| Add site component | web/src/components/ | Standard React components |
| Modify site styling | web/src/lib/ + root Tailwind config | Shared root node_modules for CSS tools |
| Add site test | web/test/ + web/vitest.config.ts | Separate vitest config — run via `npm run web:test` |
| Modify theme display | src/shared/themes.ts → web/src/lib/site-theme.ts | Light/dark-plus themes shared with desktop app |

## CONVENTIONS

- **Shared node_modules**: All npm scripts reference `../node_modules/` binaries directly. No `npm install` inside `web/`.
- **Multi-page Vite build**: `rollupOptions.input` defines `home` (index.html) and `docs` (docs/index.html) as separate entry points.
- **@ alias**: `@/*` maps to `web/src/*` (NOT `src/renderer/src/*` — different scope from desktop app).
- **fs.allow**: Vite server allows parent directory access for root-level resources.
- **Theme dependency**: Uses `src/shared/themes.ts` for light/dark-plus theme definitions. Changes to that file affect both desktop app AND web site.

## ANTI-PATTERNS

- **NEVER** run `npm install` inside `web/` — it shares root `node_modules`
- **NEVER** confuse `@/` alias scope — in web/ it maps to `web/src/`, not `src/renderer/src/`
- **NEVER** run web tests with root vitest — use `npm run web:test` (root config excludes `web/**`)
- **NEVER** modify `src/shared/themes.ts` without checking impact on web site