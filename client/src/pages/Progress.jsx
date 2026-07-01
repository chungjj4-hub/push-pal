import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, PieChart, Pie, Cell,
} from 'recharts';
import GoalCard from '../components/GoalCard';
import GoalProgressBar from '../components/GoalProgressBar';
import Splash from '../components/Splash';

/* ── unit + date helpers ─────────────────────────────────── */
function metersToMiles(m) { return m ? +(m / 1609.34).toFixed(2) : 0; }
function secPerKmToPaceDec(s) {
  if (!s) return null;
  return +((s * 1.60934) / 60).toFixed(2); // min/mi as decimal
}
function paceLabel(dec) {
  if (dec == null) return '—';
  return `${Math.floor(dec)}:${Math.round((dec % 1) * 60).toString().padStart(2, '0')}`;
}
function isoWeek(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

const TICK = { fontSize: 11, fill: '#737373' };
const TOOLTIP_STYLE = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text)' } };
const PIE_COLORS = { run: '#22c55e', lift: '#3b82f6', soccer: '#f59e0b', climb: '#a855f7', other: '#6b7280' };

export default function Progress() {
  const [goals, setGoals] = useState(null);
  const [activities, setActivities] = useState([]);
  const [recovery, setRecovery] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/goals').then(r => r.json()),
      fetch('/fit/activities?days=60').then(r => r.json()),
      fetch('/whoop/recovery?days=30').then(r => r.json()),
    ])
      .then(([g, a, r]) => { setGoals(g); setActivities(Array.isArray(a) ? a : []); setRecovery(Array.isArray(r) ? r : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Splash />;
  if (!goals) return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Could not load progress.</div>;

  const { marathon, lifting = [], frequency = [] } = goals;

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>Progress</h1>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Marathon block · Week {marathon.currentTrainingWeek} of 16
        </div>
      </div>

      {/* ── Goal-first cards ───────────────────────────────── */}
      <MarathonCard marathon={marathon} activities={activities} />
      {lifting.length > 0 && <LiftingCard lifting={lifting} />}
      {frequency.length > 0 && <FrequencyCards frequency={frequency} />}

      {/* ── Trends (charts not tied to a single goal) ──────── */}
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginTop: '8px' }}>Trends</div>
      <RecoveryVsLoad recovery={recovery} />
      <HrvTrend recovery={recovery} />
      <ActivityMix activities={activities} />
    </div>
  );
}

/* ── Marathon ────────────────────────────────────────────── */
function MarathonCard({ marathon, activities }) {
  const badge = marathonBadge(marathon.weeklyMilesPct);

  const rampData = Array.from({ length: 16 }, (_, i) => {
    const week = i + 1;
    let target;
    if (week <= 4) target = 20 + (week - 1) * 3;
    else if (week <= 8) target = 32 + (week - 5) * 2;
    else if (week <= 12) target = 40;
    else if (week <= 15) target = 35 - (week - 12) * 5;
    else target = 20;
    return { week: `W${week}`, target, current: week === marathon.currentTrainingWeek ? marathon.weeklyMilesCurrent : undefined };
  });

  const longRunData = activities
    .filter(a => a.type === 'run')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map(r => ({ date: r.date.slice(5), pace: secPerKmToPaceDec(r.avg_pace_seconds_per_km) }));

  const summary = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>{marathon.weeksToRace}<span style={{ fontSize: '16px', fontWeight: 600 }}>w</span></div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to Nov 1, 2026</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Target pace</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>8:30–9:00/mi</div>
        </div>
      </div>
      <GoalProgressBar pct={marathon.weeklyMilesPct} label="Weekly mileage" sublabel={`${marathon.weeklyMilesCurrent} / ${marathon.weeklyMilesTarget} mi`} />
    </div>
  );

  const expanded = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <ChartLabel>16-week mileage ramp</ChartLabel>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={rampData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="week" tick={TICK} interval={3} />
            <YAxis tick={TICK} />
            <Tooltip {...TOOLTIP_STYLE} />
            <ReferenceLine y={35} stroke="var(--accent)" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="target" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.1} strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <ChartLabel>Long run pace trend</ChartLabel>
        {longRunData.length > 0 ? (
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={longRunData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={paceLabel} domain={['auto', 'auto']} />
              <Tooltip {...TOOLTIP_STYLE} formatter={v => [`${paceLabel(v)}/mi`, 'pace']} />
              <ReferenceLine y={9} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: '9:00 goal', fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="pace" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyNote>No runs logged yet.</EmptyNote>}
      </div>
    </div>
  );

  return <GoalCard title="Sub-4:00 Marathon" badge={badge} summary={summary} expandedContent={expanded} />;
}

function marathonBadge(pct) {
  if (pct >= 80) return { label: 'On track', color: 'var(--accent)' };
  if (pct >= 40) return { label: 'Building', color: 'var(--warn)' };
  return { label: 'Behind', color: 'var(--danger)' };
}

/* ── Lifting ─────────────────────────────────────────────── */
function LiftingCard({ lifting }) {
  const oneRM = lifting.filter(g => g.type === 'lift_1rm');
  const consistency = lifting.find(g => g.type === 'lift_consistency');

  const summary = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {oneRM.map(g => (
          <div key={g.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{g.label}</div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>{g.current1RM} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ {g.target1RM} lbs</span></div>
          </div>
        ))}
      </div>
      {consistency && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <WeekTracker count={consistency.sessionsThisWeek} target={consistency.targetSessions} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{consistency.sessionsThisWeek}/{consistency.targetSessions} sessions this week</span>
        </div>
      )}
    </div>
  );

  return <GoalCard title="Lifting" summary={summary} />;
}

function WeekTracker({ count, target }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {Array.from({ length: Math.max(target, 3) }, (_, i) => (
        <div key={i} style={{ width: '14px', height: '14px', borderRadius: '4px', background: i < count ? 'var(--accent)' : 'var(--border)' }} />
      ))}
    </div>
  );
}

/* ── Activity frequency (compact streak cards) ───────────── */
function FrequencyCards({ frequency }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {frequency.map(g => (
        <div key={g.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{g.label}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
            {g.sessionsThisWeek}<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}> / {g.targetSessions} wk</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Trends ──────────────────────────────────────────────── */
function RecoveryVsLoad({ recovery }) {
  const data = [...recovery].reverse().map(r => ({ date: r.date.slice(5), recovery: r.recovery_score, load: r.strain }));
  return (
    <ChartCard title="Recovery vs. Training Load · 30d">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={TICK} interval={Math.ceil(data.length / 6)} />
            <YAxis yAxisId="l" tick={TICK} domain={[0, 100]} />
            <YAxis yAxisId="r" orientation="right" tick={TICK} domain={[0, 21]} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line yAxisId="l" type="monotone" dataKey="recovery" stroke="var(--accent)" strokeWidth={2} dot={false} name="Recovery %" isAnimationActive={false} />
            <Line yAxisId="r" type="monotone" dataKey="load" stroke="#38bdf8" strokeWidth={2} dot={false} name="Strain" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : <EmptyNote>No recovery data yet.</EmptyNote>}
      <Legend2 items={[{ label: 'Recovery %', color: 'var(--accent)' }, { label: 'Strain', color: '#38bdf8' }]} />
    </ChartCard>
  );
}

function HrvTrend({ recovery }) {
  const asc = [...recovery].reverse();
  const data = asc.map((r, i) => {
    const window = asc.slice(Math.max(0, i - 6), i + 1).map(x => x.hrv_rmssd).filter(v => v != null);
    const avg = window.length ? Math.round(window.reduce((a, b) => a + b, 0) / window.length) : null;
    return { date: r.date.slice(5), hrv: r.hrv_rmssd != null ? Math.round(r.hrv_rmssd) : null, avg };
  });
  return (
    <ChartCard title="HRV Trend · 7-day rolling avg">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={TICK} interval={Math.ceil(data.length / 6)} />
            <YAxis tick={TICK} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="hrv" stroke="var(--accent)" strokeWidth={2} dot={false} name="HRV" isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="7d avg" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : <EmptyNote>No HRV data yet.</EmptyNote>}
      <Legend2 items={[{ label: 'HRV', color: 'var(--accent)' }, { label: '7d avg', color: 'var(--text-muted)' }]} />
    </ChartCard>
  );
}

function ActivityMix({ activities }) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const recent = activities.filter(a => a.date >= since);
  const mix = recent.reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {});
  const pieData = Object.entries(mix).map(([name, value]) => ({ name, value }));

  return (
    <ChartCard title="Activity Mix · 30d">
      {pieData.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ResponsiveContainer width="50%" height={120}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={3} isAnimationActive={false}>
                {pieData.map(e => <Cell key={e.name} fill={PIE_COLORS[e.name] ?? '#6b7280'} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pieData.map(e => (
              <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[e.name] ?? '#6b7280' }} />
                <span style={{ textTransform: 'capitalize' }}>{e.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <EmptyNote>No activities in the last 30 days.</EmptyNote>}
    </ChartCard>
  );
}

/* ── small shared bits ───────────────────────────────────── */
function ChartCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
      <ChartLabel>{title}</ChartLabel>
      {children}
    </div>
  );
}
function ChartLabel({ children }) {
  return <h3 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</h3>;
}
function Legend2({ items }) {
  return (
    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ width: '10px', height: '2px', background: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}
function EmptyNote({ children }) {
  return <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>{children}</div>;
}
