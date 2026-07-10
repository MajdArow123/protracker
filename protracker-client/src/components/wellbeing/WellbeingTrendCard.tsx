import { useTranslation } from 'react-i18next';
import { HeartPulse, Smile, Zap, Moon, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { usePlayerWellbeing } from '../../hooks/useWellbeing';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { LineChartWrapper } from '../charts/LineChartWrapper';
import { EmptyState } from '../ui/EmptyState';

function StatTile({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">{icon}<span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="text-xl font-black text-gray-900 dark:text-white">{value}{suffix && <span className="text-xs text-gray-400 ml-0.5">{suffix}</span>}</p>
    </div>
  );
}

export function WellbeingTrendCard({ playerId }: { playerId: number }) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (d: string) => formatDate(d, { month: 'short', day: 'numeric' });
  const { data, isLoading } = usePlayerWellbeing(playerId, 30);

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  }

  const checkins = data?.checkins ?? [];
  const painReports = checkins.filter(c => c.hasPain).slice().reverse();

  const chartData = checkins.map(c => ({ name: fmtDate(c.date), score: c.score }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
            <HeartPulse size={16} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">{t('wellbeing.last30', 'Wellbeing — Last 30 Days')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{checkins.length === 1 ? t('wellbeing.checkinCountOne', '{{n}} check-in', { n: checkins.length }) : t('wellbeing.checkinCountMany', '{{n}} check-ins', { n: checkins.length })}</p>
          </div>
        </div>

        {checkins.length === 0 ? (
          <EmptyState icon={<HeartPulse size={32} />} title={t('wellbeing.noCheckinsTitle', 'No check-ins yet')}
            description={t('wellbeing.noCheckinsDesc', "This athlete hasn't submitted any daily wellbeing check-ins.")} size="sm" />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
              <StatTile icon={<Smile size={13} />} label={t('wellbeing.feeling', 'Feeling')} value={data?.avgFeeling != null ? data.avgFeeling.toFixed(1) : '—'} suffix="/5" />
              <StatTile icon={<Zap size={13} />} label={t('wellbeing.energy', 'Energy')} value={data?.avgEnergy != null ? data.avgEnergy.toFixed(1) : '—'} suffix="/5" />
              <StatTile icon={<Moon size={13} />} label={t('wellbeing.sleep', 'Sleep')} value={data?.avgSleep != null ? data.avgSleep.toFixed(1) : '—'} suffix="/5" />
              <StatTile icon={<HeartPulse size={13} />} label={t('wellbeing.avgScore', 'Avg Score')} value={data?.avgScore != null ? data.avgScore.toFixed(1) : '—'} suffix="/10" />
            </div>
            <LineChartWrapper
              data={chartData}
              series={[{ key: 'score', name: t('wellbeing.wellbeing', 'Wellbeing'), color: '#6366f1' }]}
              height={260}
              focusedKey={null}
              yAxisLabel={t('wellbeing.wellbeingScore', 'Wellbeing score')}
            />
          </>
        )}
      </div>

      {painReports.length > 0 && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-red-500" />
            <h3 className="font-bold text-gray-900 dark:text-white">{t('wellbeing.painReports', 'Pain Reports')}</h3>
            <span className="text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5">{data?.painDays ?? painReports.length}</span>
          </div>
          <div className="space-y-2">
            {painReports.slice(0, 8).map(c => (
              <div key={c.id} className={clsx('rounded-xl border p-3 bg-white dark:bg-gray-900', 'border-red-100 dark:border-red-900/40')}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.painArea || t('wellbeing.painReportedNoArea', 'Pain reported')}</p>
                  <span className="text-[11px] text-gray-400">{fmtDate(c.date)}</span>
                </div>
                {c.painNote && <p className="text-xs text-gray-600 dark:text-gray-400">{c.painNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
