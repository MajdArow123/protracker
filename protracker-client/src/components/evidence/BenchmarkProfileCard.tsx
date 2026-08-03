import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale, Info } from 'lucide-react';
import { Select } from '../ui/Select';
import { useToast } from '../../context/useToast';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import {
  useBenchmarkProfiles, useTeamBenchmarkProfile, useSetTeamBenchmarkProfile,
} from '../../hooks/useBenchmarks';
import { useSportMetrics, useRecalculateEvidence } from '../../hooks/useEvidence';
import { useTeamEvidenceStatus } from '../../hooks/useEvidence';

interface Props {
  teamId: number;
  sportId: number | null | undefined;
}

// Normalization mirror of the backend 3-anchor interpolation, for the sample line.
function sampleScore(value: number, low: number, mid: number, high: number): number {
  if (low === mid || mid === high) return Math.min(10, Math.max(1, value));
  const t1 = (value - low) / (mid - low);
  const score = t1 <= 1 ? 3 + t1 * 2 : 5 + ((value - mid) / (high - mid)) * 5;
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

// Which age/level calibration this team's evidence scores use. Changing it
// recalculates every player so scores stay consistent with the new anchors.
export function BenchmarkProfileCard({ teamId, sportId }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { formatNumber } = useLocaleFormat();
  const { data: profiles = [] } = useBenchmarkProfiles(sportId);
  const { data: teamProfile } = useTeamBenchmarkProfile(teamId);
  const { data: metrics = [] } = useSportMetrics(sportId);
  const { data: status } = useTeamEvidenceStatus(teamId);
  const setProfile = useSetTeamBenchmarkProfile();
  const recalc = useRecalculateEvidence();
  const [showHelp, setShowHelp] = useState(false);

  const currentId = teamProfile?.benchmarkProfileId ?? null;
  const current = profiles.find(p => p.id === currentId) ?? null;

  // Sample line: the sport's first objective-required metric under the active anchors.
  const sample = useMemo(() => {
    const metric = metrics.find(m => m.isObjectiveRequired && m.inputType !== 'Rating')
      ?? metrics.find(m => m.inputType !== 'Rating');
    if (!metric) return null;
    const v = current?.values.find(x => x.metricDefinitionId === metric.id);
    const low = v?.benchmarkLow ?? metric.benchmarkLow;
    const mid = v?.benchmarkMid ?? metric.benchmarkMid;
    const high = v?.benchmarkHigh ?? metric.benchmarkHigh;
    // A value halfway between "average" and "elite" makes the calibration tangible.
    const value = Math.round(((mid + high) / 2) * 100) / 100;
    return {
      metricName: metric.name,
      unit: metric.unit ?? '',
      value,
      score: sampleScore(value, low, mid, high),
    };
  }, [metrics, current]);

  async function change(value: string) {
    try {
      await setProfile.mutateAsync({ teamId, profileId: value ? Number(value) : null });
      // Re-anchor every player's stored scores to the new calibration.
      const playerIds = (status?.players ?? []).filter(p => p.scoredMetrics > 0).map(p => p.playerId);
      for (const id of playerIds) await recalc.mutateAsync(id);
      addToast(t('evidence.benchmarkChanged', 'Benchmark profile updated — scores recalculated'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Scale size={15} className="text-indigo-500" />
        <h3 className="font-bold text-gray-900 dark:text-white text-sm flex-1">
          {t('evidence.benchmarkTitle', 'Benchmark Profile')}
        </h3>
        <button type="button" onClick={() => setShowHelp(s => !s)}
          className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 cursor-pointer"
          aria-label={t('evidence.benchmarkWhat', 'What is this?')}>
          <Info size={14} />
        </button>
      </div>

      {showHelp && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {t('evidence.benchmarkHelp',
            'Benchmarks calibrate how raw test values map to 1-10 scores. A U14 sprinting 4.5s deserves a higher score than a professional at the same time — pick the profile matching this team\'s age and level.')}
        </p>
      )}

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        {t('evidence.teamUses', 'This team uses:')}{' '}
        <span className="font-bold">
          {current?.name ?? t('evidence.sportDefaults', 'Sport defaults (Amateur Adult)')}
        </span>
      </p>

      <Select
        value={currentId != null ? String(currentId) : ''}
        onChange={e => change(e.target.value)}
        options={[
          { value: '', label: t('evidence.sportDefaults', 'Sport defaults (Amateur Adult)') },
          ...profiles.map(p => ({
            value: String(p.id),
            label: p.isMine ? `${p.name} · ${t('evidence.customProfile', 'custom')}` : p.name,
          })),
        ]}
      />

      {sample && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          {t('evidence.benchmarkSample',
            'With this profile, a {{value}} {{unit}} {{metric}} result = {{score}}/10', {
              value: formatNumber(sample.value), unit: sample.unit,
              metric: sample.metricName, score: sample.score.toFixed(1),
            })}
        </p>
      )}
    </div>
  );
}
