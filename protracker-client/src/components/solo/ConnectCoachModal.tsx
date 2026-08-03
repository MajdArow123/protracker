import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, ArrowRight, Check, Search, Shield, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { joinApi, type JoinCodeInfo } from '../../api/joinApi';
import { soloApi } from '../../api/soloApi';
import { tokenStorage } from '../../api/axiosInstance';
import { useSoloProfile } from '../../hooks/useSolo';
import { useAuth } from '../../context/useAuth';

// Same sport gradients used across the app.
const SPORT_GRADIENTS: Record<string, string> = {
  'Football / Soccer': 'from-green-600 via-emerald-600 to-green-700',
  Basketball: 'from-orange-500 via-orange-600 to-amber-600',
  'Volleyball Indoor': 'from-blue-600 via-blue-700 to-indigo-700',
  'Beach Volleyball': 'from-yellow-500 via-amber-500 to-orange-500',
  Tennis: 'from-purple-600 via-violet-600 to-purple-700',
};

// A solo athlete joins a coach's team with a join code. Their role flips to Athlete
// and every bit of history (assessments, plans, tasks, matches…) stays on their
// player record — the coach can see it all from day one.
export function ConnectCoachModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: soloProfile } = useSoloProfile();

  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<JoinCodeInfo | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (isOpen) { setCode(''); setInfo(null); setError(''); setChecking(false); setJoining(false); }
  }, [isOpen]);

  const sportMismatch = !!info?.valid && !!soloProfile?.sportName && info.sport !== soloProfile.sportName;

  async function findTeam() {
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4 || checking) return;
    setError('');
    setInfo(null);
    setChecking(true);
    try {
      const res = await joinApi.validateCode(normalized);
      if (res.valid) {
        setInfo(res);
      } else {
        setError(
          res.reason === 'expired' ? 'That code has expired. Ask the coach for a new one.'
          : res.reason === 'maxed' ? 'That code has reached its maximum uses.'
          : res.reason === 'inactive' ? 'That code has been deactivated.'
          : "We couldn't find that code. Double-check it and try again.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the code. Try again.');
    } finally {
      setChecking(false);
    }
  }

  async function join() {
    if (!info?.valid || joining) return;
    setError('');
    setJoining(true);
    try {
      const result = await soloApi.connectCoach(info.code);
      // The role changed (SoloAthlete → Athlete), so the backend issued fresh tokens.
      tokenStorage.setAccess(result.accessToken);
      tokenStorage.setRefresh(result.refreshToken);
      // Welcome banner for the athlete dashboard (same one the join wizard uses).
      sessionStorage.setItem('pt_welcome', JSON.stringify({ team: result.teamName, name: user?.fullName ?? '' }));
      // Full reload: re-bootstraps auth with the new role and drops every solo-scoped cache.
      window.location.assign('/player-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the team. Try again.');
      setJoining(false);
    }
  }

  const gradient = SPORT_GRADIENTS[info?.sport ?? ''] ?? 'from-indigo-600 to-violet-700';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join a Team">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter a join code from a coach. Your assessments, plans, matches and tasks all
          come with you — your coach will see your full history.
        </p>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); setInfo(null); }}
            onKeyDown={e => { if (e.key === 'Enter') findTeam(); }}
            placeholder="e.g. CITY2026"
            maxLength={12}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-center text-lg font-black tracking-[0.25em] text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-sm placeholder:font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all uppercase"
          />
          <Button onClick={findTeam} isLoading={checking} disabled={code.trim().length < 4}>
            <Search size={15} /> Find Team
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-900/40 p-3">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {info?.valid && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className={clsx('bg-gradient-to-br p-5 text-white', gradient)}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-medium">You'd be joining</p>
                  <p className="text-xl font-black tracking-tight leading-tight">{info.teamName}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-semibold">{info.sport}</span>
                <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-semibold">Coach {info.coachName}</span>
              </div>
            </div>
            <div className="p-4 space-y-3 bg-white dark:bg-gray-900">
              {sportMismatch ? (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/40 p-3">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This team plays <strong>{info.sport}</strong>, but your solo profile is{' '}
                    <strong>{soloProfile?.sportName}</strong>. You can only join a team in your own sport.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Shield size={13} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  <p>
                    After joining, <strong className="text-gray-700 dark:text-gray-300">Coach {info.coachName}</strong> manages
                    your assessments and training. All your solo history is preserved.
                  </p>
                </div>
              )}
              <Button onClick={join} isLoading={joining} disabled={sportMismatch} className="w-full justify-center">
                {joining ? 'Joining…' : <><Check size={15} /> Join {info.teamName}</>}
              </Button>
            </div>
          </div>
        )}

        {!info?.valid && !error && (
          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <ArrowRight size={12} /> Ask the coach for their team's join code or QR poster.
          </p>
        )}
      </div>
    </Modal>
  );
}
