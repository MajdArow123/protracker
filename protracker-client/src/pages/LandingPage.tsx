import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, BarChart3, Brain, Salad, ShieldAlert, FileText,
  Trophy, Users, Zap, TrendingUp, Star, ChevronRight, Dumbbell,
  Target, Heart, CheckCircle,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const FEATURES = [
  { icon: Trophy, title: 'Multi-Sport Support', desc: 'Football, Basketball, Volleyball, Tennis and more — one platform for all your teams.', color: 'from-amber-500 to-orange-500' },
  { icon: BarChart3, title: 'Player Assessment Tracking', desc: 'Score every stat category per period. Visualize progress over time with beautiful charts.', color: 'from-indigo-500 to-blue-500' },
  { icon: Brain, title: 'AI-Powered Insights', desc: 'Claude AI generates personalized improvement plans and nutrition guidance in seconds.', color: 'from-purple-500 to-violet-500' },
  { icon: Salad, title: 'Nutrition Guidance', desc: 'Tailored meal plans and dietary profiles that respect every athlete\'s restrictions.', color: 'from-green-500 to-emerald-500' },
  { icon: ShieldAlert, title: 'Injury Management', desc: 'Track injuries, severity, and recovery status. Never lose sight of player availability.', color: 'from-red-500 to-rose-500' },
  { icon: FileText, title: 'Performance Reports', desc: 'Comprehensive PDF-ready reports for players and teams. Share with stakeholders easily.', color: 'from-cyan-500 to-teal-500' },
];

const SPORTS = [
  { icon: '⚽', name: 'Football', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  { icon: '🏀', name: 'Basketball', color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30' },
  { icon: '🏐', name: 'Volleyball', color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30' },
  { icon: '🏖', name: 'Beach Volleyball', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' },
  { icon: '🎾', name: 'Tennis', color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30' },
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

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gray-950/80 glass border-b border-gray-800/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={17} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">ProTracker</span>
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
      <section className="py-24">
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
              <span className="gradient-text">win</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              From player assessments to AI-generated nutrition plans — ProTracker has every tool a modern coach needs.
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
                <span className="text-2xl">{s.icon}</span>
                <span className="font-semibold text-white">{s.name}</span>
              </motion.div>
            ))}
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
              <a href="#" className="hover:text-white transition-colors cursor-pointer">Features</a>
              <a href="#" className="hover:text-white transition-colors cursor-pointer">About</a>
              <a href="#" className="hover:text-white transition-colors cursor-pointer">Contact</a>
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
