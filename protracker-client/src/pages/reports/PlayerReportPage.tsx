import { useState, Fragment } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import {
  ArrowLeft, Printer, Download, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Activity, ChevronDown, ChevronRight, Sparkles, Lightbulb, Trophy,
} from 'lucide-react';
import { useGeneratePerformanceInsights } from '../../hooks/useAI';
import { useBilling } from '../../hooks/useBilling';
import { useToast } from '../../context/ToastContext';
import { AILoadingPanel } from '../../components/ui/AILoadingPanel';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ReportSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { BarChartWrapper } from '../../components/charts/BarChartWrapper';
import { usePlayerReport } from '../../hooks/useReports';
import { useSportMetrics, usePlayerEvidenceScores } from '../../hooks/useEvidence';
import { EvidenceBreakdownModal } from '../../components/evidence/EvidenceBreakdownModal';
import { AIDataSourcesNote } from '../../components/evidence/AIDataSourcesNote';
import { confidenceBadgeClass, confidenceLabel, isVerified } from '../../components/evidence/evidenceUtils';
import type { SportMetricDefinition } from '../../types';

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
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const labels = useDynamicLabels();
  const { data: billing } = useBilling();
  const { addToast } = useToast();
  const playerId = id ? parseInt(id) : undefined;
  const { data: report, isLoading, isError, refetch } = usePlayerReport(playerId);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const generateInsights = useGeneratePerformanceInsights();

  // Evidence layer: confidence per metric for the radar + the Evidence Quality section.
  const { data: evidenceScores = [] } = usePlayerEvidenceScores(playerId);
  const { data: sportMetrics = [] } = useSportMetrics(report?.player?.sportId);
  const [breakdownMetric, setBreakdownMetric] = useState<SportMetricDefinition | null>(null);

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <PageWrapper><ErrorState thing={tr('reports.theReport', 'the report')} onRetry={() => refetch()} /></PageWrapper>;
  if (!report) return (
    <PageWrapper>
      <EmptyState title={tr('reports.reportNotFound', 'Report not found')} description={tr('reports.couldNotLoadPlayer', 'Could not load player report')} action={{ label: tr('common.back', 'Back'), onClick: () => navigate('/reports') }} />
    </PageWrapper>
  );

  const { player, assessments, averageScoreByCategory, injuries, recentMatches } = report;

  // Sort oldest→newest for charts
  const sorted = [...assessments].sort(
    (a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime()
  );

  const allCategories = [...new Set(sorted.flatMap(a => a.statScores?.map(s => s.statCategoryName) ?? []))];
  const visibleCategories = allCategories;

  const lineData: Array<{ name: string; [key: string]: string | number }> = sorted.map(a => {
    const point: { name: string; [key: string]: string | number } = {
      name: formatDate(a.dateRecorded, { month: 'short', day: 'numeric' }),
    };
    a.statScores?.forEach(s => { point[s.statCategoryName] = s.score; });
    return point;
  });

  const latest = assessments[0];
  const previous = assessments[1];

  // Evidence lookups: stat category name → metric definition / evidence confidence.
  const metricByCategoryId = new Map(sportMetrics.filter(m => m.sportStatCategoryId != null).map(m => [m.sportStatCategoryId!, m]));
  const evidenceByMetricId = new Map(evidenceScores.map(s => [s.metricDefinitionId, s]));
  const metricByName = new Map(sportMetrics.map(m => [m.name, m]));
  function confidenceForCategory(cat: string) {
    const catId = latest?.statScores?.find(s => s.statCategoryName === cat)?.sportStatCategoryId;
    const metric = catId != null ? metricByCategoryId.get(catId) : undefined;
    return metric ? evidenceByMetricId.get(metric.id)?.confidence : undefined;
  }

  const radarData = allCategories.map(cat => ({
    subject: cat,
    value: latest?.statScores?.find(s => s.statCategoryName === cat)?.score ?? 0,
    previousValue: previous?.statScores?.find(s => s.statCategoryName === cat)?.score,
    confidence: confidenceForCategory(cat),
  }));

  function openBreakdownForCategory(cat: string) {
    const catId = latest?.statScores?.find(s => s.statCategoryName === cat)?.sportStatCategoryId;
    const metric = catId != null ? metricByCategoryId.get(catId) : undefined;
    if (metric) setBreakdownMetric(metric);
  }

  const verifiedCount = evidenceScores.filter(s => isVerified(s.confidence)).length;
  const reliable = [...evidenceScores].filter(s => isVerified(s.confidence)).sort((a, b) => b.finalScore - a.finalScore).slice(0, 3);
  const needsData = [...evidenceScores].filter(s => !isVerified(s.confidence)).slice(0, 3);

  const matchBarData = recentMatches.map(m => ({
    name: `${m.opponent} (${formatDate(m.matchDate, { month: 'short', day: 'numeric' })})`,
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
    insights.push({ text: tr('reports.insightWeakest', '{{name}} is the weakest area at {{score}}/10', { name: weakest[0], score: weakest[1].toFixed(1) }), type: 'bad' });
    insights.push({ text: tr('reports.insightStrongest', '{{name}} is the strongest area at {{score}}/10', { name: strongest[0], score: strongest[1].toFixed(1) }), type: 'good' });
  }
  if (latest) {
    const daysSince = (Date.now() - new Date(latest.dateRecorded).getTime()) / 86400000;
    if (daysSince > 30) insights.push({ text: tr('reports.insightNoRecent', 'No assessments in the last 30 days'), type: 'neutral' });
  } else {
    insights.push({ text: tr('reports.insightNoneYet', 'No assessments recorded yet'), type: 'neutral' });
  }
  if (activeInjuries.length) {
    insights.push({ text: tr('reports.insightActiveInjury', 'Active injury may be affecting performance'), type: 'bad' });
  }
  if (sorted.length >= 2) {
    const firstAvg = sorted[0].statScores?.reduce((s, x) => s + x.score, 0) / (sorted[0].statScores?.length || 1);
    const lastAvg = sorted[sorted.length - 1].statScores?.reduce((s, x) => s + x.score, 0) / (sorted[sorted.length - 1].statScores?.length || 1);
    const change = pct(firstAvg, lastAvg);
    if (change !== null) {
      insights.push(
        change > 0
          ? { text: tr('reports.insightImproved', 'Overall score improved {{pct}}% from first to latest assessment', { pct: change.toFixed(0) }), type: 'good' }
          : { text: tr('reports.insightDeclined', 'Overall score declined {{pct}}% from first to latest assessment', { pct: Math.abs(change).toFixed(0) }), type: 'bad' }
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
      setAiError(tr('reports.aiFailed', 'AI analysis failed. Please try again.'));
    }
  }

  const isGenerating = generateInsights.isPending;

  // Metric cards data
  const bestCategory = latest?.statScores?.length
    ? latest.statScores.reduce((a, b) => b.score > a.score ? b : a)
    : null;
  const latestAvg = latest?.statScores?.length
    ? latest.statScores.reduce((s, x) => s + x.score, 0) / latest.statScores.length
    : null;
  let overallTrend: number | null = null;
  if (sorted.length >= 2) {
    const firstAvg = sorted[0].statScores.reduce((s, x) => s + x.score, 0) / (sorted[0].statScores.length || 1);
    const lastAvg = sorted[sorted.length - 1].statScores.reduce((s, x) => s + x.score, 0) / (sorted[sorted.length - 1].statScores.length || 1);
    overallTrend = pct(firstAvg, lastAvg);
  }

  async function handleExportPdf() {
    // PDF export is a Pro feature (generated client-side, so it must be gated here).
    if (billing && !billing.limits.pdf) {
      addToast(tr('reports.pdfProOnly', 'PDF export is available on the Pro plan.'), 'info');
      navigate('/settings/billing');
      return;
    }
    setExporting(true);
    try {
      const [{ downloadPdf, reportFilename }, { PlayerReportPDF }] = await Promise.all([
        import('../../utils/exportPdf'),
        import('../../components/pdf/PlayerReportPDF'),
      ]);
      await downloadPdf(<PlayerReportPDF report={report!} insights={aiInsights ?? undefined} />, reportFilename(player.fullName));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageWrapper
      title={player.fullName}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>
            <ArrowLeft size={16} /> {tr('common.back', 'Back')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={16} /> {tr('reports.print', 'Print')}
          </Button>
          <Button size="sm" onClick={handleExportPdf} isLoading={exporting}>
            <Download size={16} /> {exporting ? tr('reports.generatingPdf', 'Generating PDF…') : tr('reports.exportPdf', 'Export PDF')}
          </Button>
        </div>
      }
    >
      {/* Player hero header */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex items-center gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xl flex-shrink-0">
          {player.fullName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">{player.fullName}</h2>
          <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {player.positionName && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">{player.positionName}</span>}
            {player.teamName && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">{player.teamName}</span>}
            {player.sportName && <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-xs font-medium text-indigo-700 dark:text-indigo-300">{labels.sport(player.sportName)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {player.fitnessLevel != null && (
            <span className="px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold">
              {tr('reports.fitnessLevel', 'Fitness {{level}}/10', { level: player.fitnessLevel })}
            </span>
          )}
          <Link to={`/players/${player.id}/nutrition`} className="text-sm text-indigo-500 hover:underline font-medium">
            {tr('reports.viewNutrition', 'View Nutrition →')}
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-gray-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-indigo-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('assessment.count', 'Assessments')}</p>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{assessments.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-gray-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('reports.currentAvgScore', 'Current Avg Score')}</p>
          </div>
          {latestAvg !== null ? (
            <p className="text-2xl font-black" style={{
              color: latestAvg > 7 ? '#10b981' : latestAvg >= 5 ? '#f59e0b' : '#ef4444'
            }}>{latestAvg.toFixed(1)}</p>
          ) : <p className="text-2xl font-black text-gray-400">—</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={14} className="text-amber-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('reports.bestCategory', 'Best Category')}</p>
          </div>
          {bestCategory ? (
            <>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{bestCategory.statCategoryName}</p>
              <p className="text-xs text-amber-500 font-semibold">{bestCategory.score}/10</p>
            </>
          ) : <p className="text-2xl font-black text-gray-400">—</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-gray-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            {overallTrend !== null && overallTrend >= 0 ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('assessment.improvement', 'Improvement')}</p>
          </div>
          {overallTrend !== null ? (
            <p className={`text-2xl font-black ${overallTrend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {overallTrend > 0 ? '+' : ''}{overallTrend.toFixed(0)}%
            </p>
          ) : <p className="text-2xl font-black text-gray-400">—</p>}
        </div>
      </div>

      {/* Active injury warning */}
      {activeInjuries.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="text-sm font-medium">
            {activeInjuries.length === 1
              ? tr('reports.activeInjuryOne', 'Active injury: {{type}}', { type: activeInjuries[0].injuryType })
              : tr('reports.activeInjuriesMany', '{{count}} active injuries may be affecting performance', { count: activeInjuries.length })}
          </span>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card header={tr('reports.autoInsights', 'Auto-generated Insights')}>
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
            {tr('reports.aiPerformanceAnalysis', 'AI Performance Analysis')}
          </span>
          <button
            onClick={handleGenerateInsights}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles size={12} />
            {aiInsights ? tr('common.regenerate', 'Regenerate') : tr('reports.generateAiInsights', 'Generate AI Insights')}
          </button>
        </div>
      }>
        {!isGenerating && !aiInsights && (
          <AIDataSourcesNote playerId={playerId} className="mb-3" />
        )}
        {isGenerating && (
          <AILoadingPanel
            compact
            primaryText={tr('reports.aiAnalyzingPerformance', 'Analyzing performance data...')}
            messages={[
              tr('reports.aiMsgReviewHistory', 'Reviewing assessment history...'),
              tr('reports.aiMsgIdentifyStrengths', 'Identifying strengths and weaknesses...'),
              tr('reports.aiMsgGenerateInsights', 'Generating data-driven insights...'),
              tr('reports.aiMsgFinalizing', 'Finalizing analysis...'),
            ]}
            estimatedSeconds={10}
          />
        )}
        {aiError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {aiError}
            <button onClick={handleGenerateInsights} className="ml-auto text-xs font-semibold underline cursor-pointer">{tr('common.retry', 'Retry')}</button>
          </div>
        )}
        {!aiInsights && !isGenerating && !aiError && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            {tr('reports.aiPlayerHint', 'Click "Generate AI Insights" to get data-driven analysis from Claude.')}
          </p>
        )}
        {aiInsights && !isGenerating && (
          <ul className="space-y-3">
            {aiInsights.map((insight, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30"
              >
                <Lightbulb size={15} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-800 dark:text-gray-200">{insight}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>

      {/* Performance over time */}
      <Card header={
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">{tr('reports.performanceOverTime', 'Performance Over Time')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">
            {tr('reports.performanceOverTimeSub', 'Score per stat across assessment periods (0–10) · click a stat to focus it')}
          </p>
        </div>
      }>
        {sorted.length < 2 ? (
          <EmptyState
            title={tr('reports.notEnoughData', 'Not enough data')}
            description={tr('reports.needTwoAssessments', 'Needs at least 2 assessments to show trends')}
            action={{ label: tr('assessment.addAssessment', 'Add Assessment'), onClick: () => navigate(`/players/${player.id}/assessment`) }}
          />
        ) : (
          <>
            {/* Stat focus pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {allCategories.map((cat, i) => {
                const color = COLORS[i % COLORS.length];
                const isFocused = focusedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFocusedCategory(prev => prev === cat ? null : cat)}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium transition-all cursor-pointer ${
                      isFocused
                        ? 'border-transparent text-white shadow-sm'
                        : focusedCategory
                          ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-transparent opacity-50'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    style={isFocused ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isFocused ? 'rgba(255,255,255,0.8)' : color }}
                    />
                    {cat}
                  </button>
                );
              })}
              {focusedCategory && (
                <button
                  onClick={() => setFocusedCategory(null)}
                  className="text-xs px-3 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 transition-colors cursor-pointer"
                >
                  {tr('reports.showAll', 'Show all')}
                </button>
              )}
            </div>
            <LineChartWrapper
              data={lineData}
              series={visibleCategories.map((cat, i) => ({
                key: cat,
                name: cat,
                color: COLORS[i % COLORS.length],
              }))}
              height={300}
              focusedKey={focusedCategory}
              yAxisLabel={tr('reports.scoreOutOf10', 'Score / 10')}
            />
          </>
        )}
      </Card>

      {/* Radar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card header={previous ? tr('reports.skillRadarVs', 'Skill Radar — Current vs Previous') : tr('reports.skillRadarLatest', 'Skill Radar — Latest')}>
          {!latest ? (
            <EmptyState title={tr('reports.noAssessments', 'No assessments')} description={tr('reports.noDataToDisplay', 'No data to display')} />
          ) : (
            <RadarChartWrapper data={radarData} showPrevious={!!previous} height={380} onPointClick={openBreakdownForCategory} />
          )}
        </Card>

        {/* Improvement trends */}
        <Card header={tr('reports.improvementTrends', 'Improvement Trends')}>
          {trends.length === 0 ? (
            <EmptyState title={tr('reports.noData', 'No data')} description={tr('reports.noAssessmentDataAvailable', 'No assessment data available')} />
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
      <Card header={tr('assessment.assessmentHistory', 'Assessment History')}>
        {!assessments.length ? (
          <EmptyState
            title={tr('reports.noAssessments', 'No assessments')}
            description={tr('reports.noAssessmentsRecorded', 'No assessments recorded yet')}
            action={{ label: tr('assessment.addAssessment', 'Add Assessment'), onClick: () => navigate(`/players/${player.id}/assessment`) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">{tr('assessment.date', 'Date')}</th>
                  <th className="pb-2 pr-4 font-medium">{tr('assessment.periodLabel', 'Period')}</th>
                  <th className="pb-2 pr-4 font-medium">{tr('reports.avgScore', 'Avg Score')}</th>
                  <th className="pb-2 font-medium">{tr('reports.numStats', '# Stats')}</th>
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
                    <Fragment key={a.id}>
                      <tr
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : a.id)}
                      >
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                          {formatDate(a.dateRecorded)}
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
                        <tr className="bg-gray-50 dark:bg-gray-800/60">
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Match performance */}
      <Card header={tr('reports.matchPerformance', 'Match Performance')}>
        {!recentMatches.length ? (
          <EmptyState title={tr('reports.noMatchData', 'No match data')} description={tr('reports.noMatchPerformances', 'No match performances recorded')} />
        ) : (
          <BarChartWrapper
            data={matchBarData}
            series={[{ key: 'rating', name: tr('reports.performanceRating', 'Performance Rating'), color: '#6366f1' }]}
            height={240}
          />
        )}
      </Card>

      {/* Injury history */}
      <Card header={tr('reports.injuryHistory', 'Injury History')}>
        {!injuries.length ? (
          <EmptyState title={tr('reports.noInjuriesRecorded', 'No injuries recorded')} description={tr('reports.noInjuryHistory', 'No injury history')} />
        ) : (
          <div className="space-y-3">
            {injuries.map(inj => (
              <div key={inj.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{inj.injuryType}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(inj.injuryDate)}
                    {inj.expectedReturnDate && ` · ${tr('reports.expectedReturn', 'Expected return: {{date}}', { date: formatDate(inj.expectedReturnDate) })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inj.severity] ?? ''}`}>
                    {labels.generic('severity', inj.severity)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECOVERY_COLORS[inj.recoveryStatus] ?? ''}`}>
                    {inj.recoveryStatus === 'FullyRecovered' ? labels.status('Recovered') : labels.status(inj.recoveryStatus)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Evidence Quality */}
      {evidenceScores.length > 0 && (
        <Card header={tr('evidence.qualityTitle', 'Evidence Quality')}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr('evidence.coverage', 'Evidence coverage: {{verified}}/{{total}} metrics have High confidence', {
              verified: verifiedCount, total: evidenceScores.length,
            })}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {reliable.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                  {tr('evidence.mostReliable', 'Most Reliable Metrics')}
                </h4>
                <div className="space-y-1.5">
                  {reliable.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{s.metricName}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{s.finalScore.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {needsData.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
                  {tr('evidence.needsMoreData', 'Needs More Data')}
                </h4>
                <div className="space-y-1.5">
                  {needsData.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{s.metricName}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${confidenceBadgeClass(s.confidence)}`}>
                        {confidenceLabel(s.confidence, tr)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pe-4">{tr('evidence.metric', 'Metric')}</th>
                  <th className="py-2 pe-4">{tr('evidence.score', 'Score')}</th>
                  <th className="py-2 pe-4">{tr('evidence.confidence', 'Confidence')}</th>
                  <th className="py-2">{tr('evidence.sources', 'Sources')}</th>
                </tr>
              </thead>
              <tbody>
                {evidenceScores.map(s => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                    onClick={() => { const m = metricByName.get(s.metricName); if (m) setBreakdownMetric(m); }}
                  >
                    <td className="py-2 pe-4 font-medium text-gray-800 dark:text-gray-200">{s.metricName}</td>
                    <td className="py-2 pe-4 font-bold text-gray-900 dark:text-white">{s.finalScore.toFixed(1)}</td>
                    <td className="py-2 pe-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${confidenceBadgeClass(s.confidence)}`}>
                        {confidenceLabel(s.confidence, tr)}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400">{s.evidenceSources.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {breakdownMetric && playerId && (
        <EvidenceBreakdownModal
          isOpen={!!breakdownMetric}
          onClose={() => setBreakdownMetric(null)}
          playerId={playerId}
          metric={breakdownMetric}
          score={evidenceByMetricId.get(breakdownMetric.id) ?? null}
          teamId={player.teamId}
        />
      )}
    </PageWrapper>
  );
}
