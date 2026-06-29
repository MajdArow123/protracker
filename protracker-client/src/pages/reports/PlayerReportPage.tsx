import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Printer, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Activity, ChevronDown, ChevronRight, Sparkles, Lightbulb,
} from 'lucide-react';
import { useGeneratePerformanceInsights } from '../../hooks/useAI';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { BarChartWrapper } from '../../components/charts/BarChartWrapper';
import { usePlayerReport } from '../../hooks/useReports';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];

const SEVERITY_COLORS: Record<string, string> = {
  Minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Severe: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const RECOVERY_COLORS: Record<string, string> = {
  Active: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Recovering: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  FullyRecovered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function pct(from: number, to: number) {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

export function PlayerReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerId = id ? parseInt(id) : undefined;
  const { data: report, isLoading, isError } = usePlayerReport(playerId);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const generateInsights = useGeneratePerformanceInsights();

  if (isLoading) return <PageSpinner />;
  if (isError || !report) return (
    <PageWrapper>
      <EmptyState title="Report not found" description="Could not load player report" action={{ label: 'Back', onClick: () => navigate('/reports') }} />
    </PageWrapper>
  );

  const { player, assessments, averageScoreByCategory, injuries, recentMatches } = report;

  // Sort oldest→newest for charts
  const sorted = [...assessments].sort(
    (a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime()
  );

  const allCategories = [...new Set(sorted.flatMap(a => a.statScores?.map(s => s.statCategoryName) ?? []))];
  const visibleCategories = allCategories.filter(c => !hiddenCategories.has(c));

  const lineData: Array<{ name: string; [key: string]: string | number }> = sorted.map(a => {
    const point: { name: string; [key: string]: string | number } = {
      name: new Date(a.dateRecorded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
    a.statScores?.forEach(s => { point[s.statCategoryName] = s.score; });
    return point;
  });

  const latest = assessments[0];
  const previous = assessments[1];
  const radarData = allCategories.map(cat => ({
    subject: cat,
    value: latest?.statScores?.find(s => s.statCategoryName === cat)?.score ?? 0,
    previousValue: previous?.statScores?.find(s => s.statCategoryName === cat)?.score,
  }));

  const matchBarData = recentMatches.map(m => ({
    name: `${m.opponent} (${new Date(m.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
    rating: m.performanceRating,
  }));

  const activeInjuries = injuries.filter(i => i.recoveryStatus !== 'FullyRecovered');

  // Insights
  const insights: { text: string; type: 'good' | 'bad' | 'neutral' }[] = [];
  const entries = Object.entries(averageScoreByCategory);
  if (entries.length) {
    const sorted2 = [...entries].sort((a, b) => a[1] - b[1]);
    const weakest = sorted2[0];
    const strongest = sorted2[sorted2.length - 1];
    insights.push({ text: `${weakest[0]} is the weakest area at ${weakest[1].toFixed(1)}/10`, type: 'bad' });
    insights.push({ text: `${strongest[0]} is the strongest area at ${strongest[1].toFixed(1)}/10`, type: 'good' });
  }
  if (latest) {
    const daysSince = (Date.now() - new Date(latest.dateRecorded).getTime()) / 86400000;
    if (daysSince > 30) insights.push({ text: `No assessments in the last 30 days`, type: 'neutral' });
  } else {
    insights.push({ text: 'No assessments recorded yet', type: 'neutral' });
  }
  if (activeInjuries.length) {
    insights.push({ text: 'Active injury may be affecting performance', type: 'bad' });
  }
  if (sorted.length >= 2) {
    const firstAvg = sorted[0].statScores?.reduce((s, x) => s + x.score, 0) / (sorted[0].statScores?.length || 1);
    const lastAvg = sorted[sorted.length - 1].statScores?.reduce((s, x) => s + x.score, 0) / (sorted[sorted.length - 1].statScores?.length || 1);
    const change = pct(firstAvg, lastAvg);
    if (change !== null) {
      insights.push(
        change > 0
          ? { text: `Overall score improved ${change.toFixed(0)}% from first to latest assessment`, type: 'good' }
          : { text: `Overall score declined ${Math.abs(change).toFixed(0)}% from first to latest assessment`, type: 'bad' }
      );
    }
  }

  // Improvement trends per category (first vs latest with that category)
  const trends = allCategories.map(cat => {
    const byAge = [...assessments]
      .sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime())
      .map(a => a.statScores?.find(s => s.statCategoryName === cat)?.score)
      .filter(s => s !== undefined) as number[];
    if (byAge.length < 2) return { cat, change: null, first: byAge[0] ?? 0, last: byAge[0] ?? 0 };
    const first = byAge[0];
    const last = byAge[byAge.length - 1];
    return { cat, change: pct(first, last), first, last };
  });

  async function handleGenerateInsights() {
    if (!playerId) return;
    setAiError(null);
    try {
      const result = await generateInsights.mutateAsync(playerId);
      setAiInsights(result.insights);
    } catch {
      setAiError('AI analysis failed. Please try again.');
    }
  }

  const isGenerating = generateInsights.isPending;

  return (
    <PageWrapper
      title={player.fullName}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
        </div>
      }
    >
      {/* Header */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xl">
            {player.fullName.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{player.fullName}</h2>
            <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {player.positionName && <span>{player.positionName}</span>}
              {player.teamName && <span>· {player.teamName}</span>}
              {player.sportName && <span>· {player.sportName}</span>}
            </div>
          </div>
          {player.fitnessLevel != null && (
            <span className="px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
              Fitness {player.fitnessLevel}/10
            </span>
          )}
          <Link
            to={`/players/${player.id}/nutrition`}
            className="text-sm text-indigo-500 hover:underline"
          >
            View Nutrition →
          </Link>
        </div>
      </Card>

      {/* Active injury warning */}
      {activeInjuries.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="text-sm font-medium">
            {activeInjuries.length === 1
              ? `Active injury: ${activeInjuries[0].injuryType}`
              : `${activeInjuries.length} active injuries may be affecting performance`}
          </span>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card header="Auto-generated Insights">
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {ins.type === 'good' && <TrendingUp size={16} className="text-green-500 mt-0.5 shrink-0" />}
                {ins.type === 'bad' && <TrendingDown size={16} className="text-red-500 mt-0.5 shrink-0" />}
                {ins.type === 'neutral' && <Activity size={16} className="text-gray-400 mt-0.5 shrink-0" />}
                <span className="text-gray-700 dark:text-gray-300">{ins.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* AI Performance Analysis */}
      <Card header={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-violet-500" />
            AI Performance Analysis
          </span>
          <button
            onClick={handleGenerateInsights}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles size={12} />
            {aiInsights ? 'Regenerate' : 'Generate AI Insights'}
          </button>
        </div>
      }>
        {isGenerating && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm">
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse flex-shrink-0" />
            <span>Analyzing performance data…</span>
            <span className="text-xs text-violet-500 ml-auto whitespace-nowrap">~5–10 sec</span>
          </div>
        )}
        {aiError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {aiError}
            <button onClick={handleGenerateInsights} className="ml-auto text-xs font-semibold underline cursor-pointer">Retry</button>
          </div>
        )}
        {!aiInsights && !isGenerating && !aiError && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            Click "Generate AI Insights" to get data-driven analysis from Claude.
          </p>
        )}
        {aiInsights && !isGenerating && (
          <ul className="space-y-3">
            {aiInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30">
                <Lightbulb size={15} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-800 dark:text-gray-200">{insight}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Performance over time */}
      <Card header="Performance Over Time">
        {sorted.length < 2 ? (
          <EmptyState
            title="Not enough data"
            description="Needs at least 2 assessments to show trends"
            action={{ label: 'Add Assessment', onClick: () => navigate(`/players/${player.id}/assessment`) }}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setHiddenCategories(prev => {
                    const next = new Set(prev);
                    next.has(cat) ? next.delete(cat) : next.add(cat);
                    return next;
                  })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    hiddenCategories.has(cat)
                      ? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-transparent'
                      : 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <LineChartWrapper
              data={lineData}
              series={visibleCategories.map((cat, i) => ({
                key: cat,
                name: cat,
                color: COLORS[i % COLORS.length],
              }))}
              height={280}
            />
          </>
        )}
      </Card>

      {/* Radar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card header={previous ? 'Skill Radar — Current vs Previous' : 'Skill Radar — Latest'}>
          {!latest ? (
            <EmptyState title="No assessments" description="No data to display" />
          ) : (
            <RadarChartWrapper data={radarData} showPrevious={!!previous} height={280} />
          )}
        </Card>

        {/* Improvement trends */}
        <Card header="Improvement Trends">
          {trends.length === 0 ? (
            <EmptyState title="No data" description="No assessment data available" />
          ) : (
            <div className="space-y-3">
              {trends.map(t => (
                <div key={t.cat} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{t.cat}</span>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {t.first.toFixed(1)} → {t.last.toFixed(1)}
                    </span>
                    {t.change === null ? (
                      <Minus size={14} className="text-gray-400" />
                    ) : t.change > 0 ? (
                      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
                        <TrendingUp size={14} /> +{t.change.toFixed(0)}%
                      </span>
                    ) : t.change < 0 ? (
                      <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 font-medium">
                        <TrendingDown size={14} /> {t.change.toFixed(0)}%
                      </span>
                    ) : (
                      <Minus size={14} className="text-gray-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Assessment history table */}
      <Card header="Assessment History">
        {!assessments.length ? (
          <EmptyState
            title="No assessments"
            description="No assessments recorded yet"
            action={{ label: 'Add Assessment', onClick: () => navigate(`/players/${player.id}/assessment`) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 pr-4 font-medium">Avg Score</th>
                  <th className="pb-2 font-medium"># Stats</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {assessments.map(a => {
                  const avg = a.statScores?.length
                    ? (a.statScores.reduce((s, x) => s + x.score, 0) / a.statScores.length).toFixed(1)
                    : '—';
                  const isExpanded = expandedRow === a.id;
                  return (
                    <>
                      <tr
                        key={a.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : a.id)}
                      >
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                          {new Date(a.dateRecorded).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{a.assessmentPeriodName}</td>
                        <td className="py-2.5 pr-4">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{avg}</span>
                        </td>
                        <td className="py-2.5 text-gray-500 dark:text-gray-400">{a.statScores?.length ?? 0}</td>
                        <td className="py-2.5 text-gray-400">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                      </tr>
                      {isExpanded && a.statScores?.length > 0 && (
                        <tr key={`${a.id}-exp`} className="bg-gray-50 dark:bg-gray-800/60">
                          <td colSpan={5} className="px-2 py-3">
                            <div className="flex flex-wrap gap-2">
                              {a.statScores.map(s => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                                >
                                  {s.statCategoryName}:
                                  <strong className="text-indigo-600 dark:text-indigo-400">{s.score}</strong>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Match performance */}
      <Card header="Match Performance">
        {!recentMatches.length ? (
          <EmptyState title="No match data" description="No match performances recorded" />
        ) : (
          <BarChartWrapper
            data={matchBarData}
            series={[{ key: 'rating', name: 'Performance Rating', color: '#6366f1' }]}
            height={240}
          />
        )}
      </Card>

      {/* Injury history */}
      <Card header="Injury History">
        {!injuries.length ? (
          <EmptyState title="No injuries recorded" description="No injury history" />
        ) : (
          <div className="space-y-3">
            {injuries.map(inj => (
              <div key={inj.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{inj.injuryType}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(inj.injuryDate).toLocaleDateString()}
                    {inj.expectedReturnDate && ` · Expected return: ${new Date(inj.expectedReturnDate).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inj.severity] ?? ''}`}>
                    {inj.severity}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECOVERY_COLORS[inj.recoveryStatus] ?? ''}`}>
                    {inj.recoveryStatus === 'FullyRecovered' ? 'Recovered' : inj.recoveryStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}
