// Sport surface backgrounds. Purely decorative — players are absolutely
// positioned over them by the section. Surfaces are fixed spatial diagrams and
// stay LTR in RTL locales (chart convention). Aspect ratios live on the layout
// (lineupLayouts) so the section can size the container before choosing a surface.

const LINE = { fill: 'none', stroke: 'white', strokeOpacity: 0.5, strokeWidth: 0.5 } as const;

// Soccer pitch (portrait, own goal at the bottom, real 68m × 105m proportions).
export function SoccerPitchSurface() {
  return (
    <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineup-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a8a46" />
          <stop offset="1" stopColor="#14683a" />
        </linearGradient>
      </defs>
      <rect width="68" height="105" rx="2.5" fill="url(#lineup-grass)" />
      {Array.from({ length: 7 }, (_, i) => i % 2 === 0 && (
        <rect key={i} y={i * 15} width="68" height="15" fill="white" opacity="0.045" />
      ))}
      <rect x="2" y="2" width="64" height="101" {...LINE} />
      <line x1="2" y1="52.5" x2="66" y2="52.5" {...LINE} />
      <circle cx="34" cy="52.5" r="9.15" {...LINE} />
      <circle cx="34" cy="52.5" r="0.8" fill="white" fillOpacity="0.5" />
      <rect x="13.84" y="2" width="40.32" height="16.5" {...LINE} />
      <rect x="24.84" y="2" width="18.32" height="5.5" {...LINE} />
      <circle cx="34" cy="13" r="0.8" fill="white" fillOpacity="0.5" />
      <path d="M 26.69 18.5 A 9.15 9.15 0 0 0 41.31 18.5" {...LINE} />
      <rect x="13.84" y="86.5" width="40.32" height="16.5" {...LINE} />
      <rect x="24.84" y="97.5" width="18.32" height="5.5" {...LINE} />
      <circle cx="34" cy="92" r="0.8" fill="white" fillOpacity="0.5" />
      <path d="M 26.69 86.5 A 9.15 9.15 0 0 1 41.31 86.5" {...LINE} />
    </svg>
  );
}

// Basketball half-court (basket at the top, FIBA 15m × 14m proportions, ~10px/m).
export function BasketballCourtSurface() {
  return (
    <svg viewBox="0 0 150 140" className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineup-hardwood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3672f" />
          <stop offset="1" stopColor="#8a5426" />
        </linearGradient>
      </defs>
      <rect width="150" height="140" rx="3" fill="url(#lineup-hardwood)" />
      {Array.from({ length: 8 }, (_, i) => i % 2 === 0 && (
        <rect key={i} x={i * 18.75} width="18.75" height="140" fill="white" opacity="0.04" />
      ))}
      <rect x="3" y="3" width="144" height="134" {...LINE} />
      {/* Key / paint with free-throw circle */}
      <rect x="50.5" y="3" width="49" height="55" {...LINE} />
      <circle cx="75" cy="58" r="18" {...LINE} />
      {/* Backboard + rim */}
      <line x1="66" y1="10" x2="84" y2="10" stroke="white" strokeOpacity="0.6" strokeWidth="1.2" />
      <circle cx="75" cy="14.5" r="2.6" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.8" />
      {/* Three-point line: straight corner segments + arc */}
      <path d="M 9 3 L 9 17 A 66 66 0 0 0 141 17 L 141 3" {...LINE} />
      {/* Half-court line + center circle arc */}
      <line x1="3" y1="137" x2="147" y2="137" {...LINE} />
      <path d="M 57 137 A 18 18 0 0 1 93 137" {...LINE} />
    </svg>
  );
}

// Indoor volleyball — own half (net at the top, 9m wide, attack line 3m back).
export function VolleyballCourtSurface() {
  return (
    <svg viewBox="0 0 90 100" className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineup-vb-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
      </defs>
      <rect width="90" height="100" rx="2.5" fill="url(#lineup-vb-floor)" />
      {/* Front zone tinted (net to attack line) */}
      <rect x="4" y="7" width="82" height="29" fill="#f59e0b" opacity="0.18" />
      <rect x="4" y="7" width="82" height="89" {...LINE} />
      {/* Attack line (3m of the 9m half) */}
      <line x1="4" y1="36" x2="86" y2="36" stroke="white" strokeOpacity="0.55" strokeWidth="0.7" />
      {/* Net */}
      <line x1="0" y1="7" x2="90" y2="7" stroke="white" strokeOpacity="0.75" strokeWidth="1.4" />
      <line x1="0" y1="4.2" x2="90" y2="4.2" stroke="white" strokeOpacity="0.35" strokeWidth="0.5" />
    </svg>
  );
}

// Beach volleyball — own half (sand, net at the top, no attack line).
export function BeachCourtSurface() {
  return (
    <svg viewBox="0 0 80 90" className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineup-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcb072" />
          <stop offset="1" stopColor="#c99b5c" />
        </linearGradient>
      </defs>
      <rect width="80" height="90" rx="2.5" fill="url(#lineup-sand)" />
      {/* Soft sand texture */}
      <circle cx="20" cy="42" r="9" fill="white" opacity="0.05" />
      <circle cx="58" cy="64" r="12" fill="white" opacity="0.05" />
      <circle cx="42" cy="26" r="7" fill="white" opacity="0.05" />
      {/* Court boundary (webbing tape) */}
      <rect x="6" y="8" width="68" height="76" fill="none" stroke="#1d4ed8" strokeOpacity="0.55" strokeWidth="1" />
      {/* Net */}
      <line x1="0" y1="8" x2="80" y2="8" stroke="white" strokeOpacity="0.8" strokeWidth="1.4" />
      <line x1="0" y1="5.2" x2="80" y2="5.2" stroke="white" strokeOpacity="0.35" strokeWidth="0.5" />
    </svg>
  );
}

export function SportSurface({ sportId }: { sportId: number }) {
  switch (sportId) {
    case 1: return <SoccerPitchSurface />;
    case 2: return <BasketballCourtSurface />;
    case 3: return <VolleyballCourtSurface />;
    case 4: return <BeachCourtSurface />;
    default: return null;
  }
}
