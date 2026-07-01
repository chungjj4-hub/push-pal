/**
 * GoalProgressBar — labeled progress bar for goal tracking.
 * Sets no background of its own; label text uses `var(--text)` (near-white
 * in the dark theme), so it must be composed inside a dark-surfaced
 * container (e.g. GoalCard's `var(--surface-2)`, BriefingCard's
 * `var(--surface)`) — never rendered bare on a light background.
 *
 *   <GoalProgressBar pct={65} label="Weekly Miles" sublabel="65 / 100 mi" />
 */
export default function GoalProgressBar({ pct = 0, color = 'var(--accent)', label, sublabel }) {
  const safeP = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {(label || sublabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {label && <span style={{ fontSize: '13px', color: 'var(--text)' }}>{label}</span>}
          {sublabel && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sublabel}</span>}
        </div>
      )}
      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${safeP}%`,
          background: color,
          borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}
