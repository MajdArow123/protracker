import type { FormationDef } from './lineupFormations';

// Miniature dot-diagram of a formation (pure render of slot x/y). Decorative —
// the pill's text label carries the accessible name.
export function FormationPreview({ formation }: { formation: FormationDef }) {
  return (
    <svg viewBox="0 0 68 105" className="w-4 h-6 flex-shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="66" height="103" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      {formation.slots.map(s => (
        <circle key={s.key} cx={(s.x / 100) * 68} cy={(s.y / 100) * 105} r="5" fill="currentColor" />
      ))}
    </svg>
  );
}
