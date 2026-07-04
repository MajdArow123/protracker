import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { TeamReport } from '../../types';

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 42, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#111827', paddingBottom: 8, marginBottom: 18 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111827' },
  brandSub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  genDate: { fontSize: 9, color: '#6b7280' },
  teamName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111827' },
  meta: { fontSize: 10, color: '#4b5563', marginTop: 3 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderColor: '#d1d5db' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: '#f0f1f3' },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: '#f0f1f3' },
  bullet: { flexDirection: 'row', marginBottom: 5 },
  bulletDot: { width: 14, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  footer: { position: 'absolute', bottom: 24, left: 42, right: 42, fontSize: 8, color: '#9ca3af', textAlign: 'center', borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 6 },
});

export function TeamReportPDF({ report }: { report: TeamReport }) {
  const { team, playerCount, averageScoreByCategory, playerAverageScores, activeInjuryCount } = report;
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const rankings = [...playerAverageScores].sort((a, b) => b.averageScore - a.averageScore);
  const topPerformers = rankings.slice(0, 5);
  const catEntries = Object.entries(averageScoreByCategory).sort((a, b) => b[1] - a[1]);
  const teamAvg = playerAverageScores.length
    ? playerAverageScores.reduce((s, p) => s + p.averageScore, 0) / playerAverageScores.length
    : 0;

  return (
    <Document title={`${team.name} — Team Report`} author="ProTracker">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>ProTracker</Text>
            <Text style={styles.brandSub}>Team Performance Report</Text>
          </View>
          <Text style={styles.genDate}>Generated {generated}</Text>
        </View>

        <Text style={styles.teamName}>{team.name}</Text>
        <Text style={styles.meta}>
          {team.sportName}  ·  {playerCount} players  ·  Team avg {teamAvg.toFixed(1)}/10
          {activeInjuryCount > 0 ? `  ·  ${activeInjuryCount} injured` : ''}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Averages by Category</Text>
          {catEntries.length === 0 ? (
            <Text style={[styles.muted, { padding: 6 }]}>No assessment data available.</Text>
          ) : catEntries.map(([cat, score]) => (
            <View style={styles.catRow} key={cat}>
              <Text>{cat}</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{score.toFixed(1)} / 10</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Player Roster</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: '10%' }]}>#</Text>
            <Text style={[styles.th, { width: '60%' }]}>Player</Text>
            <Text style={[styles.th, { width: '30%' }]}>Average Score</Text>
          </View>
          {rankings.length === 0 ? (
            <Text style={[styles.muted, { padding: 6 }]}>No players assessed.</Text>
          ) : rankings.map((p, i) => (
            <View style={styles.tableRow} key={p.playerId}>
              <Text style={{ width: '10%' }}>{i + 1}</Text>
              <Text style={{ width: '60%' }}>{p.playerName}</Text>
              <Text style={{ width: '30%' }}>{p.averageScore.toFixed(1)} / 10</Text>
            </View>
          ))}
        </View>

        {topPerformers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Performers</Text>
            {topPerformers.map((p, i) => (
              <View style={styles.bullet} key={p.playerId}>
                <Text style={styles.bulletDot}>{i + 1}.</Text>
                <Text style={{ flex: 1 }}>{p.playerName} — {p.averageScore.toFixed(1)}/10</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>ProTracker — AI-powered multi-sport performance tracking</Text>
      </Page>
    </Document>
  );
}
