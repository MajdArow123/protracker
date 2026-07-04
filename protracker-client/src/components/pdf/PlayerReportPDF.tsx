import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { PlayerReport } from '../../types';

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 42, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#111827', paddingBottom: 8, marginBottom: 18 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111827' },
  brandSub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  genDate: { fontSize: 9, color: '#6b7280' },
  playerName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111827' },
  meta: { fontSize: 10, color: '#4b5563', marginTop: 3 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  metric: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 8 },
  metricLabel: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase' },
  metricValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#111827', marginTop: 3 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderColor: '#d1d5db' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: '#f0f1f3' },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  bullet: { flexDirection: 'row', marginBottom: 5, paddingRight: 8 },
  bulletDot: { width: 10, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  footer: { position: 'absolute', bottom: 24, left: 42, right: 42, fontSize: 8, color: '#9ca3af', textAlign: 'center', borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 6 },
});

const col = { date: '22%', period: '30%', score: '20%', best: '28%' };

function assessmentOverall(a: PlayerReport['assessments'][number]): number {
  const scores = a.statScores ?? [];
  if (scores.length === 0) return 0;
  return scores.reduce((s, x) => s + x.score, 0) / scores.length;
}

function bestCategory(a: PlayerReport['assessments'][number]): string {
  const scores = a.statScores ?? [];
  if (scores.length === 0) return '—';
  return scores.reduce((b, x) => (x.score > b.score ? x : b)).statCategoryName;
}

export function PlayerReportPDF({ report, insights }: { report: PlayerReport; insights?: string[] }) {
  const { player, assessments, averageScoreByCategory, injuries } = report;
  // Newest first for the table.
  const byDateDesc = [...assessments].sort((a, b) => +new Date(b.dateRecorded) - +new Date(a.dateRecorded));
  const latest = byDateDesc[0];
  const first = byDateDesc[byDateDesc.length - 1];
  const latestAvg = latest ? assessmentOverall(latest) : 0;
  const firstAvg = first ? assessmentOverall(first) : 0;
  const improvement = first && latest && firstAvg > 0 ? ((latestAvg - firstAvg) / firstAvg) * 100 : 0;

  const catEntries = Object.entries(averageScoreByCategory);
  const best = catEntries.length ? catEntries.reduce((b, e) => (e[1] > b[1] ? e : b)) : null;
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Document title={`${player.fullName} — Performance Report`} author="ProTracker">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>ProTracker</Text>
            <Text style={styles.brandSub}>Player Performance Report</Text>
          </View>
          <Text style={styles.genDate}>Generated {generated}</Text>
        </View>

        <Text style={styles.playerName}>{player.fullName}</Text>
        <Text style={styles.meta}>
          {[player.sportName, player.positionName, player.teamName].filter(Boolean).join('  ·  ')}
          {player.fitnessLevel != null ? `   ·   Fitness ${player.fitnessLevel}/10` : ''}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}><Text style={styles.metricLabel}>Assessments</Text><Text style={styles.metricValue}>{assessments.length}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Latest Avg</Text><Text style={styles.metricValue}>{latest ? latestAvg.toFixed(1) : '—'}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Best Category</Text><Text style={styles.metricValue}>{best ? `${best[0]}` : '—'}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Improvement</Text><Text style={styles.metricValue}>{first && latest && first !== latest ? `${improvement >= 0 ? '+' : ''}${improvement.toFixed(0)}%` : '—'}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessment History</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: col.date }]}>Date</Text>
            <Text style={[styles.th, { width: col.period }]}>Period</Text>
            <Text style={[styles.th, { width: col.score }]}>Overall Score</Text>
            <Text style={[styles.th, { width: col.best }]}>Best Category</Text>
          </View>
          {byDateDesc.length === 0 ? (
            <Text style={[styles.muted, { padding: 6 }]}>No assessments recorded.</Text>
          ) : byDateDesc.map((a) => (
            <View style={styles.tableRow} key={a.id}>
              <Text style={{ width: col.date }}>{new Date(a.dateRecorded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={{ width: col.period }}>{a.assessmentPeriodName || '—'}</Text>
              <Text style={{ width: col.score }}>{assessmentOverall(a).toFixed(1)} / 10</Text>
              <Text style={{ width: col.best }}>{bestCategory(a)}</Text>
            </View>
          ))}
        </View>

        {insights && insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Performance Insights</Text>
            {insights.map((ins, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={{ flex: 1 }}>{ins}</Text>
              </View>
            ))}
          </View>
        )}

        {injuries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Injury History</Text>
            {injuries.map((inj) => (
              <View style={styles.bullet} key={inj.id}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={{ flex: 1 }}>
                  {new Date(inj.injuryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — {inj.injuryType}
                  {inj.bodyPart ? ` (${inj.bodyPart})` : ''} · {inj.severity} · {inj.recoveryStatus === 'FullyRecovered' ? 'Recovered' : inj.recoveryStatus}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>ProTracker — AI-powered multi-sport performance tracking</Text>
      </Page>
    </Document>
  );
}
