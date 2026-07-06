import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompare, X, Search, Trophy, Plus } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { BarChartWrapper } from '../../components/charts/BarChartWrapper';
import { usePlayers } from '../../hooks/usePlayers';
import { reportsApi } from '../../api/reportsApi';
import type { PlayerReport } from '../../types';

const MAX_PLAYERS = 4;
// One distinct color per compared player — reused across radar, bars, chips and table.
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

function overallAvg(report?: PlayerReport): number {
  const vals = Object.values(report?.averageScoreByCategory ?? {}).filter(v => v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function RadarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl min-w-[150px]">
      <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}</span>
          </span>
          <span className="font-bold text-white">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function ComparePlayersPage() {
  const { data: players, isLoading } = usePlayers();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  // Selected player ids are kept in the URL (?players=1,2,3) so the view is shareable and
  // so a "Compare" link from a player page can pre-select that player.
  const selectedIds = useMemo(() => {
    return (searchParams.get('players') ?? '')
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n))
      .slice(0, MAX_PLAYERS);
  }, [searchParams]);

  function setSelectedIds(ids: number[]) {
    const next = new URLSearchParams(searchParams);
    if (ids.length) next.set('players', ids.join(','));
    else next.delete('players');
    setSearchParams(next, { replace: true });
  }

  const reports = useQueries({
    queries: selectedIds.map(pid => ({
      queryKey: ['report-player', pid],
      queryFn: () => reportsApi.getPlayerReport(pid),
      enabled: !!pid,
    })),
  });

  if (isLoading) return <PageSpinner />;

  const loadingReports = reports.some(r => r.isLoading);
  const loadedReports = reports.map(r => r.data).filter((r): r is PlayerReport => !!r);

  const colorFor = (pid: number) => COLORS[selectedIds.indexOf(pid) % COLORS.length];
  const nameFor = (pid: number) => {
    const base = loadedReports.find(r => r.player.id === pid)?.player.fullName
      ?? players?.find(p => p.id === pid)?.fullName
      ?? `Player ${pid}`;
    const jersey = players?.find(p => p.id === pid)?.jerseyNumber;
    return jersey != null ? `#${jersey} ${base}` : base;
  };

  const allCategories = [
    ...new Set(loadedReports.flatMap(r => Object.keys(r.averageScoreByCategory))),
  ].sort();

  const radarData = allCategories.map(cat => {
    const row: Record<string, string | number> = { subject: cat };
    selectedIds.forEach(pid => {
      const rep = loadedReports.find(r => r.player.id === pid);
      row[`p${pid}`] = parseFloat((rep?.averageScoreByCategory[cat] ?? 0).toFixed(1));
    });
    return row;
  });

  const barSeries = selectedIds.map(pid => ({ key: `p${pid}`, name: nameFor(pid), color: colorFor(pid) }));
  const barData = allCategories.map(cat => {
    const row: { name: string; [key: string]: string | number } = { name: cat };
    selectedIds.forEach(pid => {
      const rep = loadedReports.find(r => r.player.id === pid);
      row[`p${pid}`] = parseFloat((rep?.averageScoreByCategory[cat] ?? 0).toFixed(1));
    });
    return row;
  });

  // "Best at" — for each category, the selected player with the highest score.
  const bestByCategory = allCategories.map(cat => {
    let bestPid = -1;
    let bestScore = 0;
    selectedIds.forEach(pid => {
      const rep = loadedReports.find(r => r.player.id === pid);
      const s = rep?.averageScoreByCategory[cat] ?? 0;
      if (s > bestScore) { bestScore = s; bestPid = pid; }
    });
    return { cat, bestPid, bestScore };
  }).filter(b => b.bestPid !== -1);

  const toggle = (pid: number) => {
    if (selectedIds.includes(pid)) setSelectedIds(selectedIds.filter(id => id !== pid));
    else if (selectedIds.length < MAX_PLAYERS) setSelectedIds([...selectedIds, pid]);
  };

  const availablePlayers = (players ?? []).filter(p => {
    if (selectedIds.includes(p.id)) return false;
    if (!query.trim()) return true;
    return p.fullName.toLowerCase().includes(query.toLowerCase());
  });

  const canPickMore = selectedIds.length < MAX_PLAYERS;

  return (
    <PageWrapper title="Compare Players">
      {/* Player picker */}
      <Card header={`Select Players (${selectedIds.length}/${MAX_PLAYERS})`}>
        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedIds.map(pid => (
              <span
                key={pid}
                className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full text-sm font-semibold text-white"
                style={{ background: colorFor(pid) }}
              >
                {nameFor(pid)}
                <button
                  onClick={() => toggle(pid)}
                  className="p-0.5 rounded-full hover:bg-black/20 transition-colors cursor-pointer"
                  aria-label={`Remove ${nameFor(pid)}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search + add list */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={canPickMore ? 'Search players to add…' : 'Maximum of 4 players selected'}
            disabled={!canPickMore}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-50"
          />
        </div>
        {canPickMore && (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No players found</p>
            ) : (
              availablePlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  {p.jerseyNumber != null && <span className="font-black text-indigo-500">#{p.jerseyNumber}</span>}
                  {p.fullName}
                  {p.teamName && <span className="text-xs text-gray-400">· {p.teamName}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </Card>

      {selectedIds.length < 2 ? (
        <EmptyState
          icon={<GitCompare size={40} />}
          title="Select at least two players"
          description="Pick 2 to 4 players above to overlay their skill profiles and see who's best at what."
        />
      ) : loadingReports ? (
        <PageSpinner />
      ) : allCategories.length === 0 ? (
        <EmptyState title="No assessment data" description="None of the selected players have been assessed yet." />
      ) : (
        <>
          {/* Overall average summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedIds.map(pid => (
              <div
                key={pid}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
                style={{ borderTopColor: colorFor(pid), borderTopWidth: 3 }}
              >
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{nameFor(pid)}</p>
                <p className="text-2xl font-black mt-1" style={{ color: colorFor(pid) }}>
                  {overallAvg(loadedReports.find(r => r.player.id === pid)).toFixed(1)}
                </p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Overall Avg</p>
              </div>
            ))}
          </div>

          {/* Radar overlay */}
          <Card header="Skill Radar Overlay">
            <ResponsiveContainer width="100%" height={420}>
              <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid stroke="#1f2937" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9, fill: '#6b7280' }} tickCount={6} />
                <Tooltip content={<RadarTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }} />
                {selectedIds.map(pid => (
                  <Radar
                    key={pid}
                    name={nameFor(pid)}
                    dataKey={`p${pid}`}
                    stroke={colorFor(pid)}
                    fill={colorFor(pid)}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: colorFor(pid), strokeWidth: 0 }}
                    isAnimationActive
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {/* Grouped bar chart */}
          <Card header="Category Breakdown">
            <BarChartWrapper data={barData} series={barSeries} height={340} />
          </Card>

          {/* Best At badges */}
          <Card header="Best At">
            <div className="flex flex-wrap gap-2">
              {bestByCategory.map(({ cat, bestPid, bestScore }) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border"
                  style={{ borderColor: colorFor(bestPid), background: `${colorFor(bestPid)}14` }}
                >
                  <Trophy size={14} style={{ color: colorFor(bestPid) }} />
                  <span className="text-gray-500 dark:text-gray-400">{cat}:</span>
                  <span className="font-bold" style={{ color: colorFor(bestPid) }}>{nameFor(bestPid)}</span>
                  <span className="text-xs text-gray-400">{bestScore.toFixed(1)}</span>
                </span>
              ))}
            </div>
          </Card>

          {/* Comparison table */}
          <Card header="Score Comparison">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                    <th className="pb-2 pr-4 text-left font-medium">Category</th>
                    {selectedIds.map(pid => (
                      <th key={pid} className="pb-2 px-3 text-center font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: colorFor(pid) }} />
                          {nameFor(pid)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allCategories.map(cat => {
                    const scores = selectedIds.map(pid => ({
                      pid,
                      score: loadedReports.find(r => r.player.id === pid)?.averageScoreByCategory[cat] ?? 0,
                    }));
                    const max = Math.max(...scores.map(s => s.score));
                    return (
                      <tr key={cat} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{cat}</td>
                        {scores.map(({ pid, score }) => {
                          const isBest = score > 0 && score === max;
                          return (
                            <td
                              key={pid}
                              className="py-2.5 px-3 text-center font-semibold"
                              style={isBest ? { color: colorFor(pid) } : undefined}
                            >
                              {score > 0 ? score.toFixed(1) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Overall average row */}
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-bold">
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-white">Overall Avg</td>
                    {selectedIds.map(pid => (
                      <td key={pid} className="py-2.5 px-3 text-center" style={{ color: colorFor(pid) }}>
                        {overallAvg(loadedReports.find(r => r.player.id === pid)).toFixed(1)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </PageWrapper>
  );
}
