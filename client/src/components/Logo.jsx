/**
 * Push Pal logo mark — a rounded-square with a centered white bolt.
 * Everything is drawn in a 0..24 viewBox so the whole mark scales with `size`.
 *
 *   <Logo size={26} />                       header / nav (indigo square)
 *   <Logo size={64} variant="splash" />      splash screen (translucent square)
 *
 * Corner radius ≈ 0.3·size (8px @ 26, ~19px @ 64) unless overridden.
 */
export default function Logo({ size = 26, variant = 'brand', radius }) {
  const rx = radius != null ? (radius / size) * 24 : 7.2; // in 24-space
  const bg = variant === 'splash' ? 'rgba(255,255,255,0.15)' : 'var(--brand)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Push Pal"
      role="img"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="24" height="24" rx={rx} fill={bg} />
      {/* bolt, centered at (12,12) and scaled to ~60% for breathing room */}
      <g transform="translate(12 12) scale(0.6) translate(-12 -12)">
        <path
          d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}
