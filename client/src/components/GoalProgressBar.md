Labeled progress bar for goal tracking.

## Composition requirement

`GoalProgressBar` sets no background of its own — the label text uses `var(--text)` (near-white in the app's dark theme), so it is only legible when composed inside a container with a dark `background`. Always render it inside a dark-surfaced parent, e.g.:

```jsx
<div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
  <GoalProgressBar pct={65} label="Weekly Miles" sublabel="65 / 100 mi" />
</div>
```

This matches how the real app uses it: inside `GoalCard` (`var(--surface-2)`) and inside `BriefingCard` (`var(--surface)`). Never render it directly on a page or light background.

## Props

- `pct` (number, 0–100) — fill percentage. Values are clamped to [0, 100].
- `label` (string, optional) — primary label, left-aligned above the bar.
- `sublabel` (string, optional) — secondary text, right-aligned above the bar (e.g. a percentage or fraction).
- `color` (string, optional) — bar fill color, defaults to `var(--accent)`. Use semantic colors like `var(--warn)` or `var(--danger)` for at-risk/behind states.
