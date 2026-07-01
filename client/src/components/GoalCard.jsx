import { useState } from 'react';

/**
 * GoalCard — goal-first card with a consistent expand/collapse affordance.
 * The summary (countdown, progress bar, chips) is always visible; the chart
 * evidence lives in `expandedContent` and reveals on tap. Goals answer
 * "am I on track," the expanded chart answers "why" — kept spatially together.
 *
 * Status badges use semantic color only (on track / behind / ahead) — never brand.
 */
export default function GoalCard({ title, badge, summary, expandedContent }) {
  const [open, setOpen] = useState(false);
  const expandable = !!expandedContent;

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div
        onClick={() => expandable && setOpen(o => !o)}
        style={{ padding: '16px', cursor: expandable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{title}</h2>
            {badge && (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: badge.color,
                background: badge.color + '1f',
                border: `1px solid ${badge.color}40`,
                borderRadius: '20px',
                padding: '2px 9px',
                whiteSpace: 'nowrap',
              }}>
                {badge.label}
              </span>
            )}
          </div>
          {expandable && <Chevron open={open} />}
        </div>
        {summary}
      </div>

      {expandable && (
        <div style={{ maxHeight: open ? '1200px' : '0', overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
          <div style={{ padding: '4px 16px 16px' }}>{expandedContent}</div>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
