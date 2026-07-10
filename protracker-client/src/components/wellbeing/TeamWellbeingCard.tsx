import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse, ShieldAlert, ChevronRight, Users, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useTeamWellbeing } from '../../hooks/useWellbeing';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

function scoreColor(score: number) {
  return score < 4 ? 'text-red-500 bg-red-500/10' : score < 7 ? 'text-amber-500 bg-amber-500/10' : 'text-green-500 bg-green-500/10';
}

export function TeamWellbeingCard() {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const navigate = useNavigate();
  const { data, isLoading } = useTeamWellbeing();

  if (isLoading) {
    return <div className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  }
  if (!data || data.totalPlayers === 0) return null;

  // Pain-during-recovery players float to the top, then those who checked in, then the rest.
  const players = [...data.players].sort((a, b) => {
    if (a.painDuringRecovery !== b.painDuringRecovery) return a.painDuringRecovery ? -1 : 1;
    if (a.checkedInToday !== b.checkedInToday) return a.checkedInToday ? -1 : 1;
    return a.playerName.localeCompare(b.playerName);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse size={17} className="text-indigo-500" />
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('wellbeing.teamWellbeing', 'Team Wellbeing')}</h2>
        {data.painAlerts > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5">
            <ShieldAlert size={12} /> {data.painAlerts === 1 ? t('wellbeing.alertOne', '{{n}} alert', { n: data.painAlerts }) : t('wellbeing.alertMany', '{{n}} alerts', { n: data.painAlerts })}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 border-b border-gray-100 dark:border-gray-800">
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1"><CheckCircle2 size={13} /></div>
            <p className="text-xl font-black text-gray-900 dark:text-white">{data.checkedInToday}<span className="text-sm text-gray-400">/{data.totalPlayers}</span></p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{t('wellbeing.checkedInTodayLabel', 'Checked in today')}</p>
          </div>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1"><HeartPulse size={13} /></div>
            <p className={clsx('text-xl font-black', data.avgScoreToday == null ? 'text-gray-400' : data.avgScoreToday < 4 ? 'text-red-500' : data.avgScoreToday < 7 ? 'text-amber-500' : 'text-green-500')}>
              {data.avgScoreToday != null ? data.avgScoreToday.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{t('wellbeing.avgScoreToday', 'Avg score today')}</p>
          </div>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1"><ShieldAlert size={13} /></div>
            <p className={clsx('text-xl font-black', data.painAlerts > 0 ? 'text-red-500' : 'text-gray-400')}>{data.painAlerts}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{t('wellbeing.painAlerts', 'Pain alerts')}</p>
          </div>
        </div>

        {/* Player rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[360px] overflow-y-auto">
          {players.map(p => {
            const c = p.latestCheckin;
            return (
              <button
                key={p.playerId}
                onClick={() => navigate(`/players/${p.playerId}`)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  p.painDuringRecovery && 'bg-red-50/60 dark:bg-red-900/10',
                )}
              >
                {c ? (
                  <div className={clsx('flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm flex-shrink-0', scoreColor(c.score))}>
                    {c.score.toFixed(1)}
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex-shrink-0">
                    <Users size={16} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.playerName}</p>
                    {p.painDuringRecovery && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0">
                        <ShieldAlert size={10} /> {t('wellbeing.painRecovery', 'Pain + recovery')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {c
                      ? p.checkedInToday
                        ? c.hasPain
                          ? t('wellbeing.checkedInPain', 'Checked in today · pain: {{area}}', { area: c.painArea || t('wellbeing.reported', 'reported') })
                          : t('wellbeing.checkedInTodayLabel', 'Checked in today')
                        : t('wellbeing.lastCheckin', 'Last: {{date}}', { date: formatDate(c.date, { month: 'short', day: 'numeric' }) })
                      : t('wellbeing.noCheckinsYet', 'No check-ins yet')}
                  </p>
                </div>
                <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
