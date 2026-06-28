import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Trophy, Zap } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { BarChartWrapper } from '../../components/charts/BarChartWrapper';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { useTeamReport } from '../../hooks/useReports';

const SEVERITY_COLORS: Record<string, string> = {
  Minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Severe: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function TeamReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const teamId = id ? parseInt(id) : undefined;
  const { data: report, isLoading, isError } = useTeamReport(teamId);

  if (isLoading) return <PageSpinner />;
  if (isError || !report) return (
    <PageWrapper>
      <EmptyState
        title="Report not found"
        description="Could not load team report"
        action={{ label: 'Back', onClick: () => navigate('/reports') }}
      />
    </PageWrapper>
  );

  const { team, playerCount, averageScoreByCategory, playerAverageScores, activeInjuryCount, activeInjuries, players } = report;

  const barData = playerAverageScores.map(p => ({
    name: p.playerName.split(' ')[0], // first name only for chart
    score: parseFloat(p.averageScore.toFixed(1)),
  }));

  const radarData = Object.entries(averageScoreByCategory).map(([subject, value]) => ({
    subject,
    value: parseFloat(value.toFixed(1)),
  }));

  const top3 = playerAverageScores.slice(0, 3);
  const needsAttention = playerAverageScores.filter(p => p.averageScore === 0 || p.averageScore < 5);
  const assessed = playerAverageScores.filter(p => p.averageScore > 0).length;

  // Look up player name from players list for injury display
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.fullName]));

  return (
    <PageWrapper
      title={team.name}
      actions={
        <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Players', value: playerCount },
          { label: 'Sport', value: team.sportName },
          { label: 'Assessed', value: `${assessed}/${playerCount}` },
          { label: 'Active Injuries', value: activeInjuryCount, danger: activeInjuryCount > 0 },
        ].map(stat => (
          <Card key={stat.label}>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.danger ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Active injury warning */}
      {activeInjuryCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="text-sm font-medium">
            {activeInjuryCount} active {activeInjuryCount === 1 ? 'injury' : 'injuries'} across the team
          </span>
        </div>
      )}

      {/* Team performance bar chart */}
      <Card header="Player Performance Comparison">
        {barData.length === 0 || barData.every(d => d.score === 0) ? (
          <EmptyState title="No assessment data" description="Players have not been assessed yet" />
        ) : (
          <BarChartWrapper
            data={barData}
            series={[{ key: 'score', name: 'Avg Score', color: '#6366f1' }]}
            height={260}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team radar */}
        <Card header="Team Strengths & Weaknesses">
          {radarData.length === 0 ? (
            <EmptyState title="No data" description="No assessment data for this team" />
          ) : (
            <RadarChartWrapper data={radarData} height={280} />
          )}
        </Card>

        {/* Top performers */}
        <Card header="Top Performers">
          {top3.length === 0 ? (
            <EmptyState title="No data" description="No player assessments yet" />
          ) : (
            <div className="space-y-3">
              {top3.map((p, i) => (
                <div key={p.playerId} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-amber-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => navigate(`/reports/player/${p.playerId}`)}
                      className="font-medium text-gray-800 dark:text-gray-200 text-sm hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {p.playerName}
                    </button>
                  </div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                    {p.averageScore.toFixed(1)}/10
                  </span>
                  {i === 0 && <Trophy size={16} className="text-yellow-400" />}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Players needing attention */}
      {needsAttention.length > 0 && (
        <Card header="Players Needing Attention">
          <div className="space-y-2">
            {needsAttention.map(p => (
              <div key={p.playerId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <button
                  onClick={() => navigate(`/reports/player/${p.playerId}`)}
                  className="font-medium text-gray-800 dark:text-gray-200 text-sm hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {p.playerName}
                </button>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.averageScore === 0
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {p.averageScore === 0 ? 'Not assessed' : `${p.averageScore.toFixed(1)}/10`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assessment coverage */}
      <Card header="Assessment Coverage">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: playerCount > 0 ? `${(assessed / playerCount) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {assessed} of {playerCount} players assessed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-indigo-500" />
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {playerCount > 0 ? Math.round((assessed / playerCount) * 100) : 0}%
            </span>
          </div>
        </div>
        {playerAverageScores.filter(p => p.averageScore === 0).length > 0 && (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Not yet assessed:{' '}
            {playerAverageScores.filter(p => p.averageScore === 0).map(p => p.playerName).join(', ')}
          </div>
        )}
      </Card>

      {/* Active injuries */}
      {activeInjuries.length > 0 && (
        <Card header="Active Injuries">
          <div className="space-y-3">
            {activeInjuries.map(inj => (
              <div key={inj.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{inj.injuryType}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {playerMap[inj.playerId] ?? `Player #${inj.playerId}`} · {new Date(inj.injuryDate).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inj.severity] ?? ''}`}>
                  {inj.severity}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageWrapper>
  );
}
