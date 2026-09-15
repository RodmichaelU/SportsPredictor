// The app's mark: a shield (the classic sports-crest silhouette) containing
// an ascending trend line with a highlighted endpoint -- predicting the
// outcome, not just displaying it. Pure SVG so it's crisp at any size, from
// a 16px browser tab to a large hero mark, with no image asset to manage.
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Sports Predictor">
      <defs>
        <linearGradient id="sp-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M8 8 L40 8 L40 26 C40 36 33 44 24 46 C15 44 8 36 8 26 Z"
        fill="url(#sp-logo-gradient)"
      />
      <polyline
        points="13,31 20,24 26,28 35,15"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="35" cy="15" r="3.4" fill="white" />
    </svg>
  );
}
