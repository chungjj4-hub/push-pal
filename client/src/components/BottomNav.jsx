import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/today', label: 'Today', icon: SunIcon },
  { to: '/log', label: 'Log', icon: PenIcon },
  { to: '/progress', label: 'Progress', icon: ChartBarIcon },
  { to: '/coach', label: 'Coach', icon: BotIcon },
];

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 50,
      // extra clearance for the iOS home-indicator safe area on notched devices,
      // degrades to the flat value on everything else
      paddingBottom: 'max(22px, calc(12px + env(safe-area-inset-bottom)))',
    }}>
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0 12px',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: 500,
            gap: '4px',
          })}
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SunIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  );
}
function PenIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  );
}
function ChartBarIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21"/>
      <rect x="5" y="11" width="3.5" height="8" rx="1" fill="currentColor" stroke="none"/>
      <rect x="10.5" y="5.5" width="3.5" height="13.5" rx="1" fill="currentColor" stroke="none"/>
      <rect x="16" y="14" width="3.5" height="5" rx="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function BotIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>
    </svg>
  );
}
