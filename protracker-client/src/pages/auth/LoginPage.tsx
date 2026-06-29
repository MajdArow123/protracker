import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter email and password'); return; }
    setError('');
    setIsLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'Coach' ? '/dashboard' : '/player-dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Left: branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-300 rounded-full blur-2xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
              <Activity size={21} className="text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">ProTracker</span>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight tracking-tight mb-4">
            The platform for<br />elite performance.
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Track, analyze, and improve every athlete on your roster with AI-powered insights.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-6 text-sm text-indigo-200">
          <span>Multi-Sport</span>
          <span>AI-Powered</span>
          <span>Real-time Analytics</span>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-8 transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} /> Back to home
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Activity size={18} className="text-white" />
              </div>
              <span className="text-lg font-black text-white tracking-tight">ProTracker</span>
            </div>

            <h1 className="text-2xl font-black text-white mb-1">Welcome back</h1>
            <p className="text-gray-400 text-sm mb-8">Sign in to your account to continue</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="coach@example.com"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer mt-2"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-600 mt-6">
              Professional Sports Performance Platform
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
