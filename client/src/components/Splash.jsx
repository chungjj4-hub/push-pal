import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';

export const LOADING_PHRASES = [
  'Reading your data…',
  'Checking in with WHOOP…',
  'Catching up on your miles…',
  'Counting your strain points…',
  "Peeking at last night's sleep…",
  'Syncing your sweat…',
  'Doing the HRV math…',
  "Reviewing yesterday's effort…",
  'Reading between your recovery lines…',
  'Pulling up your check-ins…',
  'Crunching your training week…',
  'Getting the full picture…',
];

function pickOne() {
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
}

function shuffledSubset(n) {
  const copy = [...LOADING_PHRASES];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Full-bleed indigo splash / loading screen. The first thing users see on
 * cold load and during any full-screen async wait.
 *
 *   <Splash />              short load — holds one random phrase
 *   <Splash longLoad />     long load (first-launch backfill, manual re-sync)
 *                           — cycles a shuffled subset every ~1.5s
 */
export default function Splash({ longLoad = false }) {
  const subsetRef = useRef(null);
  if (longLoad && !subsetRef.current) subsetRef.current = shuffledSubset(4);

  const [phrase, setPhrase] = useState(() =>
    longLoad ? subsetRef.current[0] : pickOne()
  );

  useEffect(() => {
    if (!longLoad) return; // hold a single phrase for the whole load
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % subsetRef.current.length;
      setPhrase(subsetRef.current[i]);
    }, 1500);
    return () => clearInterval(id);
  }, [longLoad]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--brand)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Logo size={66} variant="splash" radius={18} />
      </div>

      <div style={{ fontSize: '22px', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
        Push Pal
      </div>

      <div
        key={phrase}
        style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.65)',
          minHeight: '18px',
          textAlign: 'center',
          animation: 'pp-fade-in 0.4s ease',
        }}
      >
        {phrase}
      </div>

      <div style={{ display: 'flex', gap: '7px', marginTop: '4px' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#fff',
              opacity: i === 0 ? 1 : 0.5,
              animation: `pp-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
