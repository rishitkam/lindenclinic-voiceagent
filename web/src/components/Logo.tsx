/**
 * Linden mark: an iOS-style rounded square ("squircle") with a white linden leaf
 * whose centre vein is a small voice waveform, for the clinic name plus voice.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a83ec" />
          <stop offset="1" stopColor="#3f48bd" />
        </linearGradient>
        <linearGradient id="logo-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* squircle: superellipse-like path, softer than a plain rounded rect */}
      <path
        d="M32 0C52 0 64 12 64 32S52 64 32 64 0 52 0 32 12 0 32 0Z"
        fill="url(#logo-bg)"
      />
      <path d="M32 0C52 0 64 12 64 32S52 64 32 64 0 52 0 32 12 0 32 0Z" fill="url(#logo-gloss)" />
      {/* leaf */}
      <path
        d="M32 12c10 6 15 13 15 21 0 9-7 16-15 18-8-2-15-9-15-18 0-8 5-15 15-21Z"
        fill="#ffffff"
      />
      {/* stem */}
      <path d="M32 51v5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      {/* waveform vein */}
      <g stroke="#5b65dc" strokeWidth="3" strokeLinecap="round">
        <path d="M24.5 31v4" />
        <path d="M28.5 27v12" />
        <path d="M32.5 23v20" />
        <path d="M36.5 28v10" />
        <path d="M40.5 31.5v3" />
      </g>
    </svg>
  );
}
