import { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { usePlayers } from '../../hooks/usePlayers';
import { reportsApi } from '../../api/reportsApi';
import type { PlayerReport } from '../../types';

export function ComparePlayersPage() {
  const { data: players, isLoading } = usePlayers();
  const [idA, setIdA] = useState<number | ''>('');
  const [idB, setIdB] = useState<number | ''>('');

  const { data: reportA, isLoading: loadingA } = useQuery<PlayerReport>({
    queryKey: ['report-player', idA],
    queryFn: () => reportsApi.getPlayerReport(idA as number),
    enabled: !!idA,
  });

  const { data: reportB, isLoading: loadingB } = useQuery<PlayerReport>({
    queryKey: ['report-player', idB],
    queryFn: () => reportsApi.getPlayerReport(idB as number),
    enabled: !!idB,
  });

  if (isLoading) return <PageSpinner />;

  const allCategories = [
    ...new Set([
      ...Object.keys(reportA?.averageScoreByCategory ?? {}),
      ...Object.keys(reportB?.averageScoreByCategory ?? {}),
    ]),
  ].sort();

  const selectClass =
    'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <PageWrapper title="Compare Players">
      <Card header="Select Players">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Player A
            </label>
            <select
              className={selectClass}
              value={idA}
              onChange={e => setIdA(e.target.value ? parseInt(e.target.value) : '')}
            >
              <option value="">Select player…</option>
              {players?.map(p => (
                <option key={p.id} value={p.id} disabled={p.id === idB}>
                  {p.fullName} {p.teamName ? `(${p.teamName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Player B
            </label>
            <select
              className={selectClass}
              value={idB}
              onChange={e => setIdB(e.target.value ? parseInt(e.target.value) : '')}
            >
              <option value="">Select player…</option>
              {players?.map(p => (
                <option key={p.id} value={p.id} disabled={p.id === idA}>
                  {p.fullName} {p.teamName ? `(${p.teamName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {!idA || !idB ? (
        <EmptyState
          icon={<GitCompare size={40} />}
          title="Select two players to compare"
          description="Choose a Player A and Player B from the dropdowns above"
        />
      ) : loadingA || loadingB ? (
        <PageSpinner />
      ) : !reportA || !reportB ? (
        <EmptyState title="Could not load reports" description="One or both player reports failed to load" />
      ) : (
        <>
          {/* Side-by-side radar charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card header={`${reportA.player.fullName} — Skill Radar`}>
              <RadarChartWrapper
                data={allCategories.map(cat => ({
                  subject: cat,
                  value: parseFloat((reportA.averageScoreByCategory[cat] ?? 0).toFixed(1)),
                }))}
                height={280}
              />
            </Card>
            <Card header={`${reportB.player.fullName} — Skill Radar`}>
              <RadarChartWrapper
                data={allCategories.map(cat => ({
                  subject: cat,
                  value: parseFloat((reportB.averageScoreByCategory[cat] ?? 0).toFixed(1)),
                }))}
                height={280}
              />
            </Card>
          </div>

          {/* Comparison table */}
          <Card header="Score Comparison">
            {allCategories.length === 0 ? (
              <EmptyState title="No assessment data" description="Neither player has been assessed" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                      <th className="pb-2 text-left font-medium">Category</th>
                      <th className="pb-2 text-center font-medium">{reportA.player.fullName}</th>
                      <th className="pb-2 text-center font-medium">{reportB.player.fullName}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCategories.map(cat => {
                      const aScore = reportA.averageScoreByCategory[cat] ?? 0;
                      const bScore = reportB.averageScoreByCategory[cat] ?? 0;
                      const aWins = aScore > bScore;
                      const bWins = bScore > aScore;
                      return (
                        <tr
                          key={cat}
                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <td className="py-2.5 text-gray-700 dark:text-gray-300">{cat}</td>
                          <td className={`py-2.5 text-center font-semibold ${aWins ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {aScore > 0 ? aScore.toFixed(1) : '—'}
                          </td>
                          <td className={`py-2.5 text-center font-semibold ${bWins ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {bScore > 0 ? bScore.toFixed(1) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </PageWrapper>
  );
}
