# Push Pal — Design System Conventions

Push Pal is a dark-first personal AI fitness coaching app (480px max-width mobile). All components use **inline styles** (`style={{}}`), not CSS utility classes. The design agent should compose layouts the same way: inline styles for positioning, spacing, and layout; CSS custom properties from `styles.css` for color tokens.

## Styling idiom

No Tailwind, no CSS modules, no BEM. Every visual property is an inline style or a CSS custom property reference.

**Token reference** — use these from `styles.css` via `var(--name)`:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0a0a` | page background |
| `--surface` | `#141414` | card backgrounds |
| `--surface-2` | `#1b1b1b` | nested/secondary panels |
| `--border` | `#1f1f1f` | all borders (use at `1px solid`) |
| `--accent` | `#22c55e` | green — completion, healthy recovery |
| `--warn` | `#f59e0b` | amber — moderate recovery, warnings |
| `--danger` | `#ef4444` | red — low recovery, errors |
| `--text` | `#f5f5f5` | primary text |
| `--text-muted` | `#737373` | labels, secondary text |
| `--brand` | `#5b4fe8` | indigo — logo, CoachNote header, high-emphasis only |
| `--brand-tint` | `#1a1633` | dark indigo wash for brand backgrounds |
| `--brand-text` | `#c9c2ff` | light lavender for brand text on dark |
| `--font-voice` | Newsreader serif | coach voice only (italic) |

**Status colors are never used for brand, and brand (`--brand`) is never used for status.**

## Components

All exports are on `window.PushPal.*`. Most are standalone — no provider needed. Exception: `BottomNav` uses `NavLink` from react-router-dom; wrap it in a `MemoryRouter` from `'react-router-dom'` (already bundled as a `PushPal` dep).

**`CoachNote`** — the AI coach voice card. Light translucent lavender on the dark app surface (hardcoded `VOICE` const, not tokens). Usage: `<CoachNote>coaching text here</CoachNote>`. Supports `**bold**` markdown inline. Optional `label` prop (default "Push Pal").

**`Logo`** — bolt mark SVG in rounded indigo square. Props: `size` (number, default 28), `variant` ("default" | "splash"). Use in headers and splash screens.

**`GoalProgressBar`** — horizontal progress bar. Props: `pct` (0–100), `label` (string), `sublabel` (string). Fills in `--brand` indigo.

**`GoalCard`** — expandable training card. Props: `title`, `subtitle`, `badge`, `expandedContent` (ReactNode). Chevron animates on expand.

**`BriefingCard`** — the morning readiness card. Props: `briefing` ({readiness, todayRecommendation, watchOuts, weeklySnapshot, coachNote}), `stats` ({today, avg} with recovery/hrv/rhr), `weekly` ({pct, current, target}). Contains `CoachNote` and `GoalProgressBar` internally.

**`Splash`** — full-bleed loading screen. Props: `longLoad` (bool, cycles phrases). Used as a loading state.

**`BottomNav`** — 4-tab fixed nav (Today / Log / Progress / Coach). Requires `MemoryRouter` wrapper.

**`JournalCheckIn`** — daily check-in form (energy, mood, soreness, notes). Makes live API calls to `/journal` — render as static mock or skip in designs.

## Idiomatic build snippet

```jsx
// card with tokens + inline layout (no Tailwind, no CSS modules)
<div style={{
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}}>
  <Logo size={26} />
  <CoachNote>Your recovery dipped — run easy today.</CoachNote>
  <GoalProgressBar pct={65} label="This week's mileage" sublabel="6.2 / 35 mi" />
</div>
```

## Where to look

- Token definitions: `styles.css` (and `_ds_bundle.css` it imports)
- Per-component props: each `<Name>.d.ts` or `<Name>.prompt.md`
- Brand bolt mark: `Logo` component, `variant="splash"` for large version
