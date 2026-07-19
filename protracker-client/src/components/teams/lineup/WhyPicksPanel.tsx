import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { SourceBadge } from '../../ui/SourceBadge';
import { confidenceLabel } from '../../evidence/evidenceUtils';
import type { SlotExplanation, PickReason, PickCaveat } from './lineupFitLogic';
import type { EvidenceConfidence } from '../../../types';

// "Why these picks" (Phase 4): renders explainSuggestion's typed reasons for
// the suggestion it was computed WITH — the board hides this panel the moment
// the arrangement diverges (an explanation must never describe an arrangement
// it didn't produce). Framed as a suggestion; "optimal"/"best" never appear.

interface Props {
  explanations: SlotExplanation[];
  nameOf: (id?: number | null) => string;
  onClose: () => void;
}

export function WhyPicksPanel({ explanations, nameOf, onClose }: Props) {
  const { t } = useTranslation();

  const conf = (c: EvidenceConfidence) => confidenceLabel(c, t);

  const sentence = (reason: PickReason): string => {
    switch (reason.code) {
      case 'selectedOver': {
        const name = nameOf(reason.overId);
        switch (reason.detail.kind) {
          case 'higherValue':
            return t('teams.whyHigherValue', 'Selected over {{name}}: higher evidence ({{a}} vs {{b}})',
              { name, a: reason.detail.a.toFixed(1), b: reason.detail.b.toFixed(1) });
          case 'confidenceTiebreak':
            return t('teams.whyConfidenceTiebreak', 'Selected over {{name}}: equal rating ({{value}}) — higher confidence ({{a}} vs {{b}})',
              { name, value: reason.detail.value.toFixed(1), a: conf(reason.detail.a), b: conf(reason.detail.b) });
          case 'coverageTiebreak':
            return t('teams.whyCoverageTiebreak', 'Selected over {{name}}: equal rating — more scored metrics ({{a}} vs {{b}})',
              { name, a: reason.detail.a, b: reason.detail.b });
          case 'runnerUpNoEvidence':
            return t('teams.whyRunnerUpNoEvidence', 'Selected over {{name}} — no evidence to compare against', { name });
          case 'alphabetical':
            return t('teams.whyAlphabetical', 'No evidence to compare with {{name}} — alphabetical order', { name });
        }
        break;
      }
      case 'onlyEligible':
        return t('teams.whyOnlyEligible', 'Only eligible player for this slot');
      case 'uncontested':
        return t('teams.whyUncontested', 'No benched contender for this slot');
      case 'rescued':
        return t('teams.whyRescued', 'Seated after {{name}} shifted to {{slot}} to free this spot',
          { name: nameOf(reason.displacedId), slot: reason.displacedToSlot });
      case 'movedForRescue':
        return t('teams.whyMovedForRescue', 'Shifted from {{slot}} so {{name}} could be seated',
          { slot: reason.rescuedSlot, name: nameOf(reason.rescuedId) });
      case 'noEligible':
        return t('teams.whyNoEligible', 'No eligible player — left empty');
    }
    return '';
  };

  const caveatText: Record<PickCaveat, string> = {
    thinData: t('teams.whyCaveatThin', 'thin data'),
    noEvidence: t('teams.whyCaveatNoEvidence', 'no evidence yet'),
    injured: t('teams.lineupInjured', 'Injured'),
    fitnessNotRecorded: t('teams.whyCaveatFitness', 'fitness not recorded'),
  };

  return (
    <section
      aria-label={t('teams.whyTitle', 'Suggested XI — why these picks')}
      className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
          {t('teams.whyTitle', 'Suggested XI — why these picks')}
        </h4>
        <span className="flex items-center gap-1.5">
          <SourceBadge
            source="calculated"
            size="xs"
            title={t('teams.whyMethod', 'Calculated · evidence value first; confidence only breaks exact ties')}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <X size={13} />
          </button>
        </span>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
        {t('teams.whyCaption', 'A suggestion computed from evidence ratings and positions — the call is yours.')}
      </p>
      <ul className="space-y-1">
        {explanations.map(e => (
          <li key={e.slotKey} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
            <span className="w-8 flex-shrink-0 font-bold text-gray-400">{e.slotKey}</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {e.playerId != null ? nameOf(e.playerId) : '—'}
            </span>
            <span className="text-gray-500 dark:text-gray-400">{sentence(e.reason)}</span>
            {e.caveats.map(c => (
              <span
                key={c}
                className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold"
              >
                {caveatText[c]}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
