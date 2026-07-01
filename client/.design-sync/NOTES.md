# Push Pal Design Sync Notes

## Repo quirks

- **App, not a library.** Push Pal is a Vite React app (`package.json` name: `client`), not an installable npm package. The converter cannot find `push-pal` in `node_modules` — it must always be run with `--entry ./.ds-entry.mjs` (the synthetic barrel file at `client/.ds-entry.mjs`).
- **No TypeScript.** Plain `.jsx` — no `.d.ts` files. Props are synthesized from JSX; contracts are weak. DTS parse step always reports "0 .d.ts files parsed" — expected, not a bug.
- **`componentSrcMap` required.** Without it, the converter finds 0 PascalCase exports (no `.d.ts`). Config must enumerate all 8 components explicitly.
- **Tailwind import in `index.css`.** The main `src/index.css` starts with `@import "tailwindcss"` (Tailwind v4 syntax), which doesn't resolve inside the bundle. Use `src/ds-tokens.css` as `cssEntry` — a standalone token file with just the CSS custom properties and keyframes, no Tailwind import.
- **Fonts are runtime CDN.** Inter and Newsreader load from Google Fonts in `index.html`. No woff2 files in the repo. Set `runtimeFontPrefixes: ["Inter", "Newsreader"]` to suppress `[FONT_MISSING]`.
- **Playwright installed 2026-07-01**, into `client/.ds-sync/node_modules` (not the repo's own lockfile) via `npm i playwright && npx playwright install chromium`. Render check now runs for real — drop `--no-render-check` from the re-sync command below.

## Re-sync command

From `client/`:
```bash
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./.ds-entry.mjs --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

## Known render warns

- `Logo`: `[RENDER_THIN]` — "mounts have no text and paint nothing". False positive: `Logo.jsx` is a pure SVG mark (rounded square + bolt icon, `aria-label="Push Pal"`), so it legitimately has no text nodes for the checker to find. It does paint (fill colors are present) — this is expected for an icon-only component, not a defect.

## Re-sync risks

- `src/ds-tokens.css` is a hand-maintained copy of the token block from `src/index.css`. If tokens are added to `index.css`, they must be manually mirrored into `ds-tokens.css` before re-sync.
- `.ds-entry.mjs` lists all 8 components explicitly. If a new component is added to `src/components/`, add it to both `.ds-entry.mjs` and `componentSrcMap` in config before re-syncing.
- `CoachNote`'s lavender palette (`VOICE` const) is hardcoded in `CoachNote.jsx`, not in CSS tokens. If the color changes, the conventions header (`.design-sync/conventions.md`) should be updated to match.
- **Render check verified 2026-07-01** (Playwright + Chromium installed). 7/8 components rendered cleanly on the first pass; `GoalProgressBar` rendered blank with default props (0% progress, no label) — authored `.design-sync/previews/GoalProgressBar.tsx` (4 stories: in-progress, near-complete, behind/warn-colored, no-label) to fix it. The other 3 floor-card components (`BottomNav`, `BriefingCard`, `Splash`) still render the honest typographic floor card by design — no preview authored yet for them. Authoring previews for those is the next incremental-quality step whenever there's time.
- **Dark-surface composition pattern.** Several leaf components (`GoalProgressBar` confirmed; likely `GoalProgressBar`-style leaves elsewhere) set no background of their own and rely on `var(--text)` (near-white, `#f5f5f5`) for labels — they're only legible when composed inside a parent with a dark `background` (e.g. `var(--surface-2)`, the pattern `GoalCard.jsx` uses). When authoring previews for the remaining floor-card components (`BottomNav`, `BriefingCard`, `Splash`) or any future leaf component, wrap the story in a `Surface`-style dark container (see `GoalProgressBar.tsx`) rather than rendering it bare — a bare render on the capture harness's white canvas makes near-white label text invisible even though the component itself isn't broken. Confirmed via a code search: both real usages (`src/pages/Progress.jsx:103`, `src/components/BriefingCard.jsx:97`) already compose it inside a dark surface — this was never a production bug, only a design-sync preview-isolation gap.
- **JSDoc on `export default function Name(...)` is silently dropped.** The converter's `leadingJsdoc` regex (`.ds-sync/lib/common.mjs`) requires the declaration keyword to immediately follow `export`/`declare` — it doesn't account for `export default`, which is this repo's convention for every one of its 8 components (confirmed on both `Logo.jsx` and `GoalProgressBar.jsx`: hand-written JSDoc there is never picked up; `.d.ts` and `.prompt.md` fall back to the generic "`<Name>` — from push-pal@0.0.0." line). Rather than forking `common.mjs` (used by multiple lib modules with hardcoded relative imports — a proper fix needs `source-kit.mjs` forked too, repointing its import), the workaround used for `GoalProgressBar` was a sibling doc file: `src/components/GoalProgressBar.md`, auto-discovered by `docs.mjs` with no config changes needed (it checks for `<Name>.md` next to `c.srcPath` before anything else). Prefer this same sibling-`.md` pattern over relying on JSDoc for any component whose usage guidance actually matters to the design agent.
