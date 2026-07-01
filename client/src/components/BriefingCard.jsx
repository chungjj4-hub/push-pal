import CoachNote from './CoachNote';
import GoalProgressBar from './GoalProgressBar';

const READINESS_CONFIG = {
  high: { color: 'var(--accent)', label: 'Ready' },
  moderate: { color: 'var(--warn)', label: 'Moderate' },
  low: { color: 'var(--danger)', label: 'Low' },
};

// Recovery score → semantic color (WHOOP zones). Status only, never brand.
function recoveryColor(score) {
  if (score == null) return 'var(--text)';
  if (score >= 67) return 'var(--accent)';
  if (score >= 34) return 'var(--warn)';
  return 'var(--danger)';
}

export default function BriefingCard({ briefing, stats, weekly }) {
  const cfg = READINESS_CONFIG[briefing.readiness] ?? READINESS_CONFIG.moderate;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Readiness badge — semantic color only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          background: cfg.color + '20',
          color: cfg.color,
          border: `1px solid ${cfg.color}40`,
          borderRadius: '6px',
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {cfg.label}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Today's readiness</span>
      </div>

      {/* The coach speaking — leads, right under the readiness badge */}
      {briefing.coachNote && <CoachNote>{briefing.coachNote}</CoachNote>}

      {/* Primary recommendation — bold + larger */}
      <p style={{ margin: 0, fontSize: '17px', fontWeight: 500, lineHeight: '1.5', color: 'var(--text)' }}>
        {briefing.todayRecommendation}
      </p>

      {/* Stat cards — today's value prominent, 7-day average beneath */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <StatCard label="Recovery" value={fmt(stats.today.recovery)} suffix="%" avg={stats.avg.recovery} valueColor={recoveryColor(stats.today.recovery)} />
          <StatCard label="HRV" value={fmt(stats.today.hrv)} suffix=" ms" avg={stats.avg.hrv} />
          <StatCard label="RHR" value={fmt(stats.today.rhr)} suffix=" bpm" avg={stats.avg.rhr} />
        </div>
      )}

      {/* Supporting detail — collapses, warning tone */}
      {briefing.watchOuts?.length > 0 && (
        <details open style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '12px 14px' }}>
          <summary style={{
            cursor: 'pointer',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--warn)',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            <span>⚠</span>
            <span>Watch-outs ({briefing.watchOuts.length})</span>
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {briefing.watchOuts.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, marginTop: '1px', color: 'var(--warn)' }}>•</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Weekly horizon — its own card with a labeled progress bar */}
      {(weekly || briefing.weeklySnapshot) && (
        <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {weekly && (
            <GoalProgressBar
              pct={weekly.pct}
              label="This week's mileage"
              sublabel={`${weekly.current} / ${weekly.target} mi`}
            />
          )}
          {briefing.weeklySnapshot && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {briefing.weeklySnapshot}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix, avg, valueColor = 'var(--text)' }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: '17px', fontWeight: 500, color: valueColor }}>
        {value}{value !== '—' && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{suffix}</span>}
      </span>
      {avg != null && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>avg {avg}</span>}
    </div>
  );
}

function fmt(n) {
  return n == null ? '—' : Math.round(n).toString();
}
