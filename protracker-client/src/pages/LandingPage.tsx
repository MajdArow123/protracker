import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity, BarChart3, Brain, Salad, ShieldAlert,
  Trophy, Zap, TrendingUp, Star, ChevronRight, Dumbbell,
  Target, Heart, CheckCircle, Circle, CheckSquare, MessageSquare,
  CalendarDays, HeartPulse, Code2, Globe,
} from 'lucide-react';
import { CountUp } from '../components/ui/CountUp';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (i: any) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: (i ?? 0) * 0.1, ease: 'easeOut' },
  }),
};

const FEATURES = [
  { icon: Brain, title: 'AI-Powered Insights', desc: 'Generate personalized improvement plans, weekly nutrition schedules, and injury recovery programs using Claude AI. Get smart task suggestions based on each athlete\'s weak areas.', color: 'from-purple-500 to-violet-500' },
  { icon: BarChart3, title: 'Performance Analytics', desc: 'Track athlete assessments across multiple categories with gradient sliders. View trend charts, radar skill profiles, and compare progress over time.', color: 'from-indigo-500 to-blue-500' },
  { icon: ShieldAlert, title: 'Injury & Recovery Tracking', desc: 'Log injuries with severity levels and assign structured recovery programs. AI generates sport-specific rehab exercises week by week.', color: 'from-red-500 to-rose-500' },
  { icon: CheckSquare, title: 'Task Management', desc: 'Assign targeted training tasks to athletes with priority levels and due dates. AI suggests tasks based on assessment weak areas. Track completion rates.', color: 'from-cyan-500 to-teal-500' },
  { icon: MessageSquare, title: 'Direct Messaging', desc: 'Built-in coach-to-athlete messaging with real-time updates. Share notes privately or with the athlete. Keep communication organized.', color: 'from-blue-500 to-indigo-500' },
  { icon: Salad, title: 'Nutrition Planning', desc: 'Generate 7-day AI meal plans tailored to the athlete\'s sport, position, and dietary restrictions. Athletes can swap foods for nutritionally equivalent alternatives.', color: 'from-green-500 to-emerald-500' },
  { icon: CalendarDays, title: 'Training Scheduler', desc: 'Plan weekly training sessions with a calendar view. Athletes see upcoming sessions on their dashboard. Track session completion.', color: 'from-orange-500 to-amber-500' },
  { icon: Trophy, title: 'Match Results', desc: 'Log match scores with sport-aware formatting — sets for volleyball/tennis, points for basketball, goals for soccer. Rate individual player performance.', color: 'from-amber-500 to-yellow-500' },
  { icon: Dumbbell, title: 'Multi-Sport Support', desc: 'Built for Basketball, Soccer, Volleyball, Beach Volleyball, and Tennis. Sport-specific positions, stats, scoring, and color themes throughout.', color: 'from-fuchsia-500 to-pink-500' },
  { icon: HeartPulse, title: 'Wellbeing Check-ins', desc: 'Athletes submit daily check-ins rating their energy, sleep, and overall feeling. Coaches see trends and get alerts when athletes report pain during recovery.', color: 'from-rose-500 to-pink-500' },
];

const ABOUT_STATS = [
  { value: 5, suffix: '', label: 'Sports Supported' },
  { value: 10, suffix: '+', label: 'AI Features' },
  { value: 34, suffix: '', label: 'Backend Tests' },
  { value: 2026, suffix: '', label: 'Built in', countUp: false },
];

const TECH_STACK = [
  { group: 'Backend', items: ['ASP.NET Core 9', 'PostgreSQL', 'EF Core', 'JWT Auth'], color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
  { group: 'Frontend', items: ['React 19', 'TypeScript', 'Tailwind CSS', 'Recharts'], color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  { group: 'AI', items: ['Anthropic Claude API (Haiku + Sonnet)'], color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  { group: 'Hosting', items: ['Railway', 'Vercel'], color: 'text-green-300 bg-green-500/10 border-green-500/20' },
];

const NAV_LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

const SPORTS = [
  { icon: Target, name: 'Football', dot: 'bg-green-500', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  { icon: Circle, name: 'Basketball', dot: 'bg-orange-500', color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30' },
  { icon: Activity, name: 'Volleyball', dot: 'bg-blue-500', color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30' },
  { icon: Zap, name: 'Beach Volleyball', dot: 'bg-yellow-500', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' },
  { icon: TrendingUp, name: 'Tennis', dot: 'bg-purple-500', color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30' },
];

const STATS = [
  { value: '5', label: 'Sports Supported', icon: Trophy },
  { value: '100+', label: 'Stat Categories', icon: BarChart3 },
  { value: 'Real-time', label: 'Analytics', icon: Zap },
  { value: 'AI-Powered', label: 'Insights', icon: Brain },
];

const TESTIMONIALS = [
  {
    name: 'Marcus Johnson',
    role: 'Head Coach, City FC',
    sport: 'Football',
    quote: 'ProTracker completely changed how I manage my squad. The assessment tools and AI plans save me hours every week.',
    avatar: 'MJ',
    stars: 5,
  },
  {
    name: 'Sarah Williams',
    role: 'Performance Coach',
    sport: 'Basketball',
    quote: 'The nutrition tracking and injury management features are incredible. My athletes are performing at their peak.',
    avatar: 'SW',
    stars: 5,
  },
  {
    name: 'Carlos Rivera',
    role: 'Academy Director',
    sport: 'Tennis',
    quote: 'I\'ve tried many platforms, but nothing comes close to ProTracker\'s depth of analytics and ease of use.',
    avatar: 'CR',
    stars: 5,
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

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
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950/50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />

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
            Professional Sports Performance Platform
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-none mb-6"
          >
            Track. Analyze.
            <br />
            <span className="gradient-text">Dominate.</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10"
          >
            The professional sports analytics platform built for coaches who demand excellence.
            AI-powered insights, real-time tracking, and data-driven performance management.
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <button
              onClick={() => navigate('/login')}
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-105 cursor-pointer"
            >
              Get Started Free
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold text-lg transition-all cursor-pointer"
            >
              Sign In
            </button>
          </motion.div>

          <motion.div
            custom={4}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-gray-500"
          >
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> Free to start</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> AI-powered</span>
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
            Trusted by coaches worldwide
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
                <div className="text-3xl font-black text-white">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
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
              Everything you need to{' '}
              <span className="gradient-text">develop elite athletes</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              ProTracker combines AI, analytics, and communication tools into one platform built for modern sports teams.
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
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} mb-4 shadow-lg`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="py-20 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-black tracking-tight mb-3">Built for every sport</h2>
            <p className="text-gray-400">Sport-specific stat categories and position profiles for each discipline.</p>
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
                <span className="font-semibold text-white">{s.name}</span>
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
                About <span className="gradient-text">ProTracker</span>
              </h2>
              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>ProTracker is a full-stack sports performance platform designed for coaches and athletes who take performance seriously.</p>
                <p>Built with modern technology including ASP.NET Core 9, React, PostgreSQL, and the Anthropic Claude AI API, ProTracker gives coaches the tools they need to track, analyze, and improve athlete performance across 5 sports.</p>
                <p>From AI-generated nutrition plans to injury recovery programs, every feature is designed to save coaches time while giving athletes the personalized attention they need to reach their potential.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
                {ABOUT_STATS.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-gray-900/50 border border-gray-800 p-4 text-center">
                    <div className="text-2xl font-black text-white">
                      {s.countUp === false
                        ? <span>{s.value}{s.suffix}</span>
                        : <CountUp value={s.value} suffix={s.suffix} />}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — tech stack */}
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-3xl bg-gray-900/50 border border-gray-800 p-7"
            >
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6">Built with</h3>
              <div className="space-y-5">
                {TECH_STACK.map((t) => (
                  <div key={t.group}>
                    <p className="text-xs font-semibold text-gray-400 mb-2">{t.group}</p>
                    <div className="flex flex-wrap gap-2">
                      {t.items.map((it) => (
                        <span key={it} className={clsx('text-xs font-medium px-3 py-1.5 rounded-full border', t.color)}>{it}</span>
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
            <h2 className="text-3xl font-black tracking-tight mb-3">Coaches love ProTracker</h2>
            <p className="text-gray-400">Join hundreds of coaches already transforming their programs.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-gray-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role} · {t.sport}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 bg-gray-900/30 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-4xl font-black tracking-tight mb-4">Get in <span className="gradient-text">Touch</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Have questions about ProTracker? Want to see a demo or discuss how it could work for your team? Reach out.
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
              <h3 className="text-xl font-bold text-white mb-2">View Source Code</h3>
              <p className="text-gray-400 text-sm leading-relaxed flex-1">Explore the full codebase on GitHub.</p>
              <a
                href="https://github.com/MajdArow123/protracker"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                <Code2 size={16} /> View on GitHub
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
              <h3 className="text-xl font-bold text-white mb-2">Try the Live Demo</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Log in as a coach or athlete and explore all features for free.</p>

              <div className="mt-4 rounded-xl bg-gray-950/50 border border-gray-800 p-3 text-xs">
                <p className="text-gray-500">Coach: <span className="text-gray-300 font-mono">coach.soccer@protracker.seed</span></p>
                <p className="text-gray-500 mt-1">Password: <span className="text-gray-300 font-mono">SeedCoach123!</span></p>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
              >
                <Globe size={16} /> Try Demo
              </button>
            </motion.div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-10">
            Built by <a href="https://github.com/MajdArow123" target="_blank" rel="noopener noreferrer" className="text-gray-300 font-semibold hover:text-indigo-400 transition-colors">Majd Arow</a>
          </p>
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
              <h2 className="text-4xl font-black tracking-tight mb-4">Ready to elevate your program?</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                Start tracking, analyzing, and winning today. It's free to get started.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-105 cursor-pointer"
              >
                Get Started Free
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Activity size={15} className="text-white" />
              </div>
              <span className="font-bold text-white">ProTracker</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              {NAV_LINKS.map((l) => (
                <button key={l.id} onClick={() => scrollToSection(l.id)} className="hover:text-white transition-colors cursor-pointer">{l.label}</button>
              ))}
            </div>
            <div className="text-sm text-gray-600">
              Built with Claude AI · © 2026 ProTracker
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
