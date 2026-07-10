import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff,
  Lock, Mail, Phone, Plus, Ruler, Shield, Trash2, User, Users, Utensils, Weight, X,
} from 'lucide-react';
import { joinApi, type JoinCodeInfo, type DietaryRestrictionInput } from '../../api/joinApi';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { preloadDashboard } from '../../routes/lazyPages';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '../../utils/units';

// Same sport gradients used across the app (TeamsPage / TeamDetailPage).
const SPORT_GRADIENTS: Record<string, string> = {
  'Football / Soccer': 'from-green-600 via-emerald-600 to-green-700',
  Basketball: 'from-orange-500 via-orange-600 to-amber-600',
  'Volleyball Indoor': 'from-blue-600 via-blue-700 to-indigo-700',
  'Beach Volleyball': 'from-yellow-500 via-amber-500 to-orange-500',
  Tennis: 'from-purple-600 via-violet-600 to-purple-700',
};

const inputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 px-3.5 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';
const iconInputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';
const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5';

function passwordStrength(pw: string): { label: string; color: string; ok: boolean } {
  if (pw.length < 8) return { label: 'Weak', color: 'bg-red-500', ok: false };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: 'Strong', color: 'bg-green-500', ok: true };
  return { label: 'Fair', color: 'bg-amber-500', ok: false };
}

// UI labels → backend enum names.
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

const RELATIONSHIPS = ['Parent/Guardian', 'Sibling', 'Partner', 'Other'];

const STEP_TITLES = ['Team', 'Account', 'Profile', 'Diet', 'Emergency', 'Review'];

export function JoinTeamPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  const STEP_KEYS = ['stepTeam', 'stepAccount', 'stepProfile', 'stepDiet', 'stepEmergency', 'stepReview'];

  const [validating, setValidating] = useState(true);
  const [info, setInfo] = useState<JoinCodeInfo | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 2 — account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Step 3 — physical profile (canonical units: cm / kg)
  const [dob, setDob] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weightKg, setWeightKg] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [positionId, setPositionId] = useState<number | ''>('');
  const [jersey, setJersey] = useState('');
  const [phone, setPhone] = useState('');

  // Step 4 — dietary restrictions
  const [restrictions, setRestrictions] = useState<DietaryRestrictionInput[]>([]);
  const [rType, setRType] = useState<DietaryRestrictionInput['type']>('Allergy');
  const [rCategory, setRCategory] = useState('NutAllergy');
  const [rItem, setRItem] = useState('');
  const [rSeverity, setRSeverity] = useState<DietaryRestrictionInput['severity']>('Hard');

  // Step 5 — emergency contact
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelation, setEcRelation] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await joinApi.validateCode(code);
        if (!cancelled) setInfo(res);
      } catch {
        if (!cancelled) setInfo({ valid: false } as JoinCodeInfo);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

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

  const step2Ok = fullName.trim().length >= 2 && emailOk && strength.ok && password === confirm;
  const step3Ok = !!dob && age != null && age >= 5 && age <= 90
    && heightNum >= 80 && heightNum <= 250
    && weightNum >= 20 && weightNum <= 250
    && positionId !== '';

  const canNext = step === 1 || (step === 2 && step2Ok) || (step === 3 && step3Ok) || step === 4 || step === 5;

  const selectedPosition = info?.positions.find(p => p.id === positionId);
  const gradient = SPORT_GRADIENTS[info?.sport ?? ''] ?? 'from-indigo-600 to-violet-700';

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
    if (!info || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await joinApi.registerAthlete({
        code: info.code,
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        dateOfBirth: dob,
        height: Math.round(heightNum * 10) / 10,
        weight: Math.round(weightNum * 10) / 10,
        positionId: positionId as number,
        jerseyNumber: jersey ? parseInt(jersey, 10) : null,
        phone: phone.trim() || undefined,
        emergencyContactName: ecName.trim() || undefined,
        emergencyContactPhone: ecPhone.trim() || undefined,
        emergencyContactRelationship: ecRelation || undefined,
        dietaryRestrictions: restrictions,
        preferences: undefined,
      });
      // Welcome banner data for the athlete dashboard (read once, then cleared).
      sessionStorage.setItem('pt_welcome', JSON.stringify({ team: result.teamName, name: fullName.trim() }));
      await login(email.trim(), password);
      preloadDashboard('Athlete');
      navigate('/player-dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('register.registrationFailed', 'Could not complete registration.'));
      setSubmitting(false);
    }
  };

  // ── Loading / invalid code screens ─────────────────────────────────────────

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d12]">
        <Spinner />
      </div>
    );
  }

  if (!info?.valid) {
    const reasonText = info?.reason === 'expired' ? t('register.joinExpired', 'This join code has expired.')
      : info?.reason === 'maxed' ? t('register.joinMaxed', 'This join code has reached its maximum number of uses.')
      : info?.reason === 'inactive' ? t('register.joinInactive', 'This join code has been deactivated.')
      : t('register.joinInvalid', 'This join code is invalid.');
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
            <AlertCircle className="text-red-400" size={22} />
          </div>
          <h1 className="text-lg font-bold text-white mb-1">{t('register.codeNotValid', 'Code not valid')}</h1>
          <p className="text-sm text-gray-400 mb-6">{reasonText} {t('register.askCoachNewCode', 'Ask your coach for a new join code or link.')}</p>
          <div className="flex flex-col gap-2">
            <Link to="/register" className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors">{t('register.tryAnotherCode', 'Try another code')}</Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-1.5 text-sm text-indigo-400 hover:underline py-2">
              <ArrowLeft size={14} /> {t('register.backToSignIn', 'Back to sign in')}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0b0d12] flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
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
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${(step / 6) * 100}%` }} />
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
              {/* ── Step 1: Team preview ── */}
              {step === 1 && (
                <div>
                  <div className={clsx('bg-gradient-to-br p-6 sm:p-8', gradient)}>
                    <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mb-4">
                      <Users size={26} className="text-white" />
                    </div>
                    <p className="text-white/80 text-sm font-medium">{t('register.youreJoining', "You're joining")}</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{info.teamName}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{L.sport(info.sport)}</span>
                      <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{t('register.coachLabel', 'Coach')} {info.coachName}</span>
                    </div>
                  </div>
                  <div className="p-6 sm:p-8">
                    <p className="text-sm text-gray-400 mb-6">
                      {t('register.rosterIntroPre', 'Create your athlete account to appear on')} <span className="text-white font-semibold">{info.coachName}</span>{t('register.rosterIntroPost', "'s roster, track your assessments, tasks, nutrition and progress.")}
                    </p>
                    <button
                      onClick={() => setStep(2)}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {t('register.continueCreateAccount', 'Continue to create your account')} <ArrowRight size={16} />
                    </button>
                    <p className="text-center text-xs text-gray-500 mt-4">
                      {t('auth.hasAccount', 'Already have an account?')} <Link to="/login" className="text-indigo-400 hover:underline">{t('register.signInInstead', 'Sign in instead')}</Link>
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 2: Account ── */}
              {step === 2 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <h2 className="text-lg font-bold text-white">{t('auth.createAccount', 'Create your account')}</h2>
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
                </div>
              )}

              {/* ── Step 3: Physical profile ── */}
              {step === 3 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <h2 className="text-lg font-bold text-white">{t('register.athleteProfileTitle', 'Your athlete profile')}</h2>
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
                    <label className={labelCls}>{t('register.position', 'Position')} <span className="text-gray-600 normal-case">({L.sport(info.sport)})</span></label>
                    <div className="relative">
                      <select
                        value={positionId}
                        onChange={e => setPositionId(e.target.value ? Number(e.target.value) : '')}
                        className={clsx(inputCls, 'appearance-none cursor-pointer', positionId === '' && 'text-gray-500')}
                      >
                        <option value="">{t('register.choosePosition', 'Choose your position…')}</option>
                        {info.positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('register.jerseyNumber', 'Jersey #')} <span className="text-gray-600 normal-case">{t('register.optionalParen', '(optional)')}</span></label>
                      <input type="number" inputMode="numeric" min={0} max={999} value={jersey} onChange={e => setJersey(e.target.value)} placeholder="7" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('register.phone', 'Phone')} <span className="text-gray-600 normal-case">{t('register.optionalParen', '(optional)')}</span></label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('register.phonePlaceholder', '+1 555 123 4567')} className={iconInputCls.replace('pr-10', 'pr-3')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Dietary profile ── */}
              {step === 4 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <Utensils size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{t('register.dietaryTitle', 'Any dietary restrictions or allergies?')}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{t('register.dietarySubtitleCoach', 'Shared with your coach and used for AI nutrition planning. You can skip this.')}</p>
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

              {/* ── Step 5: Emergency contact ── */}
              {step === 5 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <Shield size={18} className="text-rose-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{t('register.emergencyContact', 'Emergency contact')}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{t('register.emergencySubtitle', 'Optional, but recommended — your coach can reach them if something happens at training.')}</p>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.contactName', 'Contact name')}</label>
                    <input value={ecName} onChange={e => setEcName(e.target.value)} placeholder={t('register.contactNamePlaceholder', 'e.g. Maria Smith')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.contactPhone', 'Contact phone')}</label>
                    <input type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder={t('register.contactPhonePlaceholder', '+1 555 987 6543')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.relationship', 'Relationship')}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {RELATIONSHIPS.map(rel => (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => setEcRelation(r => r === rel ? '' : rel)}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                            ecRelation === rel ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500',
                          )}
                        >
                          {t(`register.rel${rel.replace(/[^a-zA-Z]/g, '')}`, rel)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 6: Review & Join ── */}
              {step === 6 && (
                <div className="p-6 sm:p-8 space-y-4">
                  <h2 className="text-lg font-bold text-white">{t('register.reviewJoin', 'Review & join')}</h2>
                  <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
                    {[
                      [t('register.team', 'Team'), `${info.teamName} · ${L.sport(info.sport)}`],
                      [t('register.coach', 'Coach'), info.coachName],
                      [t('common.name', 'Name'), fullName],
                      [t('auth.email', 'Email'), email],
                      [t('register.dateOfBirth', 'Date of birth'), dob ? `${new Date(dob + 'T00:00:00').toLocaleDateString(L.locale, { year: 'numeric', month: 'short', day: 'numeric' })}${age != null ? ` (${age})` : ''}` : '—'],
                      [t('register.heightWeight', 'Height / Weight'), `${Math.round(heightNum)} cm · ${Math.round(weightNum)} kg`],
                      [t('register.position', 'Position'), selectedPosition?.name ?? '—'],
                      [t('register.jerseyNumber', 'Jersey #'), jersey || '—'],
                      [t('register.phone', 'Phone'), phone || '—'],
                      [t('register.dietaryRestrictions', 'Dietary restrictions'), restrictions.length > 0
                        ? restrictions.map(r => t(`register.rcat${r.category}`, RESTRICTION_CATEGORIES.find(c => c.value === r.category)?.label ?? r.category) + (r.specificItem ? ` (${r.specificItem})` : '')).join(', ')
                        : t('common.none', 'None')],
                      [t('register.emergencyContact', 'Emergency contact'), ecName ? `${ecName}${ecRelation ? ` (${ecRelation})` : ''}${ecPhone ? ` · ${ecPhone}` : ''}` : t('register.notSet', 'Not set')],
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
                    {submitting ? <>{t('register.creatingAccount', 'Creating your account…')}</> : <><Check size={16} /> {t('register.join', 'Join')} {info.teamName}</>}
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer nav (steps 2-5; step 1 and 6 have their own CTAs) */}
          {step >= 2 && step <= 5 && (
            <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4">
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft size={15} /> {t('common.back', 'Back')}
              </button>
              <div className="flex items-center gap-3">
                {(step === 4 || step === 5) && (
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
          {t('register.joiningAsCoach', 'Joining as a coach instead?')} <Link to="/login" className="text-indigo-400 hover:underline">{t('auth.signIn', 'Sign in')}</Link>
        </p>
      </div>
    </div>
  );
}
