import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, BarChart2, ShieldCheck, CalendarPlus, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { CardListSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { confidenceBadgeClass, confidenceLabel } from './evidenceUtils';
import { TestDayModal } from './TestDayModal';
import { BenchmarkProfileCard } from './BenchmarkProfileCard';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useTeamEvidenceStatus } from '../../hooks/useEvidence';

interface Props {
  teamId: number;
  sportId?: number | null;
}

// Team-wide evidence coverage: which players' scores are measurement-backed and who
// needs a test day. Rows click through to the player's Evidence tab.
export function TeamEvidenceTab({ teamId, sportId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatDate } = useLocaleFormat();
  const { data: status, isLoading } = useTeamEvidenceStatus(teamId);
  const [testDayOpen, setTestDayOpen] = useState(false);

  if (isLoading) return <CardListSkeleton count={4} cols="grid-cols-1" />;
  if (!status || status.players.length === 0) {
    return <EmptyState icon={<ShieldCheck size={40} />}
      title={t('evidence.teamNoPlayers', 'No players yet')}
      description={t('evidence.teamNoPlayersDesc', 'Add players to the roster to track evidence coverage.')} />;
  }

  const callouts = [
    status.playersNeedingTests > 0 && {
      icon: FlaskConical,
      text: t('evidence.teamNeedTests', '{{count}} players have no objective test in the last 30 days', { count: status.playersNeedingTests }),
    },
    status.playersWithoutMatchStats > 0 && {
      icon: BarChart2,
      text: t('evidence.teamNoMatchStats', '{{count}} players have no match stats recorded', { count: status.playersWithoutMatchStats }),
    },
    status.playersWithoutEvidence > 0 && {
      icon: AlertTriangle,
      text: t('evidence.teamNoEvidence', '{{count}} players have no evidence at all', { count: status.playersWithoutEvidence }),
    },
  ].filter(Boolean) as { icon: typeof FlaskConical; text: string }[];

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Benchmark calibration (age/level) for this team's scores */}
      <BenchmarkProfileCard teamId={teamId} sportId={sportId} />

      {/* Callouts + test-day prompt */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            {callouts.length > 0 ? callouts.map((c, i) => (
              <p key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <c.icon size={14} className="text-amber-500 flex-shrink-0" /> {c.text}
              </p>
            )) : (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck size={14} /> {t('evidence.teamAllCovered', 'Every player has recent evidence — great coverage!')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sportId != null && (
              <Button type="button" size="sm" onClick={() => setTestDayOpen(true)}>
                <FlaskConical size={13} /> {t('evidence.testDayTitle', 'Test Day')}
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/teams/${teamId}/bulk-assessment`)}>
              <CalendarPlus size={13} /> {t('evidence.scheduleAssessmentDay', 'Run an Assessment Day')}
            </Button>
          </div>
        </div>
      </div>

      {/* Player rows */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        {status.players.map(p => {
          const pct = status.totalMetrics > 0 ? (p.scoredMetrics / status.totalMetrics) * 100 : 0;
          return (
            <button
              key={p.playerId}
              type="button"
              onClick={() => navigate(`/players/${p.playerId}`)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
            >
              <div className="min-w-0 w-44 flex-shrink-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {p.jerseyNumber != null && <span className="text-gray-400 me-1">#{p.jerseyNumber}</span>}
                  {p.playerName}
                </p>
                <p className="text-[11px] text-gray-400">
                  {p.lastTestAt
                    ? t('evidence.lastTestShort', 'Last test {{date}}', { date: formatDate(p.lastTestAt, { month: 'short', day: 'numeric' }) })
                    : t('evidence.neverTested', 'Never tested')}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                  <span>{t('evidence.metricsCovered', '{{scored}}/{{total}} metrics', { scored: p.scoredMetrics, total: status.totalMetrics })}</span>
                  <span>{t('evidence.verifiedCount', '{{count}} verified', { count: p.verifiedMetrics })}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="flex items-center gap-1 text-[11px] text-gray-400" title={t('evidence.tabTests', 'Objective Tests')}>
                  <FlaskConical size={11} className={p.testCount > 0 ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-700'} /> {p.testCount}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400" title={t('evidence.tabMatchStats', 'Match Stats')}>
                  <BarChart2 size={11} className={p.matchStatCount > 0 ? 'text-sky-500' : 'text-gray-300 dark:text-gray-700'} /> {p.matchStatCount}
                </span>
                {p.overallConfidence ? (
                  <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full w-20 text-center', confidenceBadgeClass(p.overallConfidence))}>
                    {confidenceLabel(p.overallConfidence, t)}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-20 text-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                    {t('evidence.noEvidenceShort', 'No data')}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {testDayOpen && sportId != null && (
        <TestDayModal
          isOpen={testDayOpen}
          onClose={() => setTestDayOpen(false)}
          sportId={sportId}
          players={status.players.map(p => ({ id: p.playerId, name: p.playerName }))}
        />
      )}
    </div>
  );
}
