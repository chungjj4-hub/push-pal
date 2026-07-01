/**
 * CoachNote — the distinct visual signature for when Push Pal's AI coach is
 * *speaking* (synthesized take), not reporting data. Use everywhere the coach
 * talks: the daily briefing closing note, chat responses, future nudges.
 *
 *   <CoachNote>{briefing.coachNote}</CoachNote>
 *
 * Light indigo palette (translucent lavender card, indigo header, dark-navy
 * serif body) — sits as a bright "the coach is talking to you" panel on the
 * dark app surface.
 */
const VOICE = {
  bg: 'rgba(244, 242, 255, 0.88)',   // translucent light lavender
  border: '#5b4fe8',                  // darker-purple outline
  brand: '#5b4fe8',                   // header / bolt
  text: '#2b2470',                    // dark navy-indigo body
};

export default function CoachNote({ children, label = 'Push Pal' }) {
  return (
    <div
      style={{
        background: VOICE.bg,
        border: `1.5px solid ${VOICE.border}`,
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <BoltGlyph size={14} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: VOICE.brand }}>{label}</span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-voice)',
          fontSize: '14px',
          fontStyle: 'italic',
          color: VOICE.text,
          lineHeight: 1.7,
        }}
      >
        {renderEmphasis(children)}
      </div>
    </div>
  );
}

/* Render **bold** spans in the same dark-navy color at medium weight,
   never a different color. Plain strings pass straight through. */
function renderEmphasis(content) {
  if (typeof content !== 'string') return content;
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 600, color: VOICE.text }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function BoltGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
        fill={VOICE.brand}
      />
    </svg>
  );
}
