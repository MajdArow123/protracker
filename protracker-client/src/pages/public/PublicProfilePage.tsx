import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Share2, Check, Trophy, Target, BookOpen, Award, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { usePublicProfileView } from '../../hooks/usePublicProfile';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { MOOD_CONFIG } from '../../components/journal/journalUtils';
import { Spinner } from '../../components/ui/Spinner';
import type { JournalMood } from '../../types';

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const RESULT_STYLE: Record<string, string> = {
  Win: 'bg-green-500/20 text-green-300',
  Draw: 'bg-gray-500/20 text-gray-300',
  Loss: 'bg-red-500/20 text-red-300',
};

export function PublicProfilePage() {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = usePublicProfileView(slug);
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: data?.displayName, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-[#0b0d13] flex items-center justify-center"><Spinner /></div>;
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#0b0d13] flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <Activity size={26} className="text-indigo-400" />
        </div>
        <h1 className="text-xl font-bold text-white">{t('coaches.publicProfileNotAvailable', 'Profile not available')}</h1>
        <p className="text-gray-400 mt-1 max-w-sm">{t('coaches.profilePrivateOrMissing', "This profile is private or doesn't exist.")}</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
          {t('coaches.exploreProTracker', 'Explore ProTracker')} <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  const radar = data.skills.map(s => ({ subject: s.category, value: s.value }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0d13] to-[#12151f] text-gray-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Brand + share */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Activity size={17} className="text-white" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">ProTracker</span>
          </Link>
          <button onClick={share} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium cursor-pointer">
            {copied ? <Check size={15} className="text-green-400" /> : <Share2 size={15} />} {copied ? t('coaches.copied', 'Copied') : t('coaches.share', 'Share')}
          </button>
        </div>

        {/* Hero */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {data.profileImageUrl ? (
            <img src={data.profileImageUrl} alt={data.displayName} className="w-24 h-24 rounded-2xl object-cover border border-white/10" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-3xl font-bold text-indigo-300">
              {initials(data.displayName)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{data.displayName}</h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300">{dyn.sport(data.sport)}</span>
              {data.position && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-gray-300">{data.position}</span>}
            </div>
            {data.bio && <p className="text-sm text-gray-400 mt-3 max-w-lg">{data.bio}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-3xl font-bold text-white">{data.assessmentCount}</p>
            <p className="text-xs text-gray-400 mt-1">{t('coaches.assessments', 'Assessments')}</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-3xl font-bold text-white">{data.latestAvgScore != null ? data.latestAvgScore : '—'}<span className="text-lg text-gray-500">/10</span></p>
            <p className="text-xs text-gray-400 mt-1">{t('coaches.latestAvgScore', 'Latest avg score')}</p>
          </div>
        </div>

        {/* Skills radar */}
        {data.showAssessments && radar.length > 0 && (
          <Section icon={<Award size={16} />} title={t('coaches.skills', 'Skills')}>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <RadarChartWrapper data={radar} height={340} />
            </div>
          </Section>
        )}

        {/* Goals */}
        {data.showGoals && data.goals.length > 0 && (
          <Section icon={<Target size={16} />} title={t('coaches.goals', 'Goals')}>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.goals.map((g, i) => (
                <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white text-sm">{g.title}</p>
                    {g.status === 'Achieved' && <Trophy size={15} className="text-green-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{dyn.category(g.category)}</p>
                  {g.progressPercent != null && (
                    <div className="mt-2.5">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${g.progressPercent}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {g.targetValue != null ? `${g.currentValue ?? 0} / ${g.targetValue}${g.unit ? ` ${g.unit}` : ''}` : `${g.progressPercent}%`}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Journal */}
        {data.showJournal && data.journal.length > 0 && (
          <Section icon={<BookOpen size={16} />} title={t('coaches.recentJournal', 'Recent journal')}>
            <div className="space-y-2.5">
              {data.journal.map((j, i) => {
                const cfg = MOOD_CONFIG[j.mood as JournalMood];
                const Icon = cfg?.icon ?? BookOpen;
                return (
                  <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4 flex gap-3">
                    <div className={clsx('flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center', cfg?.bg ?? 'bg-white/10')}>
                      <Icon size={17} className={cfg?.color ?? 'text-gray-300'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-sm">{j.title}</p>
                        <span className="text-[11px] text-gray-500">{new Date(j.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">{j.excerpt}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Match history */}
        {data.showMatchHistory && data.matches.length > 0 && (
          <Section icon={<Trophy size={16} />} title={t('coaches.matchHistory', 'Match history')}>
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                      <th className="px-4 py-2.5 font-medium">{t('coaches.thDate', 'Date')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('coaches.thOpponent', 'Opponent')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('coaches.thScore', 'Score')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('coaches.thResult', 'Result')}</th>
                      <th className="px-4 py-2.5 font-medium text-right">{t('coaches.thRating', 'Rating')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matches.map((m, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(m.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                        <td className="px-4 py-2.5 text-white">{m.opponentName}</td>
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{m.ourScore}–{m.opponentScore}</td>
                        <td className="px-4 py-2.5"><span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', RESULT_STYLE[m.result])}>{dyn.generic('result', m.result)}</span></td>
                        <td className="px-4 py-2.5 text-right text-white font-medium">{m.rating != null ? m.rating : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/30 p-6 text-center">
          <h2 className="text-lg font-bold text-white">{t('coaches.trainSmarter', 'Train smarter with ProTracker')}</h2>
          <p className="text-sm text-gray-400 mt-1">{t('coaches.trackSetShare', 'Track your performance, set goals, and share your progress.')}</p>
          <Link to="/register" className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
            {t('coaches.connectOnProTracker', 'Connect on ProTracker')} <ArrowRight size={15} />
          </Link>
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">{t('coaches.poweredBy', 'Powered by ProTracker')}</p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        <span className="text-indigo-400">{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}
