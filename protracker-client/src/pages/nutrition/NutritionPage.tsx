import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/ToastContext';
import { usePlayer } from '../../hooks/usePlayers';
import {
  usePlayerNutritionProfile, useCreateProfileItem, useUpdateProfileItem, useDeleteProfileItem,
  usePlayerNutritionGuidance, useCreateGuidance, useUpdateGuidance,
} from '../../hooks/useNutrition';
import {
  ArrowLeft, Plus, Edit2, Trash2, ShieldAlert, Salad, Droplets,
  Zap, Apple, Info, Utensils, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { useGenerateNutritionGuidance } from '../../hooks/useAI';
import { clsx } from 'clsx';
import type { NutritionProfileItem, NutritionGuidance } from '../../types';

type Tab = 'profile' | 'guidance';

const PREFERENCE_TYPES = ['Allergy', 'Lifestyle', 'SoftPreference'];
const CATEGORIES = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'GlutenFree', 'NutAllergy', 'DairyFree', 'NoEggs', 'NoFish', 'NoRedMeat', 'LowFODMAP', 'Custom'];
const SEVERITIES = ['Hard', 'Lifestyle', 'Soft'];

const TEXTAREA_CLS = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none transition-all';

const SEVERITY_STYLES: Record<string, { card: string; badge: string; icon: boolean }> = {
  Hard: {
    card: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30',
    badge: 'bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/30',
    icon: true,
  },
  Lifestyle: {
    card: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30',
    badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    icon: false,
  },
  Soft: {
    card: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30',
    icon: false,
  },
};

interface ProfileForm {
  preferenceType: string; category: string; specificItem: string; severity: string; notes: string;
}
const EMPTY_PROFILE: ProfileForm = { preferenceType: 'Allergy', category: 'Custom', specificItem: '', severity: 'Hard', notes: '' };

const GUIDANCE_FIELDS: { key: keyof NutritionGuidance; label: string; placeholder: string; icon: typeof Salad }[] = [
  { key: 'goal', label: 'Goal', placeholder: 'Performance goal…', icon: Zap },
  { key: 'mealSuggestions', label: 'Meal Suggestions', placeholder: 'Breakfast, lunch, dinner ideas…', icon: Utensils },
  { key: 'hydrationTips', label: 'Hydration Tips', placeholder: 'Daily water intake, electrolytes…', icon: Droplets },
  { key: 'recoveryTips', label: 'Recovery Tips', placeholder: 'Post-training nutrition…', icon: Apple },
  { key: 'foodsToPrioritize', label: 'Foods to Prioritize', placeholder: 'High-value foods (comma-separated)…', icon: Apple },
  { key: 'foodsToLimit', label: 'Foods to Limit', placeholder: 'Foods to avoid or minimize (comma-separated)…', icon: Apple },
];

function parseList(str: string | null | undefined): string[] {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function GuidanceCard({ guidance, onEdit }: { guidance: NutritionGuidance; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const priorityFoods = parseList(guidance.foodsToPrioritize);
  const limitFoods = parseList(guidance.foodsToLimit);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <Salad size={17} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">Nutrition Plan</p>
            <p className="text-xs text-gray-500">{guidance.createdDate}{guidance.isAIGenerated ? ' · AI Generated' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer">
            <Edit2 size={14} />
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-5">
              {/* Goal */}
              {guidance.goal && (
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/30">
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1.5">Goal</p>
                  <p className="text-base font-semibold text-indigo-900 dark:text-indigo-100">{guidance.goal}</p>
                </div>
              )}

              {/* Meal suggestions */}
              {guidance.mealSuggestions && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                    <Utensils size={11} /> Meal Suggestions
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{guidance.mealSuggestions}</p>
                </div>
              )}

              {/* Hydration */}
              {guidance.hydrationTips && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                    <Droplets size={11} /> Hydration
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">{guidance.hydrationTips}</p>
                </div>
              )}

              {/* Recovery */}
              {guidance.recoveryTips && (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-2 flex items-center gap-1.5">
                    <Zap size={11} /> Recovery
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed whitespace-pre-wrap">{guidance.recoveryTips}</p>
                </div>
              )}

              {/* Foods dashboard */}
              {(priorityFoods.length > 0 || limitFoods.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {priorityFoods.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-2">Prioritize</p>
                      <div className="flex flex-wrap gap-1.5">
                        {priorityFoods.map(f => (
                          <span key={f} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {limitFoods.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Limit</p>
                      <div className="flex flex-wrap gap-1.5">
                        {limitFoods.map(f => (
                          <span key={f} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimer */}
              {guidance.disclaimer && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/20 flex items-start gap-2.5">
                  <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed italic">{guidance.disclaimer}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NutritionPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId);
  const { data: profileItems = [], isLoading: loadingProfile } = usePlayerNutritionProfile(playerId);
  const { data: guidanceList = [] } = usePlayerNutritionGuidance(playerId);
  const createItem = useCreateProfileItem(playerId);
  const updateItem = useUpdateProfileItem(playerId);
  const deleteItem = useDeleteProfileItem(playerId);
  const createGuidance = useCreateGuidance();
  const updateGuidance = useUpdateGuidance();
  const generateAI = useGenerateNutritionGuidance();

  const [tab, setTab] = useState<Tab>('profile');
  const [aiError, setAiError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<NutritionProfileItem | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [deleteTarget, setDeleteTarget] = useState<NutritionProfileItem | null>(null);
  const [editingGuidance, setEditingGuidance] = useState<NutritionGuidance | null>(null);
  const [showNewGuidance, setShowNewGuidance] = useState(false);
  const [guidanceForm, setGuidanceForm] = useState<Partial<Record<keyof NutritionGuidance, string>>>({});

  function openNewItem() { setEditingItem(null); setProfileForm(EMPTY_PROFILE); setShowNewItem(true); }
  function openEditItem(item: NutritionProfileItem) {
    setEditingItem(item);
    setProfileForm({ preferenceType: item.preferenceType, category: item.category, specificItem: item.specificItem ?? '', severity: item.severity, notes: item.notes ?? '' });
    setShowNewItem(false);
  }
  async function saveProfileItem() {
    const data = { preferenceType: profileForm.preferenceType, category: profileForm.category, specificItem: profileForm.specificItem || undefined, severity: profileForm.severity, notes: profileForm.notes || undefined } as Omit<NutritionProfileItem, 'id' | 'playerId'>;
    try {
      if (editingItem) { await updateItem.mutateAsync({ id: editingItem.id, data }); showToast('Item updated', 'success'); setEditingItem(null); }
      else { await createItem.mutateAsync(data); showToast('Item added', 'success'); setShowNewItem(false); }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
  }

  function openNewGuidance() { setEditingGuidance(null); setGuidanceForm({}); setShowNewGuidance(true); }
  function openEditGuidance(g: NutritionGuidance) {
    setEditingGuidance(g);
    const f: typeof guidanceForm = {};
    GUIDANCE_FIELDS.forEach(field => { f[field.key] = String(g[field.key] ?? ''); });
    setGuidanceForm(f);
    setShowNewGuidance(false);
  }
  async function saveGuidance() {
    const payload: Partial<NutritionGuidance> = { playerId };
    GUIDANCE_FIELDS.forEach(f => { (payload as Record<string, unknown>)[f.key as string] = guidanceForm[f.key] || undefined; });
    try {
      if (editingGuidance) { await updateGuidance.mutateAsync({ id: editingGuidance.id, data: payload }); showToast('Guidance updated', 'success'); setEditingGuidance(null); }
      else { await createGuidance.mutateAsync(payload); showToast('Guidance created', 'success'); setShowNewGuidance(false); }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
  }

  async function handleGenerateAI() {
    setAiError(null);
    try {
      await generateAI.mutateAsync(playerId);
      showToast('Nutrition plan generated! Review before saving.', 'success');
    } catch {
      setAiError('AI generation failed. Please try again.');
    }
  }

  const isGenerating = generateAI.isPending;
  const hardRestrictions = profileItems.filter(r => r.severity === 'Hard');
  const consideredLabels = profileItems.map(r => r.specificItem || r.category).slice(0, 5);

  if (loadingPlayer || loadingProfile) return <PageSpinner />;

  const isItemFormOpen = showNewItem || !!editingItem;
  const isGuidanceFormOpen = showNewGuidance || !!editingGuidance;

  return (
    <PageWrapper
      title={`Nutrition — ${player?.fullName ?? ''}`}
      actions={
        <button onClick={() => navigate(`/players/${id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">
          <ArrowLeft size={15} /> Back
        </button>
      }
    >
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-2xl w-fit">
        {([['profile', 'Dietary Profile'], ['guidance', 'Nutrition Guidance']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer',
              tab === t ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dietary Profile tab */}
      {tab === 'profile' && (
        <div className="max-w-2xl space-y-4">
          {!isItemFormOpen && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {profileItems.length > 0 ? `${profileItems.length} dietary restriction${profileItems.length !== 1 ? 's' : ''} on file` : 'No dietary preferences set yet'}
              </p>
              <button onClick={openNewItem} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
                <Plus size={15} /> Add Restriction
              </button>
            </div>
          )}

          {isItemFormOpen && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editingItem ? 'Edit Preference' : 'New Dietary Restriction'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Type" value={profileForm.preferenceType} onChange={e => setProfileForm(v => ({ ...v, preferenceType: e.target.value }))} options={PREFERENCE_TYPES.map(t => ({ value: t, label: t }))} />
                <Select label="Category" value={profileForm.category} onChange={e => setProfileForm(v => ({ ...v, category: e.target.value }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
                <Select label="Severity" value={profileForm.severity} onChange={e => setProfileForm(v => ({ ...v, severity: e.target.value }))} options={SEVERITIES.map(s => ({ value: s, label: s }))} />
                <Input label="Specific Item" value={profileForm.specificItem} onChange={e => setProfileForm(v => ({ ...v, specificItem: e.target.value }))} placeholder="e.g. peanuts" />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={profileForm.notes} onChange={e => setProfileForm(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder="Additional notes…" className={TEXTAREA_CLS} />
                </div>
              </div>

              {/* Severity warning */}
              {profileForm.severity === 'Hard' && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                  <ShieldAlert size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Hard allergy — AI will never suggest foods containing this ingredient.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setEditingItem(null); setShowNewItem(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                <button onClick={saveProfileItem} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                  {editingItem ? 'Save Changes' : 'Add Restriction'}
                </button>
              </div>
            </div>
          )}

          {/* Grouped by severity */}
          {profileItems.length === 0 && !isItemFormOpen ? (
            <EmptyState
              icon={<Salad size={36} />}
              title="No dietary restrictions"
              description="Add dietary preferences to customize AI nutrition recommendations"
              action={{ label: 'Add First Restriction', onClick: openNewItem }}
            />
          ) : (
            <div className="space-y-3">
              {profileItems.map(item => {
                const style = SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.Soft;
                return (
                  <div key={item.id} className={clsx('rounded-2xl border p-4', style.card)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {style.icon && <ShieldAlert size={13} className="text-red-500 flex-shrink-0" />}
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">{item.category}</span>
                          {item.specificItem && <span className="text-xs text-gray-500">({item.specificItem})</span>}
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold', style.badge)}>{item.severity}</span>
                          <span className="text-xs text-gray-400">{item.preferenceType}</span>
                        </div>
                        {item.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{item.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditItem(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Guidance tab */}
      {tab === 'guidance' && (
        <div className="max-w-2xl space-y-4">
          {!isGuidanceFormOpen && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                  className={clsx(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer',
                    'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500',
                    'shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                    isGenerating && 'animate-pulse'
                  )}
                >
                  <Sparkles size={15} />
                  {isGenerating
                    ? <span className="flex items-center gap-1">Generating<span className="inline-flex gap-0.5">{[0,1,2].map(i=><span key={i} className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</span></span>
                    : 'Generate with AI'
                  }
                </button>
                <button onClick={openNewGuidance} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
                  <Plus size={15} /> New Guidance
                </button>
              </div>

              {consideredLabels.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AI will consider: <span className="text-violet-600 dark:text-violet-400 font-medium">{consideredLabels.join(', ')}</span>
                  {hardRestrictions.length > 0 && <span className="ml-1 text-red-500 font-semibold">({hardRestrictions.length} hard restriction{hardRestrictions.length > 1 ? 's' : ''})</span>}
                </p>
              )}

              {isGenerating && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse flex-shrink-0" />
                  <span>Generating personalized nutrition plan…</span>
                  <span className="text-xs text-violet-500 ml-auto whitespace-nowrap">~5–10 sec</span>
                </div>
              )}

              {aiError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  {aiError}
                  <button onClick={handleGenerateAI} className="ml-auto text-xs font-semibold underline cursor-pointer">Retry</button>
                </div>
              )}
            </div>
          )}

          {isGuidanceFormOpen && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editingGuidance ? 'Edit Guidance' : 'New Nutrition Guidance'}</h3>
              <div className="space-y-4">
                {GUIDANCE_FIELDS.map(f => (
                  <div key={String(f.key)}>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <f.icon size={13} className="text-gray-400" /> {f.label}
                    </label>
                    <textarea
                      value={guidanceForm[f.key] ?? ''}
                      onChange={e => setGuidanceForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      rows={f.key === 'goal' ? 1 : 2}
                      placeholder={f.placeholder}
                      className={TEXTAREA_CLS}
                    />
                    {(f.key === 'foodsToPrioritize' || f.key === 'foodsToLimit') && (
                      <p className="text-xs text-gray-400 mt-1">Comma-separated list: "Chicken, Rice, Broccoli"</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => { setEditingGuidance(null); setShowNewGuidance(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                <button onClick={saveGuidance} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                  {editingGuidance ? 'Save Changes' : 'Create Guidance'}
                </button>
              </div>
            </div>
          )}

          {guidanceList.length === 0 && !isGuidanceFormOpen ? (
            <EmptyState
              icon={<Salad size={36} />}
              title="No nutrition guidance yet"
              description="Generate an AI-powered plan or create one manually"
              action={{ label: 'Generate with AI', onClick: handleGenerateAI }}
            />
          ) : (
            <div className="space-y-4">
              {guidanceList.map(g => (
                <GuidanceCard key={g.id} guidance={g} onEdit={() => openEditGuidance(g)} />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try { await deleteItem.mutateAsync(deleteTarget.id); showToast('Preference deleted', 'success'); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); }
          finally { setDeleteTarget(null); }
        }}
        title="Delete Preference"
        message={`Remove "${deleteTarget?.category}" from dietary profile?`}
        confirmLabel="Delete"
        isLoading={deleteItem.isPending}
      />
    </PageWrapper>
  );
}
