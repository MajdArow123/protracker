import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Check, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FitAssessment, FitCategory } from './lineupFitLogic';

// The selection-time position-fit annotation (Phase 4): while a player is
// selected or dragged, every other slot wears this chip for THAT player.
// Category is conveyed by a distinct ICON + text (title + sr-only), never by
// color alone. 'cantAssess' renders the honest "?" (user ruling) — the Phase 3
// SEC/OOP badges keep suppressing unknown positions, unchanged.

const META: Record<FitCategory, { icon: LucideIcon; cls: string; key: string; fallback: string }> = {
  natural: { icon: Check, cls: 'bg-emerald-500 text-white', key: 'teams.fitNatural', fallback: 'Natural position' },
  secondary: { icon: ArrowLeftRight, cls: 'bg-sky-500 text-white', key: 'teams.fitSecondary', fallback: 'Secondary position (coach-entered)' },
  outOfPosition: { icon: AlertTriangle, cls: 'bg-amber-400 text-amber-950', key: 'teams.lineupOutOfPosition', fallback: 'Out of position' },
  cantAssess: { icon: HelpCircle, cls: 'bg-gray-400 text-white', key: 'teams.fitCantAssess', fallback: "Can't assess — no position set" },
};

export function FitChip({ fit }: { fit: FitAssessment }) {
  const { t } = useTranslation();
  const meta = META[fit.category];
  const Icon = meta.icon;
  const label = t(meta.key, meta.fallback);
  const foot = fit.footFact
    ? ` · ${t('teams.fitFootFact', 'Preferred foot: {{foot}} (coach-entered)', { foot: t(`teams.foot${fit.footFact}`, fit.footFact) })}`
    : '';
  // Fit is CALCULATED — the title states the method (Phase 0 provenance rule).
  const title = `${label}${foot} — ${t('teams.fitMethodTitle', 'Position fit: from primary/secondary position vs this slot’s natural positions')}`;

  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full shadow-sm ${meta.cls}`}
      title={title}
      role="img"
      aria-label={label + foot}
    >
      <Icon size={10} aria-hidden="true" />
    </span>
  );
}
