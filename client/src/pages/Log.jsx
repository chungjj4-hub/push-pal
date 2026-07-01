import { useState, useEffect } from 'react';
import JournalCheckIn from '../components/JournalCheckIn';

const TABS = ['Run', 'Lift', 'Soccer', 'Climb', 'Other'];
const TAB_TYPES = { Run: 'run', Lift: 'lift', Soccer: 'soccer', Climb: 'climb', Other: 'other' };
const MODES = ['Check-In', 'Log Workout'];

// Consecutive-day streak ending at today (or yesterday, if today isn't
// logged yet — an in-progress day shouldn't zero out the streak).
function computeStreak(entries) {
  const dates = new Set(entries.map(e => e.date));
  const cursor = new Date();
  const todayStr = cursor.toISOString().split('T')[0];
  if (!dates.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(cursor.toISOString().split('T')[0])) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function Log() {
  const [mode, setMode] = useState('Check-In');
  const [activeTab, setActiveTab] = useState('Run');
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);

  function loadHistory() {
    fetch('/journal?days=60')
      .then(r => r.json())
      .then(rows => setHistory(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }

  useEffect(loadHistory, []);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  const streak = computeStreak(history);

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>Log</h1>
        {streak > 0 && <StreakPill count={streak} />}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid',
              borderColor: mode === m ? 'var(--accent)' : 'var(--border)',
              background: mode === m ? 'var(--accent)15' : 'transparent',
              color: mode === m ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'Check-In' ? (
        <>
          <JournalCheckIn onSaved={loadHistory} />
          <RecentCard history={history} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flexShrink: 0,
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: activeTab === tab ? 'var(--accent)' : 'var(--border)',
                  background: activeTab === tab ? 'var(--accent)15' : 'transparent',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <WorkoutForm type={TAB_TYPES[activeTab]} tabLabel={activeTab} onSaved={showToast} />

          <StravaCard onResult={showToast} />
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '88px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.isError ? 'var(--danger)' : 'var(--accent)',
          color: '#000',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 100,
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function WorkoutForm({ type, tabLabel, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, duration_minutes: '', notes: '', distance_miles: '', pace_per_mile: '', avg_hr: '', exercises: [] });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        type,
        date: form.date,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        notes: form.notes || null,
        ...(type === 'run' ? {
          distance_miles: form.distance_miles ? Number(form.distance_miles) : null,
          pace_per_mile: form.pace_per_mile || null,
          avg_hr: form.avg_hr ? Number(form.avg_hr) : null,
        } : {}),
        ...(type === 'lift' ? { exercises: form.exercises } : {}),
      };
      await fetch('/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved?.(`${tabLabel} logged`);
      setForm({ date: today, duration_minutes: '', notes: '', distance_miles: '', pace_per_mile: '', avg_hr: '', exercises: [] });
    } catch {
      onSaved?.('Error saving workout', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Field label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} /></Field>
      <Field label="Duration (min)"><input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} placeholder="45" style={inputStyle} /></Field>

      {type === 'run' && <>
        <Field label="Distance (miles)"><input type="number" step="0.01" value={form.distance_miles} onChange={e => set('distance_miles', e.target.value)} placeholder="5.0" style={inputStyle} /></Field>
        <Field label="Avg Pace (min/mi)"><input type="text" value={form.pace_per_mile} onChange={e => set('pace_per_mile', e.target.value)} placeholder="9:30" style={inputStyle} /></Field>
        <Field label="Avg HR"><input type="number" value={form.avg_hr} onChange={e => set('avg_hr', e.target.value)} placeholder="145" style={inputStyle} /></Field>
      </>}

      {type === 'lift' && <ExerciseBuilder exercises={form.exercises} onChange={exs => set('exercises', exs)} />}

      <Field label="Notes">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="How did it feel?" rows={2} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
      </Field>

      <button type="submit" disabled={saving} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
        {saving ? 'Saving...' : `Log ${tabLabel}`}
      </button>
    </form>
  );
}

function ExerciseBuilder({ exercises, onChange }) {
  function addSet() {
    onChange([...exercises, { name: '', sets: '', reps: '', weight_lbs: '' }]);
  }
  function update(i, k, v) {
    const next = exercises.map((ex, idx) => idx === i ? { ...ex, [k]: v } : ex);
    onChange(next);
  }
  function remove(i) {
    onChange(exercises.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Exercises</label>
        <button type="button" onClick={addSet} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add</button>
      </div>
      {exercises.map((ex, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px 28px', gap: '6px', alignItems: 'center' }}>
          <input value={ex.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Exercise" style={{ ...inputStyle, fontSize: '13px' }} />
          <input value={ex.sets} onChange={e => update(i, 'sets', e.target.value)} placeholder="Sets" type="number" style={{ ...inputStyle, fontSize: '13px' }} />
          <input value={ex.reps} onChange={e => update(i, 'reps', e.target.value)} placeholder="Reps" type="number" style={{ ...inputStyle, fontSize: '13px' }} />
          <input value={ex.weight_lbs} onChange={e => update(i, 'weight_lbs', e.target.value)} placeholder="lbs" type="number" style={{ ...inputStyle, fontSize: '13px' }} />
          <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
        </div>
      ))}
    </div>
  );
}

function StravaCard({ onResult }) {
  const [connected, setConnected] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch('/strava/status').then(r => r.json()).then(d => setConnected(d.connected)).catch(() => setConnected(false));

    // Handle redirect back from Strava OAuth
    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get('strava');
    if (stravaParam === 'connected') {
      setConnected(true);
      onResult?.('Strava connected — syncing activities...');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stravaParam === 'denied' || stravaParam === 'error') {
      onResult?.('Strava connection failed', true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch('/strava/sync', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onResult?.(`Synced ${data.synced} activities from Strava`);
    } catch (e) {
      onResult?.(e.message, true);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#FC4C02"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>Strava</span>
        </div>
        {connected !== null && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: connected ? 'var(--accent)' : 'var(--text-muted)', background: connected ? 'var(--accent)18' : 'var(--border)', padding: '3px 10px', borderRadius: '20px' }}>
            {connected ? 'Connected' : 'Not connected'}
          </span>
        )}
      </div>

      {connected === false && (
        <a
          href="http://localhost:3001/strava/auth"
          style={{ display: 'block', background: '#FC4C02', color: '#fff', textAlign: 'center', padding: '11px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}
        >
          Connect Strava
        </a>
      )}

      {connected === true && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Activities sync automatically every 3 hours. Runs, lifts, soccer sessions, and climbs all map into your training log.
          </p>
          <button
            onClick={syncNow}
            disabled={syncing}
            style={{ background: syncing ? '#333' : '#FC4C02', color: syncing ? '#666' : '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '14px', cursor: syncing ? 'default' : 'pointer' }}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}
    </div>
  );
}

function StreakPill({ count }) {
  return (
    <span style={{
      background: 'var(--brand-tint)',
      color: 'var(--brand-text)',
      border: '1px solid #2b2470',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      padding: '5px 12px',
    }}>
      🔥 {count}-day streak
    </span>
  );
}

function RecentCard({ history }) {
  const today = new Date().toISOString().split('T')[0];
  const entries = history.filter(e => e.date !== today).slice(0, 5);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recent</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No check-ins logged yet.</div>
      ) : (
        entries.map((e, i) => (
          <div key={e.date}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px' }}>
                  {new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {e.notes || (e.soreness_areas?.length ? `Sore: ${e.soreness_areas.join(', ').replace(/_/g, ' ')}` : 'No notes')}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                {e.energy != null ? `E ${e.energy}` : ''}{e.energy != null && e.mood != null ? ' · ' : ''}{e.mood != null ? `M ${e.mood}` : ''}
              </div>
            </div>
            {i < entries.length - 1 && <div style={{ borderBottom: '1px solid var(--border)', marginTop: '12px' }} />}
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '14px',
  width: '100%',
};
