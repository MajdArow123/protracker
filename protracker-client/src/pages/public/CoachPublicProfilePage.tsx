import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  Activity, Share2, Check, MapPin, Award, Users, Shield, Star, Mail, ArrowRight,
  CheckCircle2, ArrowLeft, GraduationCap,
} from 'lucide-react';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useCoachPublicView } from '../../hooks/useCoachMarketplace';
import { useAuth } from '../../context/useAuth';
import { RequestConnectionModal } from '../../components/coaches/RequestConnectionModal';
import { CoachReviewsSection } from '../../components/coaches/CoachReviewsSection';
import { Spinner } from '../../components/ui/Spinner';
import { sportGradient } from '../../utils/sportColors';

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function CoachPublicProfilePage() {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const { data, isLoading, isError } = useCoachPublicView(slug, params.get('source') ?? undefined);
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const canRequest = user?.role === 'Athlete' || user?.role === 'SoloAthlete';

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
        <h1 className="text-xl font-bold text-white">{t('coaches.profileNotAvailable', 'Coach profile not available')}</h1>
        <p className="text-gray-400 mt-1 max-w-sm">{t('coaches.profilePrivateOrMissing', "This profile is private or doesn't exist.")}</p>
        <Link to="/coaches" className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
          {t('coaches.browseCoaches', 'Browse coaches')} <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  const grad = sportGradient(data.sportName);
  const location = [data.city, data.country].filter(Boolean).join(', ');

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
            {copied ? <Check size={15} className="text-green-400" /> : <Share2 size={15} />}
            {copied ? t('coaches.copied', 'Copied') : t('coaches.share', 'Share')}
          </button>
        </div>

        <Link to="/coaches" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-5">
          <ArrowLeft size={14} /> {t('coaches.backToCoaches', 'Back to coaches')}
        </Link>

        {/* Hero */}
        <div className={clsx('rounded-3xl p-6 sm:p-8 bg-gradient-to-br mb-6', grad)}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {data.profilePictureUrl ? (
              <img src={data.profilePictureUrl} alt={data.displayName} className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white/20" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/15 flex items-center justify-center text-3xl font-black text-white ring-4 ring-white/20">
                {initials(data.displayName)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-white">{data.displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {data.sportName && (
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-bold">{dyn.sport(data.sportName)}</span>
                )}
                {location && (
                  <span className="flex items-center gap-1 text-white/90 text-sm"><MapPin size={13} /> {location}</span>
                )}
                {data.yearsCoaching != null && (
                  <span className="px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">{t('coaches.yrsCoaching', '{{count}} yrs coaching', { count: data.yearsCoaching })}</span>
                )}
                {data.reviewCount > 0 && data.averageRating != null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                    <Star size={12} className="fill-amber-300 text-amber-300" /> {data.averageRating.toFixed(1)} ({data.reviewCount})
                  </span>
                )}
              </div>
              <div className="mt-3">
                {data.isAcceptingAthletes ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/90 text-white text-xs font-bold">
                    <CheckCircle2 size={13} /> {t('coaches.acceptingAthletes', 'Accepting athletes')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 text-white/80 text-xs font-semibold">
                    {t('coaches.notCurrentlyAccepting', 'Not currently accepting')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat icon={<Shield size={16} />} label={t('coaches.statTeams', 'Teams')} value={String(data.teamCount)} />
          <Stat icon={<Users size={16} />} label={t('coaches.statAthletes', 'Athletes')} value={String(data.playerCount)} />
          <Stat icon={<Star size={16} />} label={t('coaches.statAvgScore', 'Avg score')} value={data.averageTeamScore != null ? data.averageTeamScore.toFixed(1) : '—'} />
        </div>

        {/* About */}
        {(data.bio || data.specialization || data.certifications) && (
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 sm:p-6 mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-3">{t('coaches.about', 'About')}</h2>
            {data.bio && <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{data.bio}</p>}
            {data.specialization && (
              <div className="flex items-start gap-2 mt-4">
                <Award size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('coaches.specialization', 'Specialization')}</p>
                  <p className="text-gray-200">{data.specialization}</p>
                </div>
              </div>
            )}
            {data.certifications && (
              <div className="flex items-start gap-2 mt-3">
                <GraduationCap size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('coaches.certifications', 'Certifications')}</p>
                  <p className="text-gray-200">{data.certifications}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contact / connect */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 sm:p-6 mb-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-3">{t('coaches.connectWith', 'Connect with {{name}}', { name: data.displayName.split(' ')[0] })}</h2>
          {canRequest ? (
            <button
              onClick={() => setRequestOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer"
            >
              {t('coaches.sendConnectionRequest', 'Send connection request')} <ArrowRight size={15} />
            </button>
          ) : user ? (
            <p className="text-sm text-gray-400">{t('coaches.signInAsAthlete', 'Sign in as an athlete to send a connection request.')}</p>
          ) : (
            <Link
              to={`/login?redirect=/coaches/${data.slug}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
            >
              {t('coaches.signInToConnect', 'Sign in to connect')} <ArrowRight size={15} />
            </Link>
          )}
          {data.contactEmail && (
            <a href={`mailto:${data.contactEmail}`} className="flex items-center gap-2 mt-4 text-sm text-indigo-300 hover:text-indigo-200">
              <Mail size={15} /> {data.contactEmail}
            </a>
          )}
        </div>

        {/* Reviews */}
        <CoachReviewsSection slug={data.slug} coachName={data.displayName} sportId={data.sportId} />

        {/* Join CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/20 p-6 text-center">
          <p className="text-white font-semibold mb-1">{t('coaches.newToProTracker', 'New to ProTracker?')}</p>
          <p className="text-sm text-gray-400 mb-4">{t('coaches.ctaConnectLike', 'Track your training, get assessed, and connect with coaches like {{name}}.', { name: data.displayName.split(' ')[0] })}</p>
          <Link to="/register/solo" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-bold hover:bg-gray-100">
            {t('coaches.joinProTracker', 'Join ProTracker')} <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <RequestConnectionModal
        slug={data.slug}
        coachName={data.displayName}
        sportName={data.sportName}
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center">
      <div className="flex items-center justify-center text-indigo-400 mb-1">{icon}</div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
