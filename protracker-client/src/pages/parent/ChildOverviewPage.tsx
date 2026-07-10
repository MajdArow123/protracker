import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Activity, ShieldAlert, Calendar, CheckSquare, HeartPulse, Trophy, Clock, MapPin,
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { useChildOverview } from '../../hooks/useParent';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { formatHeight, formatWeight, getStoredHeightUnit, getStoredWeightUnit } from '../../utils/units';
import { clsx } from 'clsx';

function scoreColor(v: number | null | undefined): string {
  if (v == null) return 'text-gray-400';
  if (v < 5) return 'text-red-500';
  if (v <= 7) return 'text-amber-500';
  return 'text-emerald-500';
}
const PRIORITY_CLR: Record<string, string> = {
  High: 'text-red-500', Medium: 'text-amber-500', Low: 'text-gray-400',
};
const SEVERITY_CLR: Record<string, string> = {
  Severe: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  Moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  Minor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
};

export function ChildOverviewPage() {
  const { t: tr } = useTranslation();
  const labels = useDynamicLabels();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric' });
  const fmtDateTime = (iso: string) => formatDateTime(iso, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const { id } = useParams();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { data: child, isLoading, isError, refetch } = useChildOverview(playerId);

  if (isLoading) return <PageWrapper><DetailSkeleton /></PageWrapper>;
  if (isError || !child) return <PageWrapper><ErrorState onRetry={refetch} /></PageWrapper>;

  const heightUnit = getStoredHeightUnit();
  const weightUnit = getStoredWeightUnit();
  const radarData = Object.entries(child.averageScoreByCategory).map(([subject, value]) => ({ subject, value }));
  const meta = [child.positionName, child.teamName, child.sportName].filter(Boolean).join(' · ');

  return (
    <PageWrapper>
      <button onClick={() => navigate('/parent-dashboard')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-500 transition-colors cursor-pointer mb-2">
        <ArrowLeft size={16} /> {tr('parent.myChildren', 'My Children')}
      </button>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl font-black flex-shrink-0">
            {child.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">{child.fullName}</h1>
            <p className="text-sm text-white/80 mt-0.5">{meta}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {child.age != null && <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">{tr('parent.ageLabel', 'Age {{age}}', { age: child.age })}</span>}
              {child.height ? <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">{formatHeight(child.height, heightUnit)}</span> : null}
              {child.weight ? <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">{formatWeight(child.weight, weightUnit)}</span> : null}
              {child.fitnessLevel != null && <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">{tr('parent.fitnessLabel', 'Fitness {{level}}/10', { level: child.fitnessLevel })}</span>}
            </div>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-3xl font-black">{child.overallAverage != null ? child.overallAverage.toFixed(1) : '—'}</p>
            <p className="text-[11px] text-white/70 uppercase tracking-wide">{tr('parent.overallAvg', 'Overall Avg')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Skill radar */}
        <Card header={<span className="flex items-center gap-2"><Trophy size={16} className="text-indigo-500" /> {tr('parent.skillProfile', 'Skill Profile')}</span>}>
          {radarData.length === 0 ? (
            <EmptyState title={tr('parent.noAssessmentsTitle', 'No assessments yet')} description={tr('parent.noAssessmentsDesc', 'Scores will appear once the coach records an assessment.')} />
          ) : (
            <RadarChartWrapper data={radarData} height={300} />
          )}
        </Card>

        {/* Wellbeing */}
        <Card header={<span className="flex items-center gap-2"><HeartPulse size={16} className="text-pink-500" /> {tr('parent.wellbeing', 'Wellbeing')}</span>}>
          {child.wellbeing.length === 0 ? (
            <EmptyState title={tr('parent.noCheckinsTitle', 'No check-ins yet')} description={tr('parent.noCheckinsDesc', "Your child hasn't logged a wellbeing check-in.")} />
          ) : (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className={clsx('text-3xl font-black', scoreColor(child.wellbeingScore))}>{child.wellbeingScore?.toFixed(1) ?? '—'}</span>
                <span className="text-xs text-gray-400">{tr('parent.latestOutOf10', '/ 10 latest')}</span>
              </div>
              <div className="flex items-end gap-1 h-24">
                {child.wellbeing.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${fmtDate(w.date)}: ${w.score}/10`}>
                    <div
                      className={clsx('w-full rounded-t', w.hasPain ? 'bg-red-400' : 'bg-indigo-400')}
                      style={{ height: `${Math.max(6, (w.score / 10) * 88)}px` }}
                    />
                    <span className="text-[9px] text-gray-400">{fmtDate(w.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Injuries */}
        <Card header={<span className="flex items-center gap-2"><ShieldAlert size={16} className="text-red-500" /> {tr('parent.activeInjuries', 'Active Injuries')}</span>}>
          {child.injuries.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{tr('parent.noInjuries', 'No active injuries — all clear. 🎉')}</p>
          ) : (
            <div className="space-y-2">
              {child.injuries.map((inj, i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{inj.injuryType}{inj.bodyPart ? ` · ${inj.bodyPart}` : ''}</p>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', SEVERITY_CLR[inj.severity] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500')}>{labels.generic('severity', inj.severity)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {labels.generic('recoveryStatus', inj.recoveryStatus)} · {tr('parent.since', 'since')} {fmtDate(inj.injuryDate)}
                    {inj.expectedReturnDate ? ` · ${tr('parent.backPrefix', 'back ~')}${fmtDate(inj.expectedReturnDate)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming sessions */}
        <Card header={<span className="flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> {tr('parent.upcomingSessions', 'Upcoming Sessions')}</span>}>
          {child.upcomingSessions.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{tr('parent.noSessions', 'No sessions scheduled.')}</p>
          ) : (
            <div className="space-y-2">
              {child.upcomingSessions.map((s, i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{s.title}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{labels.sessionType(s.sessionType)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={11} /> {fmtDateTime(s.startTime)} · {tr('parent.durationMin', '{{count}}min', { count: s.durationMinutes })}</span>
                    {s.location && <span className="flex items-center gap-1"><MapPin size={11} /> {s.location}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tasks */}
        <Card className="lg:col-span-2" header={<span className="flex items-center gap-2"><CheckSquare size={16} className="text-emerald-500" /> {tr('parent.tasks', 'Tasks')}</span>}>
          {child.tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{tr('parent.noTasks', 'No tasks assigned.')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {child.tasks.map((t, i) => (
                <div key={i} className={clsx('rounded-xl border p-3', t.isCompleted ? 'border-gray-200 dark:border-gray-800 opacity-60' : 'border-gray-200 dark:border-gray-700')}>
                  <div className="flex items-start gap-2">
                    <CheckSquare size={14} className={clsx('mt-0.5 flex-shrink-0', t.isCompleted ? 'text-emerald-500' : 'text-gray-300')} />
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium text-gray-900 dark:text-white', t.isCompleted && 'line-through')}>{t.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className={PRIORITY_CLR[t.priority] ?? ''}>{labels.priority(t.priority)}</span> · {labels.category(t.category)}
                        {t.dueDate ? ` · ${tr('parent.due', 'due')} ${fmtDate(t.dueDate)}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5 mt-2">
        <Activity size={12} /> {tr('parent.readOnlyNote', 'This is a read-only view shared with you by the coach.')}
      </p>
    </PageWrapper>
  );
}
