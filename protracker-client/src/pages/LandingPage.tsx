import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity, BarChart3, Brain, Salad, ShieldAlert,
  Trophy, Zap, TrendingUp, Star, ChevronRight, Dumbbell,
  Target, Heart, CheckCircle, Circle, CheckSquare, MessageSquare,
  CalendarDays, HeartPulse, Code2, Globe, Shield, User, UsersRound, Search,
  ClipboardList, FlaskConical, ShieldCheck, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../i18n/dynamicLabels';
import { CountUp } from '../components/ui/CountUp';
import { useSports } from '../hooks/useSports';
import { sportBadge } from '../utils/sportColors';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (i: any) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: (i ?? 0) * 0.1, ease: 'easeOut' },
  }),
};

// works: who the feature applies to — 'Both' (solo + team), 'Team' (coach-managed only).
// `key` addresses landing.features.{key}Title / {key}Desc in the locales.
const FEATURES = [
  { key: 'ai', icon: Brain, title: 'AI-Powered Insights', desc: 'Generate personalized improvement plans, weekly nutrition schedules, and injury recovery programs using Claude AI. Get smart task suggestions based on each athlete\'s weak areas.', color: 'from-purple-500 to-violet-500', works: 'Both' },
  { key: 'analytics', icon: BarChart3, title: 'Performance Analytics', desc: 'Track athlete assessments across multiple categories with gradient sliders. View trend charts, radar skill profiles, and compare progress over time.', color: 'from-indigo-500 to-blue-500', works: 'Both' },
  { key: 'injury', icon: ShieldAlert, title: 'Injury & Recovery Tracking', desc: 'Log injuries with severity levels and assign structured recovery programs. AI generates sport-specific rehab exercises week by week.', color: 'from-red-500 to-rose-500', works: 'Both' },
  { key: 'tasks', icon: CheckSquare, title: 'Task Management', desc: 'Assign targeted training tasks to athletes with priority levels and due dates. AI suggests tasks based on assessment weak areas. Track completion rates.', color: 'from-cyan-500 to-teal-500', works: 'Both' },
  { key: 'messaging', icon: MessageSquare, title: 'Direct Messaging', desc: 'Built-in coach-to-athlete messaging with real-time updates. Share notes privately or with the athlete. Keep communication organized.', color: 'from-blue-500 to-indigo-500', works: 'Team' },
  { key: 'nutrition', icon: Salad, title: 'Nutrition Planning', desc: 'Generate 7-day AI meal plans tailored to the athlete\'s sport, position, and dietary restrictions. Athletes can swap foods for nutritionally equivalent alternatives.', color: 'from-green-500 to-emerald-500', works: 'Both' },
  { key: 'scheduler', icon: CalendarDays, title: 'Training Scheduler', desc: 'Plan weekly training sessions with a calendar view. Athletes see upcoming sessions on their dashboard. Track session completion.', color: 'from-orange-500 to-amber-500', works: 'Both' },
  { key: 'matches', icon: Trophy, title: 'Match Results', desc: 'Log match scores with sport-aware formatting — sets for volleyball/tennis, points for basketball, goals for soccer. Rate individual player performance.', color: 'from-amber-500 to-yellow-500', works: 'Both' },
  { key: 'multiSport', icon: Dumbbell, title: 'Multi-Sport Support', desc: 'Built for Basketball, Soccer, Volleyball, Beach Volleyball, and Tennis. Sport-specific positions, stats, scoring, and color themes throughout.', color: 'from-fuchsia-500 to-pink-500', works: 'Both' },
  { key: 'wellbeing', icon: HeartPulse, title: 'Wellbeing Check-ins', desc: 'Athletes submit daily check-ins rating their energy, sleep, and overall feeling. Coaches see trends and get alerts when athletes report pain during recovery.', color: 'from-rose-500 to-pink-500', works: 'Both' },
];

// The three ways into ProTracker, front and center on the hero.
const ROLE_PATHS = [
  {
    icon: Shield,
    title: "I'm a Coach",
    titleKey: 'landing.roles.coach',
    ctaKey: 'landing.roles.coachCta',
    descKey: 'landing.roles.coachDesc',
    desc: 'Manage your team, track athlete performance, generate AI nutrition and recovery plans.',
    cta: 'Get Started as Coach',
    to: '/login?tab=register',
    accent: 'from-indigo-600/20 to-blue-600/10 border-indigo-500/30 hover:border-indigo-400/60',
    iconBg: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
    button: 'bg-indigo-600 hover:bg-indigo-500',
  },
  {
    icon: UsersRound,
    title: "I'm on a Team",
    titleKey: 'landing.roles.teamAthlete',
    ctaKey: 'landing.roles.teamCta',
    descKey: 'landing.roles.teamDesc',
    desc: 'Join your team with a code from your coach, view your progress, complete tasks and goals.',
    cta: 'Join My Team',
    to: '/register',
    accent: 'from-emerald-600/20 to-teal-600/10 border-emerald-500/30 hover:border-emerald-400/60',
    iconBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    button: 'bg-emerald-600 hover:bg-emerald-500',
  },
  {
    icon: User,
    title: 'I Train Solo',
    titleKey: 'landing.roles.soloAthlete',
    ctaKey: 'landing.roles.soloCta',
    descKey: 'landing.roles.soloDesc',
    desc: 'No coach? No problem. Track your own performance, generate AI meal plans, and improve at your own pace.',
    cta: 'Start Solo Training',
    to: '/register/solo',
    accent: 'from-purple-600/20 to-violet-600/10 border-purple-500/30 hover:border-purple-400/60',
    iconBg: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    button: 'bg-purple-600 hover:bg-purple-500',
  },
];

const ABOUT_STATS = [
  { value: 5, suffix: '', label: 'Sports Supported', labelKey: 'landing.about.statSports' },
  { value: 10, suffix: '+', label: 'AI Features', labelKey: 'landing.about.statAi' },
  { value: 34, suffix: '', label: 'Backend Tests', labelKey: 'landing.about.statTests' },
  { value: 2026, suffix: '', label: 'Built in', labelKey: 'landing.about.statBuilt', countUp: false },
];

const TECH_STACK = [
  { group: 'Backend', groupKey: 'landing.about.techBackend', items: ['ASP.NET Core 9', 'PostgreSQL', 'EF Core', 'JWT Auth'], color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
  { group: 'Frontend', groupKey: 'landing.about.techFrontend', items: ['React 19', 'TypeScript', 'Tailwind CSS', 'Recharts'], color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  { group: 'AI', groupKey: 'landing.about.techAi', items: ['Anthropic Claude API (Haiku + Sonnet)'], color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  { group: 'Hosting', groupKey: 'landing.about.techHosting', items: ['Railway', 'Vercel'], color: 'text-green-300 bg-green-500/10 border-green-500/20' },
];

const NAV_LINKS = [
  { id: 'features', label: 'Features', labelKey: 'landing.nav.features' },
  { id: 'pricing', label: 'Pricing', labelKey: 'landing.nav.pricing' },
  { id: 'about', label: 'About', labelKey: 'landing.nav.about' },
  { id: 'contact', label: 'Contact', labelKey: 'landing.nav.contact' },
];

const SPORTS = [
  { icon: Target, name: 'Football', dot: 'bg-green-500', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  { icon: Circle, name: 'Basketball', dot: 'bg-orange-500', color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30' },
  { icon: Activity, name: 'Volleyball', dot: 'bg-blue-500', color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30' },
  { icon: Zap, name: 'Beach Volleyball', dot: 'bg-yellow-500', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' },
  { icon: TrendingUp, name: 'Tennis', dot: 'bg-purple-500', color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30' },
];

const STATS = [
  { value: '5', label: 'Sports Supported', labelKey: 'landing.stats.sports', icon: Trophy },
  { value: '100+', label: 'Stat Categories', labelKey: 'landing.stats.categories', icon: BarChart3 },
  { value: 'Real-time', valueKey: 'landing.stats.realTimeValue', label: 'Analytics', labelKey: 'landing.stats.analytics', icon: Zap },
  { value: 'AI-Powered', valueKey: 'landing.stats.aiValue', label: 'Insights', labelKey: 'landing.stats.insights', icon: Brain },
];

const TESTIMONIALS = [
  {
    key: 'marcus',
    name: 'Marcus Johnson',
    role: 'Head Coach, City FC',
    sport: 'Football',
    quote: 'ProTracker completely changed how I manage my squad. The assessment tools and AI plans save me hours every week.',
    avatar: 'MJ',
    stars: 5,
  },
  {
    key: 'sarah',
    name: 'Sarah Williams',
    role: 'Performance Coach',
    sport: 'Basketball',
    quote: 'The nutrition tracking and injury management features are incredible. My athletes are performing at their peak.',
    avatar: 'SW',
    stars: 5,
  },
  {
    key: 'carlos',
    name: 'Carlos Rivera',
    role: 'Academy Director',
    sport: 'Tennis',
    quote: 'I\'ve tried many platforms, but nothing comes close to ProTracker\'s depth of analytics and ease of use.',
    avatar: 'CR',
    stars: 5,
  },
  {
    key: 'aisha',
    name: 'Aisha Diallo',
    role: 'Solo Athlete',
    sport: 'Basketball',
    quote: 'Perfect for recreational players who want to take their game seriously without being on a formal team. I track everything myself — and it just works.',
    avatar: 'AD',
    stars: 5,
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Alias for map callbacks whose parameter is named `t` (tech stack, testimonials)
  // — the documented shadowing gotcha.
  const tr = t;
  const L = useDynamicLabels();
  const [scrolled, setScrolled] = useState(false);
  const { data: sports = [] } = useSports();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Nav — sticky; gains a blurred, semi-transparent background once scrolled. */}
      <nav className={clsx(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300',
        scrolled ? 'bg-gray-950/80 backdrop-blur-md border-b border-gray-800/70 shadow-lg shadow-black/20' : 'bg-transparent border-b border-transparent',
      )}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 cursor-pointer">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={17} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">ProTracker</span>
        </button>
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollToSection(l.id)}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              {t(l.labelKey, l.label)}
            </button>
          ))}
          <button
            onClick={() => navigate('/coaches')}
            className="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {t('landing.nav.findACoach', 'Find a Coach')}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="dark" />
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {t('landing.hero.signIn', 'Sign In')}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
          >
            {t('landing.nav.getStarted', 'Get Started')}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated background gradient (slow pan, disabled for reduced motion) */}
        <div className="absolute inset-0 animate-gradient-pan bg-gradient-to-br from-gray-950 via-indigo-950/70 to-purple-950/50" />
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl"
          animate={{ x: [0, -35, 0], y: [0, 25, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating icons */}
        <div className="absolute top-32 left-16 animate-float opacity-20">
          <Dumbbell size={40} className="text-indigo-400" />
        </div>
        <div className="absolute top-48 right-20 animate-float-delay opacity-20">
          <Target size={36} className="text-purple-400" />
        </div>
        <div className="absolute bottom-32 left-24 animate-float-delay-2 opacity-20">
          <Heart size={32} className="text-rose-400" />
        </div>
        <div className="absolute bottom-40 right-16 animate-float opacity-20">
          <TrendingUp size={38} className="text-green-400" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium mb-6"
          >
            <Zap size={14} />
            {t('landing.hero.badge', 'Professional Sports Performance Platform')}
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-none mb-6"
          >
            {t('landing.hero.titleLine1', 'Track. Analyze.')}
            <br />
            <span className="gradient-text-animated">{t('landing.hero.titleLine2', 'Dominate.')}</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10"
          >
            {t('landing.hero.description', 'The professional sports analytics platform for coaches, team athletes, and solo athletes. AI-powered insights, real-time tracking, and data-driven performance management.')}
          </motion.p>

          {/* Three ways in: coach, team athlete, solo athlete */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left"
          >
            {ROLE_PATHS.map((r) => (
              <div
                key={r.title}
                className={`group flex flex-col rounded-2xl bg-gradient-to-br ${r.accent} border p-5 transition-all hover:shadow-xl hover:shadow-black/20`}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${r.iconBg} mb-3`}>
                  <r.icon size={19} />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">{t(r.titleKey, r.title)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{t(r.descKey, r.desc)}</p>
                <button
                  onClick={() => navigate(r.to)}
                  className={`mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl ${r.button} text-white font-semibold text-sm transition-all cursor-pointer group-hover:shadow-lg`}
                >
                  {t(r.ctaKey, r.cta)}
                  <ChevronRight size={15} />
                </button>
              </div>
            ))}
          </motion.div>

          <motion.p
            custom={4}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mt-6 text-sm text-gray-500"
          >
            {t('landing.hero.haveAccount', 'Already have an account?')}{' '}
            <button onClick={() => navigate('/login')} className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
              {t('landing.hero.signIn', 'Sign In')}
              <ChevronRight size={13} />
            </button>
          </motion.p>

          <motion.div
            custom={5}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-gray-500"
          >
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> {t('landing.hero.freeToStart', 'Free to start')}</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> {t('landing.hero.noCreditCard', 'No credit card')}</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> {t('landing.hero.aiPowered', 'AI-powered')}</span>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm font-semibold uppercase tracking-widest text-gray-500 mb-12"
          >
            {t('landing.stats.trustedBy', 'Trusted by coaches worldwide')}
          </motion.p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-3 mx-auto">
                  <s.icon size={22} />
                </div>
                <div className="text-3xl font-black text-white">{s.valueKey ? t(s.valueKey, s.value) : s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{t(s.labelKey, s.label)}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight mb-4">
              {t('landing.how.titleA', 'How it')} <span className="gradient-text">{t('landing.how.titleB', 'works')}</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('landing.how.subtitle', 'From first login to data-driven training in three steps.')}
            </p>
          </motion.div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-7 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40" />
            {[
              {
                icon: UsersRound,
                gradient: 'from-indigo-500 to-blue-600',
                title: t('landing.how.step1Title', 'Set up in minutes'),
                desc: t('landing.how.step1Desc', 'Create your team as a coach, join with a code from your coach, or start a solo profile. Sport-specific positions and stats are ready out of the box.'),
              },
              {
                icon: ClipboardList,
                gradient: 'from-purple-500 to-violet-600',
                title: t('landing.how.step2Title', 'Assess & collect evidence'),
                desc: t('landing.how.step2Desc', 'Score athletes on gradient sliders, then back scores with objective tests, match stats, and guided evaluations for measurement-based accuracy.'),
              },
              {
                icon: Brain,
                gradient: 'from-pink-500 to-rose-600',
                title: t('landing.how.step3Title', 'Train smarter with AI'),
                desc: t('landing.how.step3Desc', 'Generate improvement plans, weekly nutrition, recovery programs and task suggestions that reference real measured values.'),
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative text-center md:px-4"
              >
                <div className={`relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${step.gradient} shadow-lg mb-5`}>
                  <step.icon size={24} className="text-white" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-950 border border-gray-700 text-[11px] font-black text-white flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black tracking-tight mb-4">
              {t('landing.features.titleA', 'Everything you need to')}{' '}
              <span className="gradient-text">{t('landing.features.titleB', 'develop elite athletes')}</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('landing.features.subtitle', 'ProTracker combines AI, analytics, and communication tools into one platform built for modern sports teams.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className="group relative p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-600 transition-all hover:shadow-xl hover:shadow-black/20 cursor-default"
              >
                {/* Logical end-4 so the badge mirrors away from the title in RTL. */}
                <span className={clsx(
                  'absolute top-4 end-4 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  f.works === 'Both'
                    ? 'text-purple-300 bg-purple-500/10 border-purple-500/30'
                    : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
                )}>
                  {f.works === 'Both' ? t('landing.features.worksBoth', 'Solo + Team') : t('landing.features.worksTeam', 'Teams')}
                </span>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} mb-4 shadow-lg`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 pe-4">{t(`landing.features.${f.key}Title`, f.title)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(`landing.features.${f.key}Desc`, f.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence-based scoring — the differentiator */}
      <section className="py-24 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                <ShieldCheck size={13} /> {t('landing.evidence.badge', 'Evidence-Based Assessment')}
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-5">
                {t('landing.evidence.titleA', 'Scores you can')} <span className="gradient-text">{t('landing.evidence.titleB', 'actually trust')}</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                {t('landing.evidence.description', "Most platforms stop at coach gut-feel. ProTracker backs every rating with real measurements — sprint times, match statistics, structured evaluations — and tells you how confident each score is.")}
              </p>
              <ul className="space-y-3">
                {[
                  { icon: FlaskConical, text: t('landing.evidence.point1', '54 sport-specific objective tests with elite & average benchmarks') },
                  { icon: BarChart3, text: t('landing.evidence.point2', 'Match stats flow into skill scores automatically when you rate a game') },
                  { icon: ShieldCheck, text: t('landing.evidence.point3', 'Confidence levels on every metric — see exactly which scores are verified') },
                ].map(pt => (
                  <li key={pt.text} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
                      <pt.icon size={14} />
                    </span>
                    <span className="pt-1">{pt.text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Mock metric card — mirrors the real Evidence tab UI */}
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-3xl bg-gray-900/70 border border-gray-800 p-6 shadow-2xl shadow-black/40"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
                {t('landing.evidence.cardTitle', 'Evidence summary — Speed')}
              </p>
              <div className="flex items-end justify-between mb-3">
                <span className="text-5xl font-black text-white tabular-nums">8.2<span className="text-lg text-gray-500">/10</span></span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                  {t('landing.evidence.confidenceHigh', 'High confidence')}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-6">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '82%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                />
              </div>
              <div className="space-y-3">
                {[
                  { label: t('landing.evidence.srcTests', 'Objective tests'), value: '30m sprint — 4.0s', weight: '40%', on: true },
                  { label: t('landing.evidence.srcMatch', 'Match stats'), value: '9.2 km covered', weight: '30%', on: true },
                  { label: t('landing.evidence.srcCoach', 'Coach evaluation'), value: '8.0 / 10', weight: '20%', on: true },
                  { label: t('landing.evidence.srcSelf', 'Self-assessment'), value: t('landing.evidence.missing', 'missing'), weight: '10%', on: false },
                ].map(src => (
                  <div key={src.label} className="flex items-center gap-3 text-sm">
                    {src.on
                      ? <Check size={14} className="text-emerald-400 flex-shrink-0" />
                      : <Circle size={13} className="text-gray-600 flex-shrink-0" />}
                    <span className={src.on ? 'text-gray-300' : 'text-gray-600'}>{src.label}</span>
                    <span className={clsx('ms-auto font-mono text-xs', src.on ? 'text-gray-400' : 'text-gray-600')}>{src.value}</span>
                    <span className="text-[10px] font-bold text-gray-600 w-8 text-end">{src.weight}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-black tracking-tight mb-3">{t('landing.sports.title', 'Built for every sport')}</h2>
            <p className="text-gray-400">{t('landing.sports.subtitle', 'Sport-specific stat categories and position profiles for each discipline.')}</p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4">
            {SPORTS.map((s, i) => (
              <motion.div
                key={s.name}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-br ${s.color} border cursor-default hover:scale-105 transition-transform`}
              >
                <div className={`w-6 h-6 rounded-full ${s.dot} flex items-center justify-center`}>
                  <s.icon size={13} className="text-white" />
                </div>
                <span className="font-semibold text-white">{L.sport(s.name)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left — text + stats */}
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
              <h2 className="text-4xl font-black tracking-tight mb-6">
                {t('landing.about.titleA', 'About')} <span className="gradient-text" dir="ltr">ProTracker</span>
              </h2>
              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>{t('landing.about.p1', 'ProTracker is a full-stack sports performance platform designed for coaches and athletes who take performance seriously.')}</p>
                <p>{t('landing.about.p2', 'Built with modern technology including ASP.NET Core 9, React, PostgreSQL, and the Anthropic Claude AI API, ProTracker gives coaches the tools they need to track, analyze, and improve athlete performance across 5 sports.')}</p>
                <p>{t('landing.about.p3', 'From AI-generated nutrition plans to injury recovery programs, every feature is designed to save coaches time while giving athletes the personalized attention they need to reach their potential.')}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
                {ABOUT_STATS.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-gray-900/50 border border-gray-800 p-4 text-center">
                    <div className="text-2xl font-black text-white">
                      {s.countUp === false
                        ? <span>{s.value}{s.suffix}</span>
                        : <CountUp value={s.value} suffix={s.suffix} />}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{t(s.labelKey, s.label)}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — tech stack */}
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-3xl bg-gray-900/50 border border-gray-800 p-7"
            >
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6">{t('landing.about.builtWith', 'Built with')}</h3>
              <div className="space-y-5">
                {TECH_STACK.map((t) => (
                  <div key={t.group}>
                    <p className="text-xs font-semibold text-gray-400 mb-2">{tr(t.groupKey, t.group)}</p>
                    <div className="flex flex-wrap gap-2">
                      {t.items.map((it) => (
                        <span key={it} dir="ltr" className={clsx('text-xs font-medium px-3 py-1.5 rounded-full border', t.color)}>{it}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-black tracking-tight mb-3">{t('landing.testimonials.title', 'Coaches and athletes love ProTracker')}</h2>
            <p className="text-gray-400">{t('landing.testimonials.subtitle', 'From full squads to solo grinders — join the players already transforming their game.')}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800"
              >
                <div className="flex mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">"{tr(`landing.testimonials.${t.key}Quote`, t.quote)}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{tr(`landing.testimonials.${t.key}Role`, t.role)} · {L.sport(t.sport)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-gray-900/30 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-4xl font-black tracking-tight mb-4">
              {t('landing.pricing.titleA', 'Simple, honest')} <span className="gradient-text">{t('landing.pricing.titleB', 'pricing')}</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('landing.pricing.subtitle', 'Free for athletes, forever. Coaches upgrade when their program grows.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {[
              {
                name: t('landing.pricing.freeName', 'Free'),
                price: '$0',
                period: '',
                desc: t('landing.pricing.freeDesc', 'Everything you need to start coaching.'),
                features: [
                  t('landing.pricing.free1', '1 team, up to 5 players'),
                  t('landing.pricing.free2', 'Assessments & performance charts'),
                  t('landing.pricing.free3', 'Injury, task & match tracking'),
                  t('landing.pricing.free4', 'Evidence-based scoring'),
                ],
                cta: t('landing.pricing.freeCta', 'Start Free'),
                highlight: false,
              },
              {
                name: t('landing.pricing.proName', 'Pro'),
                price: '$19',
                period: t('landing.pricing.perMonth', '/month'),
                desc: t('landing.pricing.proDesc', 'For coaches building serious programs.'),
                features: [
                  t('landing.pricing.pro1', 'Unlimited teams & players'),
                  t('landing.pricing.pro2', 'AI insights, nutrition & recovery plans'),
                  t('landing.pricing.pro3', 'AI task & goal suggestions'),
                  t('landing.pricing.pro4', 'PDF report export'),
                ],
                cta: t('landing.pricing.proCta', 'Go Pro'),
                highlight: true,
              },
              {
                name: t('landing.pricing.teamName', 'Team'),
                price: '$49',
                period: t('landing.pricing.perMonth', '/month'),
                desc: t('landing.pricing.teamDesc', 'For clubs and academies.'),
                features: [
                  t('landing.pricing.team1', 'Everything in Pro'),
                  t('landing.pricing.team2', 'Parent portal access'),
                  t('landing.pricing.team3', 'Assistant coach roles'),
                  t('landing.pricing.team4', 'Priority support'),
                ],
                cta: t('landing.pricing.teamCta', 'Choose Team'),
                highlight: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className={clsx(
                  'relative flex flex-col rounded-3xl p-8 border transition-all',
                  plan.highlight
                    ? 'bg-gradient-to-b from-indigo-600/20 to-purple-600/10 border-indigo-500/50 shadow-2xl shadow-indigo-500/10 md:-my-3 md:py-11'
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700',
                )}
              >
                {plan.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-bold shadow-lg">
                    {t('landing.pricing.popular', 'Most popular')}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2 mb-1">
                  <span className="text-5xl font-black text-white tabular-nums">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
                </div>
                <p className="text-sm text-gray-400 mb-6">{plan.desc}</p>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check size={15} className={clsx('flex-shrink-0 mt-0.5', plan.highlight ? 'text-indigo-400' : 'text-emerald-400')} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/login?tab=register')}
                  className={clsx(
                    'mt-8 w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer',
                    plan.highlight
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white',
                  )}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-10">
            {t('landing.pricing.athletesFree', 'Team athletes and solo athletes always train free — plans apply to coach accounts only.')}
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-4xl font-black tracking-tight mb-4">{t('landing.contact.titleA', 'Get in')} <span className="gradient-text">{t('landing.contact.titleB', 'Touch')}</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('landing.contact.subtitle', 'Have questions about ProTracker? Want to see a demo or discuss how it could work for your team? Reach out.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GitHub */}
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
              className="rounded-3xl bg-gray-900/60 border border-gray-800 p-8 flex flex-col"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <Code2 size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('landing.contact.sourceTitle', 'View Source Code')}</h3>
              <p className="text-gray-400 text-sm leading-relaxed flex-1">{t('landing.contact.sourceDesc', 'Explore the full codebase on GitHub.')}</p>
              <a
                href="https://github.com/MajdArow123/protracker"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                <Code2 size={16} /> {t('landing.contact.viewGithub', 'View on GitHub')}
              </a>
            </motion.div>

            {/* Live Demo */}
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-3xl bg-gradient-to-br from-indigo-600/15 to-purple-600/10 border border-indigo-500/25 p-8 flex flex-col"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-5">
                <Globe size={24} className="text-indigo-300" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('landing.contact.demoTitle', 'Try the Live Demo')}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{t('landing.contact.demoDesc', 'Log in as a coach or athlete and explore all features for free.')}</p>

              <div className="mt-4 rounded-xl bg-gray-950/50 border border-gray-800 p-3 text-xs">
                <p className="text-gray-500">{t('landing.contact.demoCoach', 'Coach')}: <span className="text-gray-300 font-mono" dir="ltr">coach.soccer@protracker.seed</span></p>
                <p className="text-gray-500 mt-1">{t('landing.contact.demoPassword', 'Password')}: <span className="text-gray-300 font-mono" dir="ltr">SeedCoach123!</span></p>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
              >
                <Globe size={16} /> {t('landing.contact.tryDemo', 'Try Demo')}
              </button>
            </motion.div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-10">
            {t('landing.contact.builtBy', 'Built by')} <a href="https://github.com/MajdArow123" target="_blank" rel="noopener noreferrer" className="text-gray-300 font-semibold hover:text-indigo-400 transition-colors">Majd Arow</a>
          </p>
        </div>
      </section>

      {/* Find a Coach */}
      <section className="py-24 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4">
              <Search size={13} /> {t('landing.findCoach.badge', 'Coach Marketplace')}
            </div>
            <h2 className="text-4xl font-black tracking-tight mb-4">{t('landing.findCoach.title', 'Find your perfect coach')}</h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              {t('landing.findCoach.subtitle', 'Browse verified coaches across 5 sports and connect with someone who matches your goals.')}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 mb-8">
              {sports.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/coaches?sport=${s.id}`)}
                  className={clsx('px-4 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105 cursor-pointer', sportBadge(s.name))}
                >
                  {L.sport(s.name)}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/coaches')}
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all hover:shadow-2xl hover:shadow-indigo-500/30 cursor-pointer"
            >
              {t('landing.findCoach.browseAll', 'Browse All Coaches')}
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="relative p-12 rounded-3xl bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-indigo-600/20 border border-indigo-500/20 overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-4xl font-black tracking-tight mb-4">{t('landing.cta.title', 'Ready to elevate your program?')}</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                {t('landing.cta.subtitle', "Start tracking, analyzing, and winning today. It's free to get started.")}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-105 cursor-pointer"
              >
                {t('landing.cta.button', 'Get Started Free')}
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 pt-14 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Activity size={17} className="text-white" />
                </div>
                <span className="text-lg font-bold text-white">ProTracker</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('landing.footer.tagline', 'Evidence-based sports performance for coaches, teams and solo athletes.')}
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{t('landing.footer.product', 'Product')}</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">{t('landing.nav.features', 'Features')}</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors cursor-pointer">{t('landing.nav.pricing', 'Pricing')}</button></li>
                <li><button onClick={() => navigate('/coaches')} className="hover:text-white transition-colors cursor-pointer">{t('landing.nav.findACoach', 'Find a Coach')}</button></li>
                <li><button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors cursor-pointer">{t('landing.nav.about', 'About')}</button></li>
              </ul>
            </div>

            {/* Get started */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{t('landing.footer.getStarted', 'Get Started')}</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><button onClick={() => navigate('/login?tab=register')} className="hover:text-white transition-colors cursor-pointer">{t('landing.roles.coach', "I'm a Coach")}</button></li>
                <li><button onClick={() => navigate('/register')} className="hover:text-white transition-colors cursor-pointer">{t('landing.roles.teamAthlete', "I'm on a Team")}</button></li>
                <li><button onClick={() => navigate('/register/solo')} className="hover:text-white transition-colors cursor-pointer">{t('landing.roles.soloAthlete', 'I Train Solo')}</button></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition-colors cursor-pointer">{t('landing.hero.signIn', 'Sign In')}</button></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{t('landing.footer.resources', 'Resources')}</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li>
                  <a href="https://github.com/MajdArow123/protracker" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    {t('landing.footer.sourceCode', 'Source Code')}
                  </a>
                </li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors cursor-pointer">{t('landing.nav.contact', 'Contact')}</button></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition-colors cursor-pointer">{t('landing.footer.liveDemo', 'Live Demo')}</button></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-800/70">
            <div className="text-sm text-gray-600">
              {t('landing.footer.copyright', 'Built with Claude AI · © 2026 ProTracker')}
            </div>
            <LanguageSwitcher variant="dark" />
          </div>
        </div>
      </footer>
    </div>
  );
}
