import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff,
  Lock, Mail, Plus, Ruler, Sparkles, Target, Trash2, User, Utensils, Weight, X,
} from 'lucide-react';
import { soloApi, type SoloSportOption, type SkillLevel, type TrainingFrequency } from '../../api/soloApi';
import type { DietaryRestrictionInput } from '../../api/joinApi';
import { useAuth } from '../../context/useAuth';
import { Spinner } from '../../components/ui/Spinner';
import { preloadDashboard } from '../../routes/lazyPages';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '../../utils/units';

// Visuals per sport id (names come from the API; ids are stable seed data).
const SPORT_META: Record<number, { emoji: string; gradient: string; ring: string }> = {
  1: { emoji: '⚽', gradient: 'from-green-600 via-emerald-600 to-green-700', ring: 'ring-green-500 border-green-500' },
  2: { emoji: '🏀', gradient: 'from-orange-500 via-orange-600 to-amber-600', ring: 'ring-orange-500 border-orange-500' },
  3: { emoji: '🏐', gradient: 'from-blue-600 via-blue-700 to-indigo-700', ring: 'ring-blue-500 border-blue-500' },
  4: { emoji: '🏖️', gradient: 'from-yellow-500 via-amber-500 to-orange-500', ring: 'ring-amber-500 border-amber-500' },
  5: { emoji: '🎾', gradient: 'from-purple-600 via-violet-600 to-purple-700', ring: 'ring-purple-500 border-purple-500' },
};
const FALLBACK_META = { emoji: '🏅', gradient: 'from-indigo-600 to-violet-700', ring: 'ring-indigo-500 border-indigo-500' };

const SKILL_LEVELS: { value: SkillLevel; label: string; desc: string }[] = [
  { value: 'Beginner', label: 'Beginner', desc: 'Just starting out, learning the basics' },
  { value: 'Intermediate', label: 'Intermediate', desc: 'Playing regularly, improving skills' },
  { value: 'Advanced', label: 'Advanced', desc: 'Competitive player, serious training' },
  { value: 'Elite', label: 'Elite', desc: 'Professional or semi-professional level' },
];

const FREQUENCIES: { value: TrainingFrequency; label: string }[] = [
  { value: 'Daily', label: 'Daily' },
  { value: 'FewTimesWeek', label: 'A few times a week' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Occasionally', label: 'Occasionally' },
];

const inputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 px-3.5 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';
const iconInputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';
const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5';

function passwordStrength(pw: string): { label: string; color: string; ok: boolean } {
  if (pw.length < 8) return { label: 'Weak', color: 'bg-red-500', ok: false };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: 'Strong', color: 'bg-green-500', ok: true };
  return { label: 'Fair', color: 'bg-amber-500', ok: false };
}

// UI labels → backend enum names (same set as the join-team wizard).
const RESTRICTION_TYPES = [
  { value: 'Allergy', label: 'Allergy' },
  { value: 'Lifestyle', label: 'Lifestyle' },
  { value: 'SoftPreference', label: 'Preference' },
] as const;

const RESTRICTION_CATEGORIES = [
  { value: 'NutAllergy', label: 'Nuts' },
  { value: 'DairyFree', label: 'Dairy' },
  { value: 'GlutenFree', label: 'Gluten' },
  { value: 'Halal', label: 'Halal' },
  { value: 'Vegan', label: 'Vegan' },
  { value: 'Vegetarian', label: 'Vegetarian' },
  { value: 'Custom', label: 'Custom' },
] as const;

const RESTRICTION_SEVERITIES = [
  { value: 'Hard', label: 'Hard' },
  { value: 'Lifestyle', label: 'Moderate' },
  { value: 'Soft', label: 'Soft' },
] as const;

const STEP_TITLES = ['Account', 'Sport', 'Level', 'Body', 'Goals', 'Diet', 'Start'];

export function SoloRegisterPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const navigate = useNavigate();
  const { login } = useAuth();

  const STEP_KEYS = ['stepAccount', 'stepSport', 'stepLevel', 'stepBody', 'stepGoals', 'stepDiet', 'stepStart'];

  const [sports, setSports] = useState<SoloSportOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Step 2 — sport
  const [sportId, setSportId] = useState<number | null>(null);

  // Step 3 — position & level
  const [positionId, setPositionId] = useState<number | ''>('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [frequency, setFrequency] = useState<TrainingFrequency | null>(null);

  // Step 4 — physical profile (canonical units: cm / kg)
  const [dob, setDob] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weightKg, setWeightKg] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [jersey, setJersey] = useState('');

  // Step 5 — goals (optional)
  const [goals, setGoals] = useState('');
  const [motivation, setMotivation] = useState('');

  // Step 6 — dietary restrictions (optional)
  const [restrictions, setRestrictions] = useState<DietaryRestrictionInput[]>([]);
  const [rType, setRType] = useState<DietaryRestrictionInput['type']>('Allergy');
  const [rCategory, setRCategory] = useState('NutAllergy');
  const [rItem, setRItem] = useState('');
  const [rSeverity, setRSeverity] = useState<DietaryRestrictionInput['severity']>('Hard');

  useEffect(() => {
    let cancelled = false;
    soloApi.getSports()
      .then(s => { if (!cancelled) setSports(s); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  const strength = passwordStrength(password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const effHeightCm = heightUnit === 'cm' ? heightCm : ftInToCm(heightFt, heightIn);
  const effWeightKg = weightUnit === 'kg' ? weightKg : lbToKg(weightLb);
  const heightNum = parseFloat(effHeightCm);
  const weightNum = parseFloat(effWeightKg);

  const age = useMemo(() => {
    if (!dob) return null;
    const d = new Date(dob);
    const today = new Date();
    let a = today.getFullYear() - d.getFullYear();
    if (today < new Date(today.getFullYear(), d.getMonth(), d.getDate())) a--;
    return Number.isFinite(a) ? a : null;
  }, [dob]);

  const selectedSport = sports?.find(s => s.id === sportId) ?? null;
  const selectedPosition = selectedSport?.positions.find(p => p.id === positionId);
  const meta = sportId != null ? (SPORT_META[sportId] ?? FALLBACK_META) : FALLBACK_META;

  const step1Ok = fullName.trim().length >= 2 && emailOk && strength.ok && password === confirm;
  const step2Ok = sportId != null;
  const step3Ok = positionId !== '' && skillLevel != null && frequency != null;
  const step4Ok = !!dob && age != null && age >= 5 && age <= 90
    && heightNum >= 80 && heightNum <= 250
    && weightNum >= 20 && weightNum <= 250;

  const canNext = (step === 1 && step1Ok) || (step === 2 && step2Ok)
    || (step === 3 && step3Ok) || (step === 4 && step4Ok) || step === 5 || step === 6;

  const pickSport = (id: number) => {
    if (id !== sportId) setPositionId(''); // positions are sport-specific
    setSportId(id);
  };

  const addRestriction = () => {
    if (rCategory === 'Custom' && !rItem.trim()) return;
    setRestrictions(rs => [...rs, {
      type: rType,
      category: rCategory,
      specificItem: rItem.trim() || undefined,
      severity: rSeverity,
    }]);
    setRItem('');
  };

  const handleSubmit = async () => {
    if (!sportId || !skillLevel || !frequency || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await soloApi.registerSolo({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        dateOfBirth: dob,
        height: Math.round(heightNum * 10) / 10,
        weight: Math.round(weightNum * 10) / 10,
        sportId,
        positionId: positionId as number,
        skillLevel,
        trainingFrequency: frequency,
        jerseyNumber: jersey ? parseInt(jersey, 10) : null,
        goals: goals.trim() || undefined,
        motivation: motivation.trim() || undefined,
        dietaryRestrictions: restrictions,
      });
      // Welcome banner data for the solo dashboard (read once, then cleared).
      sessionStorage.setItem('pt_welcome_solo', JSON.stringify({ name: fullName.trim(), sport: result.sportName }));
      await login(email.trim(), password);
      preloadDashboard('SoloAthlete');
      navigate('/solo-dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('register.registrationFailed', 'Could not complete registration.'));
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/70 p-8 text-center">
          <AlertCircle className="mx-auto text-red-400 mb-3" size={24} />
          <p className="text-sm text-gray-300">{t('register.sportsLoadError', "Couldn't load the sports list. Check your connection and try again.")}</p>
          <Link to="/" className="inline-block mt-4 text-sm text-indigo-400 hover:underline">{t('register.backHome', 'Back home')}</Link>
        </div>
      </div>
    );
  }

  if (!sports) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d12]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Activity size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wide">
            {t('register.soloMode', 'Solo mode')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEP_TITLES.map((title, i) => (
              <span key={title} className={clsx('text-[10px] font-semibold uppercase tracking-wide', i + 1 <= step ? 'text-indigo-400' : 'text-gray-600')}>
                {t(`register.${STEP_KEYS[i]}`, title)}
              </span>
            ))}
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${(step / 7) * 100}%` }} />
          </div>
        </div>

        <motion.div layout className="rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur overflow-hidden shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
            >
              {/* ── Step 1: Account ── */}
              {step === 1 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{t('register.soloAccountTitle', 'Track your sports performance solo')}</h2>
                    <p className="text-xs text-gray-400 mt-1">{t('register.soloAccountSubtitle', "No coach, no team required — you're in charge of your own progress.")}</p>
                  </div>
                  <div>
                    <label className={labelCls}>{t('auth.fullName', 'Full name')}</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('register.namePlaceholder', 'e.g. Jordan Smith')} className={iconInputCls} autoFocus />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('auth.email', 'Email')}</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('register.emailPlaceholder', 'you@example.com')} className={iconInputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('auth.password', 'Password')}</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={t('register.createPasswordPlaceholder', 'Create a password')} className={iconInputCls} />
                      <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div className={clsx('h-full transition-all', strength.color)} style={{ width: strength.ok ? '100%' : password.length >= 8 ? '66%' : '33%' }} />
                        </div>
                        <span className="text-[11px] text-gray-400">{t(strength.ok ? 'auth.strong' : password.length >= 8 ? 'auth.fair' : 'auth.weak', strength.label)}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1.5">{t('auth.passwordHint', 'At least 8 characters, with an uppercase letter and a number.')}</p>
                  </div>
                  <div>
                    <label className={labelCls}>{t('auth.confirmPassword', 'Confirm password')}</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('register.repeatPasswordPlaceholder', 'Repeat your password')} className={iconInputCls} />
                    </div>
                    {confirm.length > 0 && password !== confirm && (
                      <p className="text-[11px] text-red-400 mt-1.5">{t('auth.passwordsNoMatch', "Passwords don't match.")}</p>
                    )}
                  </div>
                  <p className="text-center text-xs text-gray-500">
                    {t('auth.hasAccount', 'Already have an account?')} <Link to="/login" className="text-indigo-400 hover:underline">{t('register.signInInstead', 'Sign in instead')}</Link>
                  </p>
                </div>
              )}

              {/* ── Step 2: Sport ── */}
              {step === 2 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{t('register.sportQuestion', 'What sport do you play?')}</h2>
                    <p className="text-xs text-gray-400 mt-1">{t('register.sportSubtitle', 'Your assessments, stats and AI plans are tailored to your sport.')}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sports.map(s => {
                      const m = SPORT_META[s.id] ?? FALLBACK_META;
                      const active = sportId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => pickSport(s.id)}
                          className={clsx(
                            'relative rounded-2xl border p-4 text-left transition-all cursor-pointer overflow-hidden group',
                            active ? clsx('ring-2', m.ring, 'bg-gray-800/80') : 'border-gray-700 bg-gray-800/40 hover:border-gray-500',
                          )}
                        >
                          <div className={clsx('absolute inset-0 opacity-0 transition-opacity bg-gradient-to-br', m.gradient, active ? 'opacity-15' : 'group-hover:opacity-[0.07]')} />
                          <div className="relative flex items-center gap-3">
                            <span className="text-3xl">{m.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white">{L.sport(s.name)}</p>
                              <p className="text-[11px] text-gray-500">{t('register.positionsCount', '{{count}} positions', { count: s.positions.length })}</p>
                            </div>
                            {active && (
                              <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                <Check size={13} className="text-white" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 3: Position & level ── */}
              {step === 3 && (
                <div className="p-6 sm:p-8 space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-white">{t('register.positionLevelTitle', 'Your position & level')}</h2>
                    <p className="text-xs text-gray-400 mt-1">{selectedSport ? `${meta.emoji} ${L.sport(selectedSport.name)}` : ''}</p>
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.position', 'Position')}</label>
                    <div className="relative">
                      <select
                        value={positionId}
                        onChange={e => setPositionId(e.target.value ? Number(e.target.value) : '')}
                        className={clsx(inputCls, 'appearance-none cursor-pointer', positionId === '' && 'text-gray-500')}
                      >
                        <option value="">{t('register.choosePosition', 'Choose your position…')}</option>
                        {selectedSport?.positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.skillLevel', 'Skill level')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {SKILL_LEVELS.map(l => (
                        <button
                          key={l.value}
                          type="button"
                          onClick={() => setSkillLevel(l.value)}
                          className={clsx(
                            'rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                            skillLevel === l.value
                              ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-600/10'
                              : 'border-gray-700 bg-gray-800/40 hover:border-gray-500',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{t(`register.skill${l.value}`, l.label)}</span>
                            {skillLevel === l.value && <Check size={14} className="text-indigo-400" />}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1 leading-snug">{t(`register.skill${l.value}Desc`, l.desc)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.trainFrequencyQuestion', 'How often do you train?')}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {FREQUENCIES.map(f => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setFrequency(f.value)}
                          className={clsx(
                            'px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                            frequency === f.value
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500',
                          )}
                        >
                          {t(`register.freq${f.value}`, f.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Physical profile ── */}
              {step === 4 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <h2 className="text-lg font-bold text-white">{t('register.physicalProfileTitle', 'Your physical profile')}</h2>
                  <div>
                    <label className={labelCls}>{t('register.dateOfBirth', 'Date of birth')}</label>
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className={clsx(inputCls, 'scheme-dark')} />
                    {age != null && age >= 5 && age <= 90 && <p className="text-[11px] text-gray-500 mt-1.5">{t('register.yearsOld', '{{count}} years old', { count: age })}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('register.height', 'Height')}</label>
                        <div className="flex rounded-lg bg-gray-800 p-0.5">
                          {(['cm', 'ftin'] as const).map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => {
                                if (u === heightUnit) return;
                                if (u === 'ftin' && heightCm) {
                                  const { ft, inches } = cmToFtIn(heightCm);
                                  setHeightFt(ft); setHeightIn(inches);
                                } else if (u === 'cm' && (heightFt || heightIn)) {
                                  setHeightCm(ftInToCm(heightFt, heightIn));
                                }
                                setHeightUnit(u);
                              }}
                              className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors', heightUnit === u ? 'bg-indigo-600 text-white' : 'text-gray-400')}
                            >
                              {u === 'cm' ? 'cm' : 'ft/in'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {heightUnit === 'cm' ? (
                        <div className="relative">
                          <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" className={iconInputCls.replace('pr-10', 'pr-3')} />
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input type="number" inputMode="numeric" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5" className={inputCls} aria-label={t('register.feet', 'feet')} />
                          <input type="number" inputMode="numeric" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="9" className={inputCls} aria-label={t('register.inches', 'inches')} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('register.weight', 'Weight')}</label>
                        <div className="flex rounded-lg bg-gray-800 p-0.5">
                          {(['kg', 'lb'] as const).map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => {
                                if (u === weightUnit) return;
                                if (u === 'lb' && weightKg) setWeightLb(kgToLb(weightKg));
                                else if (u === 'kg' && weightLb) setWeightKg(lbToKg(weightLb));
                                setWeightUnit(u);
                              }}
                              className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors', weightUnit === u ? 'bg-indigo-600 text-white' : 'text-gray-400')}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <Weight size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        {weightUnit === 'kg' ? (
                          <input type="number" inputMode="decimal" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70" className={iconInputCls.replace('pr-10', 'pr-3')} />
                        ) : (
                          <input type="number" inputMode="decimal" value={weightLb} onChange={e => setWeightLb(e.target.value)} placeholder="155" className={iconInputCls.replace('pr-10', 'pr-3')} />
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.jerseyNumber', 'Jersey #')} <span className="text-gray-600 normal-case">{t('register.optionalParen', '(optional)')}</span></label>
                    <input type="number" inputMode="numeric" min={0} max={999} value={jersey} onChange={e => setJersey(e.target.value)} placeholder="23" className={inputCls} />
                  </div>
                </div>
              )}

              {/* ── Step 5: Goals (optional) ── */}
              {step === 5 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                      <Target size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{t('register.goalsTitle', 'Your goals')}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{t('register.goalsSubtitle', 'Optional — used to personalize your AI training and nutrition plans.')}</p>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.improveQuestion', 'What do you want to improve?')}</label>
                    <textarea
                      value={goals}
                      onChange={e => setGoals(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder={t('register.goalsPlaceholder', 'e.g. "Improve my shooting accuracy and build more stamina for full matches"')}
                      className={clsx(inputCls, 'resize-none')}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.motivationQuestion', 'What motivates you?')} <span className="text-gray-600 normal-case">{t('register.optionalParen', '(optional)')}</span></label>
                    <textarea
                      value={motivation}
                      onChange={e => setMotivation(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder={t('register.motivationPlaceholder', 'e.g. I want to make the varsity team next season')}
                      className={clsx(inputCls, 'resize-none')}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 6: Dietary restrictions (optional) ── */}
              {step === 6 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <Utensils size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{t('register.dietaryTitle', 'Any dietary restrictions or allergies?')}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{t('register.dietarySubtitleSolo', 'Used for your AI nutrition planning. You can skip this.')}</p>
                    </div>
                  </div>

                  {restrictions.length > 0 && (
                    <div className="space-y-2">
                      {restrictions.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-800/60 border border-gray-700 px-3 py-2.5">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold',
                            r.severity === 'Hard' ? 'bg-red-500/15 text-red-400' : r.severity === 'Lifestyle' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400',
                          )}>
                            {t(`register.rsev${r.severity}`, RESTRICTION_SEVERITIES.find(s => s.value === r.severity)?.label ?? r.severity)}
                          </span>
                          <span className="text-sm text-white font-medium flex-1 truncate">
                            {t(`register.rcat${r.category}`, RESTRICTION_CATEGORIES.find(c => c.value === r.category)?.label ?? r.category)}
                            {r.specificItem ? ` · ${r.specificItem}` : ''}
                          </span>
                          <span className="text-[10px] text-gray-500">{t(`register.rtype${r.type}`, RESTRICTION_TYPES.find(rt => rt.value === r.type)?.label ?? r.type)}</span>
                          <button onClick={() => setRestrictions(rs => rs.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 cursor-pointer p-0.5">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>{t('common.type', 'Type')}</label>
                        <div className="relative">
                          <select value={rType} onChange={e => setRType(e.target.value as DietaryRestrictionInput['type'])} className={clsx(inputCls, 'appearance-none cursor-pointer')}>
                            {RESTRICTION_TYPES.map(opt => <option key={opt.value} value={opt.value}>{t(`register.rtype${opt.value}`, opt.label)}</option>)}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>{t('register.severity', 'Severity')}</label>
                        <div className="relative">
                          <select value={rSeverity} onChange={e => setRSeverity(e.target.value as DietaryRestrictionInput['severity'])} className={clsx(inputCls, 'appearance-none cursor-pointer')}>
                            {RESTRICTION_SEVERITIES.map(s => <option key={s.value} value={s.value}>{t(`register.rsev${s.value}`, s.label)}</option>)}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('common.category', 'Category')}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {RESTRICTION_CATEGORIES.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setRCategory(c.value)}
                            className={clsx(
                              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                              rCategory === c.value
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500',
                            )}
                          >
                            {t(`register.rcat${c.value}`, c.label)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('register.specificItem', 'Specific item')} {rCategory === 'Custom' ? '' : t('register.optionalParen', '(optional)')}</label>
                      <input value={rItem} onChange={e => setRItem(e.target.value)} placeholder={rCategory === 'Custom' ? t('register.itemPlaceholderShellfish', 'e.g. shellfish') : t('register.itemPlaceholderPeanuts', 'e.g. peanuts')} className={inputCls} />
                    </div>
                    <button
                      type="button"
                      onClick={addRestriction}
                      disabled={rCategory === 'Custom' && !rItem.trim()}
                      className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} /> {t('register.addRestriction', 'Add restriction')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 7: Review & start ── */}
              {step === 7 && (
                <div>
                  <div className={clsx('bg-gradient-to-br p-6 sm:p-8', meta.gradient)}>
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{meta.emoji}</span>
                      <div>
                        <p className="text-white/80 text-sm font-medium">{t('register.readyToTrainSolo', 'Ready to train solo')}</p>
                        <h2 className="text-2xl font-black text-white tracking-tight">{fullName || t('register.yourAccount', 'Your account')}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{L.sport(selectedSport?.name)}</span>
                          {skillLevel && <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{t(`register.skill${skillLevel}`, skillLevel)}</span>}
                          {frequency && <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{t(`register.freq${frequency}`, FREQUENCIES.find(f => f.value === frequency)?.label ?? frequency)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 sm:p-8 space-y-4">
                    <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
                      {[
                        [t('auth.email', 'Email'), email],
                        [t('register.dateOfBirth', 'Date of birth'), dob ? `${new Date(dob + 'T00:00:00').toLocaleDateString(L.locale, { year: 'numeric', month: 'short', day: 'numeric' })}${age != null ? ` (${age})` : ''}` : '—'],
                        [t('register.heightWeight', 'Height / Weight'), `${Math.round(heightNum)} cm · ${Math.round(weightNum)} kg`],
                        [t('register.position', 'Position'), selectedPosition?.name ?? '—'],
                        [t('register.jerseyNumber', 'Jersey #'), jersey || '—'],
                        [t('register.goals', 'Goals'), goals.trim() || t('register.notSet', 'Not set')],
                        [t('register.dietaryRestrictions', 'Dietary restrictions'), restrictions.length > 0
                          ? restrictions.map(r => t(`register.rcat${r.category}`, RESTRICTION_CATEGORIES.find(c => c.value === r.category)?.label ?? r.category) + (r.specificItem ? ` (${r.specificItem})` : '')).join(', ')
                          : t('common.none', 'None')],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5 bg-gray-950/40">
                          <span className="text-xs text-gray-500 font-medium pt-0.5 flex-shrink-0">{label}</span>
                          <span className="text-sm text-white text-right">{value}</span>
                        </div>
                      ))}
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-2.5">
                        <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-300">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submitting ? <>{t('register.creatingAccount', 'Creating your account…')}</> : <><Sparkles size={16} /> {t('register.startTrainingSolo', 'Start Training Solo')}</>}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer nav (steps 1-6; step 7 has its own CTA) */}
          {step <= 6 && (
            <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4">
              {step > 1 ? (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft size={15} /> {t('common.back', 'Back')}
                </button>
              ) : (
                <Link to="/register" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white font-medium transition-colors">
                  <ArrowLeft size={15} /> {t('common.back', 'Back')}
                </Link>
              )}
              <div className="flex items-center gap-3">
                {(step === 5 || step === 6) && (
                  <button
                    onClick={() => setStep(s => s + 1)}
                    className="text-sm text-gray-500 hover:text-gray-300 font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {t('register.skipForNow', 'Skip for now')} <X size={13} />
                  </button>
                )}
                <button
                  onClick={() => canNext && setStep(s => s + 1)}
                  disabled={!canNext}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {t('common.next', 'Next')} <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <p className="text-center text-xs text-gray-600 mt-5">
          {t('register.haveTeamCode', 'Have a team join code instead?')} <Link to="/register" className="text-indigo-400 hover:underline">{t('register.joinYourTeam', 'Join your team')}</Link>
        </p>
      </div>
    </div>
  );
}
