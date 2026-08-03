import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import {
  ArrowLeft, Trophy, Zap, Sparkles,
  Users, ShieldAlert, BarChart3, Download,
} from 'lucide-react';
import { AIInsightsList } from '../../components/reports/AIInsightsList';
import { StatCard } from '../../components/dashboard/StatCard';
import { CountUp } from '../../components/ui/CountUp';
import { useGenerateTeamInsights } from '../../hooks/useAI';
import { useBilling } from '../../hooks/useBilling';
import { useToast } from '../../context/useToast';
import { AILoadingPanel } from '../../components/ui/AILoadingPanel';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ReportSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { BarChartWrapper } from '../../components/charts/BarChartWrapper';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { useTeamReport } from '../../hooks/useReports';
import { clsx } from 'clsx';

const SEVERITY_COLORS: Record<string, string> = {
  Minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Severe: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const SPORT_HEADER_COLORS: Record<string, string> = {
  Football: 'from-green-600 via-emerald-600 to-green-700',
  Soccer: 'from-green-600 via-emerald-600 to-green-700',
  'Football / Soccer': 'from-green-600 via-emerald-600 to-green-700',
  Basketball: 'from-orange-500 via-orange-600 to-amber-600',
  Volleyball: 'from-blue-600 via-blue-700 to-indigo-700',
  'Beach Volleyball': 'from-yellow-500 via-amber-500 to-orange-500',
  Tennis: 'from-purple-600 via-violet-600 to-purple-700',
};

export function TeamReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const labels = useDynamicLabels();
  const { data: billing } = useBilling();
  const { addToast } = useToast();
  const teamId = id ? parseInt(id) : undefined;
  const { data: report, isLoading, isError, refetch } = useTeamReport(teamId);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const generateInsights = useGenerateTeamInsights();

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <PageWrapper><ErrorState thing={t('reports.theReport', 'the report')} onRetry={() => refetch()} /></PageWrapper>;
  if (!report) return (
    <PageWrapper>
      <EmptyState
        title={t('reports.reportNotFound', 'Report not found')}
        description={t('reports.couldNotLoadTeam', 'Could not load team report')}
        action={{ label: t('common.back', 'Back'), onClick: () => navigate('/reports') }}
      />
    </PageWrapper>
  );

  const { team, playerCount, averageScoreByCategory, playerAverageScores, activeInjuryCount, activeInjuries, players } = report;

  async function handleGenerateInsights() {
    if (!teamId) return;
    setAiError(null);
    try {
      const result = await generateInsights.mutateAsync(teamId);
      setAiInsights(result.insights);
    } catch {
      setAiError(t('reports.aiFailed', 'AI analysis failed. Please try again.'));
    }
  }

  async function handleExportPdf() {
    if (billing && !billing.limits.pdf) {
      addToast(t('reports.pdfProOnly', 'PDF export is available on the Pro plan.'), 'info');
      navigate('/settings/billing');
      return;
    }
    setExporting(true);
    try {
      const [{ downloadPdf, reportFilename }, { TeamReportPDF }] = await Promise.all([
        import('../../utils/exportPdf'),
        import('../../components/pdf/TeamReportPDF'),
      ]);
      await downloadPdf(<TeamReportPDF report={report!} />, reportFilename(team.name));
    } finally {
      setExporting(false);
    }
  }

  const isGenerating = generateInsights.isPending;
  const headerGrad = SPORT_HEADER_COLORS[team.sportName] ?? 'from-indigo-600 to-violet-700';

  const barData = [...playerAverageScores]
    .sort((a, b) => b.averageScore - a.averageScore) // highest first
    .map(p => ({
      name: p.playerName.split(' ')[0],
      score: parseFloat(p.averageScore.toFixed(1)),
    }));

  const assessedScores = playerAverageScores.filter(p => p.averageScore > 0);
  const teamAvg = assessedScores.length > 0
    ? parseFloat((assessedScores.reduce((s, p) => s + p.averageScore, 0) / assessedScores.length).toFixed(1))
    : null;

  const radarData = Object.entries(averageScoreByCategory).map(([subject, value]) => ({
    subject,
    value: parseFloat(value.toFixed(1)),
  }));

  const bestCategory = radarData.length > 0
    ? radarData.reduce((a, b) => b.value > a.value ? b : a)
    : null;

  const top3 = playerAverageScores.slice(0, 3);
  const needsAttention = playerAverageScores.filter(p => p.averageScore === 0 || p.averageScore < 5);
  const assessed = playerAverageScores.filter(p => p.averageScore > 0).length;

  // Look up player name from players list for injury display
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.fullName]));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto">
      {/* Sport-gradient hero */}
      <div className={clsx('relative overflow-hidden bg-gradient-to-br', headerGrad)}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="relative z-10 p-4 lg:p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> {t('reports.title', 'Reports')}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all cursor-pointer border border-white/20 disabled:opacity-60"
            >
              <Download size={15} /> {exporting ? t('reports.generatingPdf', 'Generating PDF…') : t('reports.exportPdf', 'Export PDF')}
            </button>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight">{team.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{labels.sport(team.sportName)}</span>
            <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{t('reports.playersCount', '{{count}} players', { count: playerCount })}</span>
            {activeInjuryCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-500/30 border border-red-400/40 text-red-200 text-xs font-semibold flex items-center gap-1">
                <ShieldAlert size={11} /> {t('reports.injuredCount', '{{count}} injured', { count: activeInjuryCount })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Metric cards — glass morphism, matching the dashboards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title={t('reports.players', 'Players')}
            value={playerCount}
            icon={Users}
            gradient="from-indigo-500 to-blue-600"
          />
          <StatCard
            title={t('reports.currentAvgScore', 'Current Avg Score')}
            icon={BarChart3}
            gradient="from-emerald-500 to-green-600"
            valueNode={teamAvg !== null ? (
              <span style={{ color: teamAvg > 7 ? '#10b981' : teamAvg >= 5 ? '#f59e0b' : '#ef4444' }}>
                <CountUp value={teamAvg} decimals={1} className="text-3xl font-black mt-0.5 block tabular-nums" />
              </span>
            ) : <p className="text-3xl font-black text-gray-400 mt-0.5">—</p>}
          />
          <StatCard
            title={t('reports.assessed', 'Assessed')}
            icon={Zap}
            gradient="from-violet-500 to-purple-600"
            valueNode={
              <p className="text-3xl font-black text-gray-900 dark:text-white mt-0.5 tabular-nums">
                {assessed}<span className="text-sm font-bold text-gray-400">/{playerCount}</span>
              </p>
            }
          />
          <StatCard
            title={t('reports.bestCategory', 'Best Category')}
            icon={Trophy}
            gradient="from-amber-500 to-orange-600"
            valueNode={bestCategory ? (
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate mt-0.5">{bestCategory.subject}</p>
                <p className="text-xs text-amber-500 font-semibold">{bestCategory.value}/10</p>
              </div>
            ) : <p className="text-3xl font-black text-gray-400 mt-0.5">—</p>}
          />
        </div>

        {/* Team performance bar chart */}
        <Card header={
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100">{t('reports.playerPerfComparison', 'Player Performance Comparison')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">
              {t('reports.playerPerfComparisonSub', 'Average assessment score per player (0–10 scale) · sorted highest to lowest')}
              {teamAvg !== null && <> · <span className="text-indigo-500 dark:text-indigo-400">{t('reports.teamAvg', 'Team avg: {{value}}', { value: teamAvg })}</span></>}
            </p>
          </div>
        }>
          {barData.length === 0 || barData.every(d => d.score === 0) ? (
            <EmptyState title={t('reports.noAssessmentData', 'No assessment data')} description={t('reports.playersNotAssessed', 'Players have not been assessed yet')} />
          ) : (
            <BarChartWrapper
              data={barData}
              series={[{ key: 'score', name: t('reports.avgScore', 'Avg Score'), color: '#6366f1' }]}
              height={280}
              yAxisLabel={t('reports.scoreOutOf10', 'Score / 10')}
              showValueLabels
              referenceLine={teamAvg !== null ? { value: teamAvg, label: t('reports.avgRef', 'Avg {{value}}', { value: teamAvg }) } : undefined}
            />
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team radar */}
          <Card header={t('reports.teamStrengthsWeaknesses', 'Team Strengths & Weaknesses')}>
            {radarData.length === 0 ? (
              <EmptyState title={t('reports.noData', 'No data')} description={t('reports.noAssessmentDataTeam', 'No assessment data for this team')} />
            ) : (
              <RadarChartWrapper data={radarData} height={380} />
            )}
          </Card>

          {/* Top performers */}
          <Card header={t('reports.topPerformers', 'Top Performers')}>
            {top3.length === 0 ? (
              <EmptyState title={t('reports.noData', 'No data')} description={t('reports.noPlayerAssessments', 'No player assessments yet')} />
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
                        className="font-medium text-gray-800 dark:text-gray-200 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
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
          <Card header={t('reports.playersNeedingAttention', 'Players Needing Attention')}>
            <div className="space-y-2">
              {needsAttention.map(p => (
                <div key={p.playerId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                  <button
                    onClick={() => navigate(`/reports/player/${p.playerId}`)}
                    className="font-medium text-gray-800 dark:text-gray-200 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                  >
                    {p.playerName}
                  </button>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.averageScore === 0
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {p.averageScore === 0 ? t('reports.notAssessed', 'Not assessed') : `${p.averageScore.toFixed(1)}/10`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Assessment coverage */}
        <Card header={t('reports.assessmentCoverage', 'Assessment Coverage')}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: playerCount > 0 ? `${(assessed / playerCount) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {t('reports.assessedOfPlayers', '{{assessed}} of {{total}} players assessed', { assessed, total: playerCount })}
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
              {t('reports.notYetAssessed', 'Not yet assessed:')}{' '}
              {playerAverageScores.filter(p => p.averageScore === 0).map(p => p.playerName).join(', ')}
            </div>
          )}
        </Card>

        {/* AI Team Analysis */}
        <Card header={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <Sparkles size={15} className="text-violet-500" />
              {t('reports.aiTeamAnalysis', 'AI Team Analysis')}
            </span>
            <button
              onClick={handleGenerateInsights}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Sparkles size={12} />
              {aiInsights ? t('common.regenerate', 'Regenerate') : t('reports.generateTeamInsights', 'Generate Team Insights')}
            </button>
          </div>
        }>
          {isGenerating && (
            <AILoadingPanel
              compact
              primaryText={t('reports.aiAnalyzingTeam', 'Analyzing team performance...')}
              messages={[
                t('reports.aiMsgReviewPlayers', 'Reviewing player assessments...'),
                t('reports.aiMsgTeamPatterns', 'Identifying team patterns...'),
                t('reports.aiMsgStrategic', 'Generating strategic insights...'),
                t('reports.aiMsgFinalizing', 'Finalizing analysis...'),
              ]}
              estimatedSeconds={10}
            />
          )}
          {aiError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {aiError}
              <button onClick={handleGenerateInsights} className="ml-auto text-xs font-semibold underline cursor-pointer">{t('common.retry', 'Retry')}</button>
            </div>
          )}
          {!aiInsights && !isGenerating && !aiError && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('reports.aiTeamHint', 'Click "Generate Team Insights" to get strategic analysis from Claude.')}
            </p>
          )}
          {aiInsights && !isGenerating && <AIInsightsList insights={aiInsights} />}
        </Card>

        {/* Active injuries */}
        {activeInjuries.length > 0 && (
          <Card header={t('reports.activeInjuries', 'Active Injuries')}>
            <div className="space-y-3">
              {activeInjuries.map(inj => (
                <div key={inj.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{inj.injuryType}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {playerMap[inj.playerId] ?? t('reports.playerNum', 'Player #{{id}}', { id: inj.playerId })} · {formatDate(inj.injuryDate)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inj.severity] ?? ''}`}>
                    {labels.generic('severity', inj.severity)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
