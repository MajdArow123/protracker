import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity, Mail, Edit2, Loader2, X, TrendingUp, ShieldAlert, Salad, HeartPulse,
  Phone, Users, Hash, Plus, Trash2, ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useMyPlayerId, usePlayerDashboard } from '../../hooks/useDashboard';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { usePlayerNutritionProfile, useCreateProfileItem, useDeleteProfileItem } from '../../hooks/useNutrition';
import { useToast } from '../../context/ToastContext';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { EditableAvatar } from '../../components/profile/ProfileAvatar';
import { ProfileCompletionCard } from '../../components/profile/ProfileCompletionCard';
import { AccountSettingsSection } from '../../components/profile/AccountSettingsSection';
import { computeProfileCompletion } from '../../utils/profileCompletion';
import {
  cmToFtIn, ftInToCm, kgToLb, lbToKg, formatHeight, formatWeight,
  getStoredHeightUnit, getStoredWeightUnit,
} from '../../utils/units';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.08 },
  }),
};

const SEVERITY_STYLES: Record<string, string> = {
  Hard: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Lifestyle: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Soft: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

const RESTRICTION_CATEGORIES = ['NutAllergy', 'DairyFree', 'GlutenFree', 'Halal', 'Kosher', 'Vegan', 'Vegetarian', 'NoEggs', 'NoFish', 'NoRedMeat', 'Custom'];
const CATEGORY_LABELS: Record<string, string> = {
  NutAllergy: 'Nuts', DairyFree: 'Dairy', GlutenFree: 'Gluten', NoEggs: 'No Eggs',
  NoFish: 'No Fish', NoRedMeat: 'No Red Meat',
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

function fitnessLabel(l: number | null | undefined) {
  if (!l) return 'Unknown';
  if (l <= 3) return 'Beginner';
  if (l <= 6) return 'Intermediate';
  if (l <= 8) return 'Advanced';
  return 'Elite';
}

function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const today = new Date();
  let a = today.getFullYear() - d.getFullYear();
  if (today < new Date(today.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

export function AthleteProfilePage() {
  const { addToast } = useToast();
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: dashData } = usePlayerDashboard(playerId);
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: dietaryItems = [] } = usePlayerNutritionProfile(playerId ?? 0);
  const createRestriction = useCreateProfileItem(playerId ?? 0);
  const deleteRestriction = useDeleteProfileItem(playerId ?? 0);
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: '', phoneNumber: '', bio: '', dateOfBirth: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
    jerseyNumber: '',
  });
  const [heightUnit, setHeightUnit] = useState(getStoredHeightUnit());
  const [weightUnit, setWeightUnit] = useState(getStoredWeightUnit());
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightVal, setWeightVal] = useState(''); // in the selected unit

  const [showAddRestriction, setShowAddRestriction] = useState(false);
  const [rCategory, setRCategory] = useState('NutAllergy');
  const [rSeverity, setRSeverity] = useState('Hard');
  const [rItem, setRItem] = useState('');

  if (loadingId || loadingProfile || !profile) return <DetailSkeleton />;

  const completion = computeProfileCompletion(profile, { dietaryCount: dietaryItems.length });
  const avgScore = dashData?.latestAverageScore;
  const age = ageFrom(profile.dateOfBirth);

  const startEdit = () => {
    setForm({
      displayName: profile.displayName ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      bio: profile.bio ?? '',
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactPhone: profile.emergencyContactPhone ?? '',
      emergencyContactRelationship: profile.emergencyContactRelationship ?? '',
      jerseyNumber: profile.jerseyNumber != null ? String(profile.jerseyNumber) : '',
    });
    const h = profile.height ?? 0;
    setHeightCm(h ? String(Math.round(h)) : '');
    const { ft, inches } = cmToFtIn(h || 0);
    setHeightFt(h ? ft : '');
    setHeightIn(h ? inches : '');
    const w = profile.weight ?? 0;
    setWeightVal(w ? (weightUnit === 'kg' ? String(w) : kgToLb(w)) : '');
    setEditing(true);
  };

  const save = async () => {
    if (!form.displayName.trim()) { addToast('Name cannot be empty', 'error'); return; }
    const effHeight = heightUnit === 'cm' ? parseFloat(heightCm) : parseFloat(ftInToCm(heightFt, heightIn));
    const effWeight = weightUnit === 'kg' ? parseFloat(weightVal) : parseFloat(lbToKg(weightVal));
    try {
      await updateProfile.mutateAsync({
        displayName: form.displayName,
        phoneNumber: form.phoneNumber || null,
        bio: form.bio || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        emergencyContactRelationship: form.emergencyContactRelationship || null,
        dateOfBirth: form.dateOfBirth || null,
        height: Number.isFinite(effHeight) ? Math.round(effHeight * 10) / 10 : null,
        weight: Number.isFinite(effWeight) ? Math.round(effWeight * 10) / 10 : null,
        jerseyNumber: form.jerseyNumber ? parseInt(form.jerseyNumber, 10) : null,
      });
      addToast('Profile updated', 'success');
      setEditing(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not save profile', 'error');
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const addRestriction = async () => {
    if (!playerId) return;
    if (rCategory === 'Custom' && !rItem.trim()) { addToast('Describe the custom restriction', 'error'); return; }
    try {
      await createRestriction.mutateAsync({
        preferenceType: rSeverity === 'Hard' ? 'Allergy' : rSeverity === 'Lifestyle' ? 'Lifestyle' : 'SoftPreference',
        category: rCategory,
        specificItem: rItem.trim() || null,
        severity: rSeverity,
      });
      addToast('Restriction added', 'success');
      setRItem('');
      setShowAddRestriction(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not add restriction', 'error');
    }
  };

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ── Hero ── */}
        <motion.div
          custom={0} initial="hidden" animate="show" variants={fadeUp}
          className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
          <div className="h-28 bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700" />
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14">
              <div className="flex flex-col items-center sm:items-start">
                <EditableAvatar name={profile.displayName} src={profile.profilePictureUrl} />
              </div>
              <div className="flex-1 min-w-0 sm:pb-1 text-center sm:text-left">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                  {profile.jerseyNumber != null && <span className="text-emerald-500 mr-1.5">#{profile.jerseyNumber}</span>}
                  {profile.displayName}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mt-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold">
                    <Activity size={11} /> {profile.roles.includes('SoloAthlete') ? 'Solo Athlete' : 'Athlete'}
                  </span>
                  {profile.sportName && (
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold">{profile.sportName}</span>
                  )}
                  {profile.positionName && (
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-500 text-xs font-semibold">{profile.positionName}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={11} /> {profile.email}
                  </span>
                </div>
              </div>
              <div className="sm:pb-1 flex justify-center">
                {editing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                      <X size={13} /> Cancel
                    </button>
                    <button onClick={save} disabled={updateProfile.isPending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer">
                      {updateProfile.isPending ? <Loader2 size={13} className="animate-spin" /> : null} Save Changes
                    </button>
                  </div>
                ) : (
                  <button onClick={startEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer">
                    <Edit2 size={13} /> Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="mt-4">
              {editing ? (
                <textarea value={form.bio} onChange={set('bio')} maxLength={500} rows={2}
                  placeholder="Write a short bio — your story, ambitions, favorite position…" className={inputCls} />
              ) : profile.bio ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <button onClick={startEdit} className="text-sm text-gray-400 dark:text-gray-500 italic hover:text-emerald-500 transition-colors cursor-pointer">
                  + Add a short bio
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Completion ── */}
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
          <ProfileCompletionCard completion={completion} />
        </motion.div>

        {/* ── Two-column info ── */}
        <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Personal info */}
          <div className="lg:col-span-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Personal Information</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Full name</label>
                    <input value={form.displayName} onChange={set('displayName')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="+1 555 123 4567" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Date of birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Jersey number</label>
                    <input type="number" min={0} max={999} value={form.jerseyNumber} onChange={set('jerseyNumber')} placeholder="7" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Height</label>
                      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                        {(['cm', 'ftin'] as const).map(u => (
                          <button key={u} type="button"
                            onClick={() => {
                              if (u === heightUnit) return;
                              if (u === 'ftin' && heightCm) { const { ft, inches } = cmToFtIn(heightCm); setHeightFt(ft); setHeightIn(inches); }
                              else if (u === 'cm' && (heightFt || heightIn)) setHeightCm(ftInToCm(heightFt, heightIn));
                              setHeightUnit(u);
                            }}
                            className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer', heightUnit === u ? 'bg-indigo-600 text-white' : 'text-gray-400')}
                          >
                            {u === 'cm' ? 'cm' : 'ft/in'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {heightUnit === 'cm' ? (
                      <input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" className={inputCls} />
                    ) : (
                      <div className="flex gap-2">
                        <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5" className={inputCls} aria-label="feet" />
                        <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="9" className={inputCls} aria-label="inches" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Weight</label>
                      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                        {(['kg', 'lb'] as const).map(u => (
                          <button key={u} type="button"
                            onClick={() => {
                              if (u === weightUnit) return;
                              setWeightVal(v => v ? (u === 'lb' ? kgToLb(v) : lbToKg(v)) : v);
                              setWeightUnit(u);
                            }}
                            className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer', weightUnit === u ? 'bg-indigo-600 text-white' : 'text-gray-400')}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input type="number" inputMode="decimal" value={weightVal} onChange={e => setWeightVal(e.target.value)} placeholder={weightUnit === 'kg' ? '70' : '155'} className={inputCls} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Date of birth', value: profile.dateOfBirth ? `${new Date(profile.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : null, sub: age != null ? `${age} years old` : null },
                  { label: 'Height', value: formatHeight(profile.height, heightUnit), sub: null },
                  { label: 'Weight', value: formatWeight(profile.weight, weightUnit), sub: null },
                  { label: 'Jersey number', value: profile.jerseyNumber != null ? `#${profile.jerseyNumber}` : null, sub: null },
                  { label: 'Phone', value: profile.phoneNumber, sub: null },
                  { label: 'Email', value: profile.email, sub: 'read-only' },
                ].map(f => (
                  <div key={f.label} className="group relative p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 truncate">
                      {f.value || <span className="text-gray-400 dark:text-gray-600 font-normal">Not set</span>}
                    </p>
                    {f.sub && <p className="text-[10px] text-gray-400 mt-0.5">{f.sub}</p>}
                    {f.label !== 'Email' && (
                      <button onClick={startEdit} aria-label={`Edit ${f.label}`} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-emerald-500 transition-all cursor-pointer">
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team & performance (read-only) */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Team & Performance</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Users size={13} /> Team</span>
                {profile.teamId ? (
                  <Link to={`/player-dashboard/team/${profile.teamId}`} className="text-sm font-bold text-indigo-500 hover:underline">{profile.teamName}</Link>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Hash size={13} /> Position</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.positionName ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Activity size={13} /> Fitness level</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500 text-xs font-bold">
                  {fitnessLabel(profile.fitnessLevel)} {profile.fitnessLevel ? `· ${profile.fitnessLevel}/10` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><TrendingUp size={13} /> Latest score</span>
                <span className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-bold',
                  avgScore == null ? 'bg-gray-500/15 text-gray-400'
                    : avgScore < 5 ? 'bg-red-500/15 text-red-500'
                    : avgScore < 7 ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-green-500/15 text-green-500',
                )}>
                  {avgScore != null ? `${avgScore.toFixed(1)}/10` : 'No assessments yet'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 pt-1">{profile.roles.includes('SoloAthlete') ? 'Fitness level updates as you log assessments.' : 'Position and fitness level are managed by your coach.'}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Dietary restrictions ── */}
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Salad size={15} className="text-emerald-400" /> Dietary Restrictions
            </h3>
            <button
              onClick={() => setShowAddRestriction(s => !s)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add Restriction
            </button>
          </div>

          {dietaryItems.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {dietaryItems.map(item => (
                <span key={item.id} className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold', SEVERITY_STYLES[item.severity] ?? 'bg-gray-500/20 text-gray-400')}>
                  {item.severity === 'Hard' && <ShieldAlert size={11} />}
                  {CATEGORY_LABELS[item.category] ?? item.category}{item.specificItem ? ` (${item.specificItem})` : ''}
                  <button
                    onClick={() => deleteRestriction.mutateAsync(item.id).then(() => addToast('Restriction removed', 'success')).catch(() => addToast('Could not remove', 'error'))}
                    aria-label="Remove restriction"
                    className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No dietary restrictions on file.</p>
          )}

          {showAddRestriction && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 mb-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <label className={labelCls}>Category</label>
                <select value={rCategory} onChange={e => setRCategory(e.target.value)} className={clsx(inputCls, 'appearance-none cursor-pointer')}>
                  {RESTRICTION_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 bottom-3 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className={labelCls}>Severity</label>
                <select value={rSeverity} onChange={e => setRSeverity(e.target.value)} className={clsx(inputCls, 'appearance-none cursor-pointer')}>
                  <option value="Hard">Hard (allergy)</option>
                  <option value="Lifestyle">Moderate (lifestyle)</option>
                  <option value="Soft">Soft (preference)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 bottom-3 text-gray-400 pointer-events-none" />
              </div>
              <div>
                <label className={labelCls}>Specific item</label>
                <input value={rItem} onChange={e => setRItem(e.target.value)} placeholder="e.g. peanuts" className={inputCls} />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addRestriction}
                  disabled={createRestriction.isPending}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {createRestriction.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            These restrictions are shared with your coach and used for AI nutrition planning.
          </p>
        </motion.div>

        {/* ── Emergency contact ── */}
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <HeartPulse size={15} className="text-rose-400" /> Emergency Contact
          </h3>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Name</label>
                <input value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder="e.g. Maria Ward" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder="+1 555 987 6543" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Relationship</label>
                <input value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} placeholder="e.g. Parent/Guardian" className={inputCls} />
              </div>
            </div>
          ) : profile.emergencyContactName ? (
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.emergencyContactName}</p>
              {profile.emergencyContactPhone && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"><Phone size={13} /> {profile.emergencyContactPhone}</span>
              )}
              {profile.emergencyContactRelationship && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">{profile.emergencyContactRelationship}</span>
              )}
              <button onClick={startEdit} className="p-1 text-gray-400 hover:text-emerald-500 transition-colors cursor-pointer"><Edit2 size={13} /></button>
            </div>
          ) : (
            <button onClick={startEdit} className="text-sm text-emerald-500 hover:underline font-semibold cursor-pointer">+ Add Emergency Contact</button>
          )}
          <p className="text-[11px] text-gray-400 mt-2">Visible to your coach in case something happens at training or a match.</p>
        </motion.div>

        {/* ── Account settings ── */}
        <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
          <AccountSettingsSection isCoach={false} />
        </motion.div>
      </div>
    </PageWrapper>
  );
}
