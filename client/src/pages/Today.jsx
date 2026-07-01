import { useState, useEffect } from 'react';
import BriefingCard from '../components/BriefingCard';
import Logo from '../components/Logo';
import Splash from '../components/Splash';

// Today's value + 7-day rolling average from recent WHOOP recovery rows.
function computeStats(rows) {
  if (!rows || rows.length === 0) return null;
  const today = rows[0];
  const recent = rows.slice(0, 7);
  const avg = key => {
    const vals = recent.map(r => r[key]).filter(v => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  return {
    today: { recovery: today.recovery_score, hrv: today.hrv_rmssd, rhr: today.resting_hr },
    avg: { recovery: avg('recovery_score'), hrv: avg('hrv_rmssd'), rhr: avg('resting_hr') },
  };
}

const BRIEFING_KEY = () => `pushpal_briefing_${new Date().toISOString().split('T')[0]}`;
const BRIEFING_TTL_MS = 60 * 60 * 1000; // 1 hour — matches WHOOP sync cadence

function getCachedBriefing() {
  try {
    const raw = localStorage.getItem(BRIEFING_KEY());
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > BRIEFING_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function setCachedBriefing(data) {
  localStorage.setItem(BRIEFING_KEY(), JSON.stringify({ data, ts: Date.now() }));
}

function WhoopConnect({ onConnected }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errMsg, setErrMsg] = useState('');

  async function connect() {
    const raw = code.trim();
    // Accept full URL or bare code
    let extracted = raw;
    try {
      const u = new URL(raw);
      extracted = u.searchParams.get('code') ?? raw;
    } catch {}
    if (!extracted) return;

    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch('/whoop/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: extracted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Exchange failed');
      onConnected();
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  }

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
      <div>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>Connect WHOOP</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          WHOOP's developer portal doesn't allow localhost redirect URLs, so you'll need to paste the auth code manually.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Step n={1} text="Open the authorization page (new tab)" />
        <a
          href="http://localhost:3001/whoop/auth"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block',
            background: 'var(--accent)',
            color: '#000',
            textAlign: 'center',
            padding: '10px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
          }}
        >
          Open WHOOP Auth →
        </a>

        <Step n={2} text='After authorizing, WHOOP redirects to whoop.com — copy the full URL from the address bar (it starts with https://whoop.com/?code=...)' />

        <Step n={3} text="Paste the full URL or just the code value below" />
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="https://whoop.com/?code=..."
          style={{
            background: '#1a1a1a',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: 'var(--text)',
            fontSize: '13px',
            outline: 'none',
            fontFamily: 'monospace',
          }}
        />

        {errMsg && (
          <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{errMsg}</div>
        )}

        <button
          onClick={connect}
          disabled={!code.trim() || status === 'loading'}
          style={{
            background: code.trim() ? 'var(--accent)' : '#333',
            color: code.trim() ? '#000' : '#666',
            border: 'none',
            borderRadius: '8px',
            padding: '10px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: code.trim() ? 'pointer' : 'default',
          }}
        >
          {status === 'loading' ? 'Connecting…' : 'Connect WHOOP'}
        </button>
      </div>
    </div>
  );
}

function Step({ n, text }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{
        minWidth: '22px',
        height: '22px',
        borderRadius: '50%',
        background: 'var(--accent)',
        color: '#000',
        fontSize: '12px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '1px',
      }}>{n}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{text}</div>
    </div>
  );
}

export default function Today() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [whoopConnected, setWhoopConnected] = useState(null);
  const [stats, setStats] = useState(null);
  const [weekly, setWeekly] = useState(null);

  function loadBriefing() {
    const cached = getCachedBriefing();
    if (cached) {
      setBriefing(cached);
      setLoading(false);
    } else {
      fetch('/coach/briefing', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            setCachedBriefing(data);
            setBriefing(data);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }

  useEffect(() => {
    fetch('/whoop/status')
      .then(r => r.json())
      .then(d => setWhoopConnected(d.connected))
      .catch(() => setWhoopConnected(false));

    fetch('/whoop/recovery?days=14')
      .then(r => r.json())
      .then(rows => setStats(computeStats(rows)))
      .catch(() => {});

    fetch('/goals')
      .then(r => r.json())
      .then(d => {
        const m = d?.marathon;
        if (m) setWeekly({ pct: m.weeklyMilesPct, current: m.weeklyMilesCurrent, target: m.weeklyMilesTarget });
      })
      .catch(() => {});

    loadBriefing();
  }, []);

  function handleWhoopConnected() {
    setWhoopConnected(true);
    // Reload briefing now that WHOOP data will start syncing
    localStorage.removeItem(BRIEFING_KEY());
    setLoading(true);
    setTimeout(loadBriefing, 3000); // give cron a moment to kick off backfill
  }

  if (loading) return <Splash />;

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <Logo size={32} />
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em' }}>Good morning, Justin</div>
        </div>
      </div>

      {whoopConnected === false ? (
        <WhoopConnect onConnected={handleWhoopConnected} />
      ) : briefing ? (
        <BriefingCard briefing={briefing} stats={stats} weekly={weekly} />
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          No briefing available — WHOOP data is syncing, check back in a minute.
        </div>
      )}
    </div>
  );
}
