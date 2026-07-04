import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import {
  ArrowLeft, ClipboardList, CheckCircle2, AlertTriangle, Clock,
  Trophy, TrendingDown, BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTaskAnalytics } from '../../hooks/useTasks';
import { CountUp } from '../../components/ui/CountUp';
import type { PlayerTaskStats } from '../../types';

function rateColor(rate: number) {
  return rate < 50 ? '#ef4444' : rate < 80 ? '#f59e0b' : '#10b981';
}
function rateText(rate: number) {
  return rate < 50 ? 'text-red-500' : rate < 80 ? 'text-amber-500' : 'text-green-500';
}

function ChartTooltip({ active, payload, label, suffix }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl min-w-[150px]">
      <p className="text-xs font-semibold text-gray-400 mb-2 pb-1.5 border-b border-slate-800">{label}</p>
      <div className="space-y-1.5">
        {payload.map(p => (
          <div key={p.name} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-gray-300">{p.name}</span>
            </span>
            <span className="font-bold text-white tabular-nums">{p.value}{suffix ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalloutCard({ variant, stats }: { variant: 'top' | 'attention'; stats: PlayerTaskStats }) {
  const isTop = variant === 'top';
  return (
    <div className={clsx('rounded-2xl border p-5',
      isTop ? 'border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-900/10'
        : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10')}>
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx('inline-flex p-2 rounded-xl', isTop ? 'bg-green-500/15' : 'bg-amber-500/15')}>
          {isTop ? <Trophy size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-amber-500" />}
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{isTop ? 'Top Performer' : 'Needs Attention'}</h3>
      </div>
      <p className="text-lg font-black text-gray-900 dark:text-white">{stats.playerName}</p>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
        <span className={clsx('font-bold', rateText(stats.completionRate))}>{stats.completionRate}% complete</span>
        <span>{stats.completed}/{stats.total} tasks</span>
        {stats.overdue > 0 && <span className="text-red-500 font-semibold">{stats.overdue} overdue</span>}
      </div>
    </div>
  );
}

export function TaskAnalyticsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useTaskAnalytics();

  if (isLoading) return <PageSpinner />;

  const backBtn = (
    <button onClick={() => navigate('/tasks')}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer">
      <ArrowLeft size={15} /> Back to Tasks
    </button>
  );

  if (!data || data.total === 0) {
    return (
      <PageWrapper title="Task Analytics" actions={backBtn}>
        <EmptyState icon={<BarChart3 size={40} />} title="No task data yet"
          description="Assign tasks to your players to see completion analytics here." />
      </PageWrapper>
    );
  }

  const statCards = [
    { label: 'Total Tasks', num: data.total, suffix: '', decimals: 0, icon: ClipboardList, bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    { label: 'Completion Rate', num: data.completionRate, suffix: '%', decimals: 0, icon: CheckCircle2, bg: 'bg-green-500/10', text: rateText(data.completionRate) },
    { label: 'Overdue', num: data.overdue, suffix: '', decimals: 0, icon: AlertTriangle, bg: 'bg-red-500/10', text: 'text-red-500' },
    { label: 'Avg Days to Complete', num: data.avgDaysToComplete ?? null, suffix: '', decimals: 1, icon: Clock, bg: 'bg-amber-500/10', text: 'text-amber-500' },
  ];

  const playerChartData = data.playerStats.map(p => ({ name: p.playerName, rate: p.completionRate }));
  const categoryChartData = data.categoryStats.map(c => ({ name: c.category, Assigned: c.total, Completed: c.completed }));
  const trendData = data.weeklyTrend.map(w => ({ name: w.weekLabel, Assigned: w.assigned, Completed: w.completed }));

  // Height grows with player count so bars stay readable.
  const playerChartHeight = Math.max(200, data.playerStats.length * 42 + 40);

  return (
    <PageWrapper title="Task Analytics" actions={backBtn}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className={clsx('inline-flex p-2.5 rounded-xl mb-3', c.bg)}>
              <c.icon size={18} className={c.text} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{c.label}</p>
            {c.num == null
              ? <p className={clsx('text-3xl font-black mt-0.5', c.text)}>—</p>
              : <CountUp value={c.num} suffix={c.suffix} decimals={c.decimals} className={clsx('text-3xl font-black mt-0.5 block', c.text)} />}
          </div>
        ))}
      </div>

      {/* Callouts */}
      {(data.topPerformer || data.needsAttention) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.topPerformer && <CalloutCard variant="top" stats={data.topPerformer} />}
          {data.needsAttention && <CalloutCard variant="attention" stats={data.needsAttention} />}
        </div>
      )}

      {/* Player completion rate */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Completion Rate by Player</h3>
        <ResponsiveContainer width="100%" height={playerChartHeight}>
          <BarChart data={playerChartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label as string} suffix="%" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="rate" name="Completion" radius={[0, 5, 5, 0]} maxBarSize={26}>
              {playerChartData.map((d, i) => <Cell key={i} fill={rateColor(d.rate)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryChartData} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label as string} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }} />
              <Bar dataKey="Assigned" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly trend */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Weekly Trend (8 weeks)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label as string} />} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }} />
              <Line type="monotone" dataKey="Assigned" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PageWrapper>
  );
}
