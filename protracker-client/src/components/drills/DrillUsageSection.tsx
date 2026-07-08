import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { Dumbbell } from 'lucide-react';
import { useDrillAnalytics } from '../../hooks/useDrills';
import { CATEGORY_LABEL } from './drillUtils';
import type { DrillCategory } from '../../types';

const CAT_COLOR = '#6366f1';

function DarkTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 shadow-2xl">
      {label && <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>}
      {payload.map((p, i) => <p key={i} className="text-sm text-white">{p.name}: <span className="font-semibold">{p.value}</span></p>)}
    </div>
  );
}

export function DrillUsageSection() {
  const { data, isLoading } = useDrillAnalytics();

  if (isLoading) return <div className="h-64 skeleton rounded-2xl" />;
  if (!data || data.drillBasedTasks === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
        <Dumbbell size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No drill-based tasks yet. Assign drills from the library to see usage analytics.</p>
      </div>
    );
  }

  const mostUsed = data.mostAssigned.map(d => ({ name: d.name, Assigned: d.assigned, Completed: d.completed }));
  const byCategory = data.byCategory.map(c => ({ name: CATEGORY_LABEL[c.category as DrillCategory], rate: c.completionRate, total: c.total }));
  const split = [
    { name: 'Drill-based', value: data.drillBasedTasks },
    { name: 'Manual', value: data.manualTasks },
  ];
  const splitColors = ['#6366f1', '#94a3b8'];

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Drill-based tasks', value: data.drillBasedTasks },
          { label: 'Distinct drills used', value: data.totalDrillsAssigned },
          { label: 'Completion rate', value: `${data.overallCompletionRate}%` },
          { label: 'Manual tasks', value: data.manualTasks },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Most used drills */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Most used drills</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, mostUsed.length * 48)}>
            <BarChart data={mostUsed} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="text-gray-500" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} className="text-gray-500" />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="Assigned" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Completed" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Drill-based vs manual */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Drill-based vs manual tasks</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={split} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {split.map((_, i) => <Cell key={i} fill={splitColors[i]} />)}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {split.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm" style={{ background: splitColors[i] }} />
                  <span className="text-gray-600 dark:text-gray-300">{s.name}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Completion by category */}
      {byCategory.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Completion rate by drill category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-gray-500" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-gray-500" unit="%" />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="rate" name="Completion %" fill={CAT_COLOR} radius={[4, 4, 0, 0]}>
                {byCategory.map((_, i) => <Cell key={i} fill={CAT_COLOR} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
