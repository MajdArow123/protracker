import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { AutoSaveStatus } from '../../components/ui/AutoSaveStatus';
import { AILoadingPanel } from '../../components/ui/AILoadingPanel';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useToast } from '../../context/ToastContext';
import { usePlayer } from '../../hooks/usePlayers';
import {
  usePlayerNutritionProfile, useCreateProfileItem, useUpdateProfileItem, useDeleteProfileItem,
  usePlayerNutritionGuidance, useCreateGuidance, useUpdateGuidance,
  useWeeklyNutritionPlan, useGenerateWeeklyNutritionPlan,
} from '../../hooks/useNutrition';
import {
  ArrowLeft, Plus, Edit2, Trash2, ShieldAlert, Salad, Droplets,
  Zap, Apple, Info, Utensils, ChevronDown, ChevronUp, Sparkles,
  Dumbbell, Coffee, Moon, CalendarDays,
} from 'lucide-react';
import { useGenerateNutritionGuidance } from '../../hooks/useAI';
import { clsx } from 'clsx';
import { WeeklyNutritionPlanView } from '../../components/nutrition/WeeklyNutritionPlanView';
import type { NutritionProfileItem, NutritionGuidance, StructuredMealPlan, Meal } from '../../types';

type Tab = 'profile' | 'guidance' | 'weekly';

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

const MEAL_ICONS: Record<string, typeof Coffee> = {
  Breakfast: Coffee,
  Lunch: Utensils,
  Snack: Apple,
  Dinner: Moon,
  'Post-Workout': Dumbbell,
};

function parseList(str: string | null | undefined): string[] {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function parseMealPlan(json: string | null | undefined): StructuredMealPlan | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StructuredMealPlan;
  } catch {
    return null;
  }
}

function MacroBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{value}g</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const [open, setOpen] = useState(true);
  const Icon = MEAL_ICONS[meal.name] ?? Utensils;
  const totalCals = meal.items.reduce((s, i) => s + (i.calories || 0), 0);
  const totalProtein = meal.items.reduce((s, i) => s + (i.protein || 0), 0);
  const totalCarbs = meal.items.reduce((s, i) => s + (i.carbs || 0), 0);
  const totalFats = meal.items.reduce((s, i) => s + (i.fats || 0), 0);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-600/15 flex items-center justify-center flex-shrink-0">
          <Icon size={17} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white text-sm">{meal.name}</p>
          <p className="text-xs text-gray-500">{meal.time}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {totalCals > 0 && <span className="font-semibold text-gray-700 dark:text-gray-300">{totalCals} kcal</span>}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {open && meal.items.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
              <div className="space-y-2 mt-3">
                {meal.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.food}</p>
                      <p className="text-xs text-gray-500">{item.portion}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className="text-gray-600 dark:text-gray-400">{item.calories} kcal</span>
                      <span className="text-blue-500">P:{item.protein}g</span>
                      <span className="text-amber-500">C:{item.carbs}g</span>
                      <span className="text-red-400">F:{item.fats}g</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Meal totals */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-500">Meal totals:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{totalCals} kcal</span>
                <span className="text-blue-500">P:{totalProtein}g</span>
                <span className="text-amber-500">C:{totalCarbs}g</span>
                <span className="text-red-400">F:{totalFats}g</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StructuredPlanView({ plan }: { plan: StructuredMealPlan }) {
  const priorityFoods = parseList(plan.foodsToPrioritize);
  const limitFoods = parseList(plan.foodsToLimit);

  return (
    <div className="space-y-4">
      {/* Daily overview */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-5">
        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm mb-3 uppercase tracking-wide">Daily Overview</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Daily Calories</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{plan.dailyCalories} kcal</span>
            </div>
          </div>
          {plan.macros && (
            <div className="col-span-2 space-y-2.5">
              <MacroBar value={plan.macros.protein} max={250} color="#6366f1" label="Protein" />
              <MacroBar value={plan.macros.carbs} max={500} color="#f59e0b" label="Carbs" />
              <MacroBar value={plan.macros.fats} max={150} color="#ef4444" label="Fats" />
              {plan.macros.fiber > 0 && <MacroBar value={plan.macros.fiber} max={50} color="#10b981" label="Fiber" />}
            </div>
          )}
          {plan.hydrationMl > 0 && (
            <div className="col-span-2 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Droplets size={15} />
              <span>Hydration target: <strong>{(plan.hydrationMl / 1000).toFixed(1)}L / day</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Meal schedule */}
      {plan.meals && plan.meals.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wide">Meal Schedule</h4>
          {plan.meals.map((meal, i) => (
            <MealCard key={i} meal={meal} />
          ))}
        </div>
      )}

      {/* Foods */}
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
    </div>
  );
}

function GuidanceCard({ guidance, onEdit }: { guidance: NutritionGuidance; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const mealPlan = parseMealPlan(guidance.mealPlanJson);
  const priorityFoods = parseList(guidance.foodsToPrioritize);
  const limitFoods = parseList(guidance.foodsToLimit);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
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

              {/* Structured meal plan (AI) or fallback text */}
              {mealPlan ? (
                <StructuredPlanView plan={mealPlan} />
              ) : (
                <>
                  {guidance.mealSuggestions && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <Utensils size={11} /> Meal Suggestions
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{guidance.mealSuggestions}</p>
                    </div>
                  )}
                  {(priorityFoods.length > 0 || limitFoods.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {priorityFoods.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-2">Prioritize</p>
                          <div className="flex flex-wrap gap-1.5">
                            {priorityFoods.map(f => (
                              <span key={f} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {limitFoods.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Limit</p>
                          <div className="flex flex-wrap gap-1.5">
                            {limitFoods.map(f => (
                              <span key={f} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Hydration */}
              {guidance.hydrationTips && !mealPlan && (
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId);
  const { data: profileItems = [], isLoading: loadingProfile } = usePlayerNutritionProfile(playerId);
  const { data: guidanceList = [] } = usePlayerNutritionGuidance(playerId);
  const { data: weeklyPlan, isLoading: loadingWeekly } = useWeeklyNutritionPlan(playerId);
  const createItem = useCreateProfileItem(playerId);
  const updateItem = useUpdateProfileItem(playerId);
  const deleteItem = useDeleteProfileItem(playerId);
  const createGuidance = useCreateGuidance();
  const updateGuidance = useUpdateGuidance();
  const generateAI = useGenerateNutritionGuidance();
  const generateWeekly = useGenerateWeeklyNutritionPlan();

  const tab = (searchParams.get('tab') as Tab | null) ?? 'profile';
  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });
  const [aiError, setAiError] = useState<string | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
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
  function buildProfileItemData() {
    return { preferenceType: profileForm.preferenceType, category: profileForm.category, specificItem: profileForm.specificItem || undefined, severity: profileForm.severity, notes: profileForm.notes || undefined } as Omit<NutritionProfileItem, 'id' | 'playerId'>;
  }

  async function autoSaveItem() {
    if (!editingItem) return;
    await updateItem.mutateAsync({ id: editingItem.id, data: buildProfileItemData() });
  }

  const { status: itemSaveStatus, flush: flushItem } = useAutoSave(!!editingItem, profileForm, autoSaveItem, 400);

  async function saveProfileItem() {
    const data = buildProfileItemData();
    try {
      if (editingItem) {
        await flushItem();
        setEditingItem(null);
      } else {
        await createItem.mutateAsync(data);
        showToast('Item added', 'success');
        setShowNewItem(false);
      }
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
  function buildGuidancePayload() {
    const payload: Partial<NutritionGuidance> = { playerId };
    GUIDANCE_FIELDS.forEach(f => { (payload as Record<string, unknown>)[f.key as string] = guidanceForm[f.key] || undefined; });
    return payload;
  }

  async function autoSaveGuidance() {
    if (!editingGuidance) return;
    await updateGuidance.mutateAsync({ id: editingGuidance.id, data: buildGuidancePayload() });
  }

  const { status: guidanceSaveStatus, flush: flushGuidance } = useAutoSave(!!editingGuidance, guidanceForm, autoSaveGuidance);

  async function saveGuidance() {
    try {
      if (editingGuidance) {
        await flushGuidance();
        setEditingGuidance(null);
      } else {
        await createGuidance.mutateAsync(buildGuidancePayload());
        showToast('Guidance created', 'success');
        setShowNewGuidance(false);
      }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
  }

  async function handleGenerateWeekly() {
    setWeeklyError(null);
    try {
      await generateWeekly.mutateAsync(playerId);
      showToast('Your weekly plan is ready!', 'success');
    } catch {
      setWeeklyError('Plan generation failed. Please try again.');
    }
  }

  async function handleGenerateAI() {
    setAiError(null);
    try {
      await generateAI.mutateAsync(playerId);
      showToast('Nutrition plan generated!', 'success');
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
        {([['profile', 'Dietary Profile'], ['guidance', 'Nutrition Guidance'], ['weekly', 'Weekly Plan']] as [Tab, string][]).map(([t, label]) => (
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

              {profileForm.severity === 'Hard' && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                  <ShieldAlert size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">Hard allergy — AI will never suggest foods containing this ingredient.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-4">
                {editingItem && <AutoSaveStatus status={itemSaveStatus} />}
                <button onClick={() => { setEditingItem(null); setShowNewItem(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                <button onClick={saveProfileItem} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                  {editingItem ? 'Done' : 'Add Restriction'}
                </button>
              </div>
            </div>
          )}

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
                <AILoadingPanel
                  compact
                  primaryText="Generating nutrition plan..."
                  messages={[
                    'Analyzing dietary restrictions...',
                    'Designing a balanced meal schedule...',
                    'Calculating macros and calories...',
                    'Finalizing recommendations...',
                  ]}
                  estimatedSeconds={15}
                />
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
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3 mt-5">
                {editingGuidance && <AutoSaveStatus status={guidanceSaveStatus} />}
                <button onClick={() => { setEditingGuidance(null); setShowNewGuidance(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                <button onClick={saveGuidance} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                  {editingGuidance ? 'Done' : 'Create Guidance'}
                </button>
              </div>
            </div>
          )}

          {guidanceList.length === 0 && !isGuidanceFormOpen ? (
            <EmptyState
              icon={<Salad size={36} />}
              title="No nutrition guidance yet"
              description="Generate an AI-powered structured meal plan or create one manually"
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

      {/* Weekly Plan tab */}
      {tab === 'weekly' && (
        <div className="space-y-4">
          {loadingWeekly ? (
            <PageSpinner />
          ) : generateWeekly.isPending ? (
            <AILoadingPanel
              primaryText="Generating your weekly plan..."
              messages={[
                'Analyzing dietary restrictions...',
                'Planning Monday through Wednesday...',
                'Balancing macros across the week...',
                'Planning Thursday through Sunday...',
                'Finalizing nutritional values...',
                'Almost done...',
              ]}
              note="This usually takes 30-60 seconds since we're planning every meal for the full week"
              estimatedSeconds={45}
            />
          ) : !weeklyPlan ? (
            <div className="space-y-4">
              {weeklyError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  {weeklyError}
                  <button onClick={handleGenerateWeekly} className="ml-auto text-xs font-semibold underline cursor-pointer">Retry</button>
                </div>
              )}
              <EmptyState
                icon={<CalendarDays size={36} />}
                title="No weekly plan yet"
                description="Generate a personalized 7-day meal plan for this player using AI"
                action={{ label: 'Generate with AI', onClick: handleGenerateWeekly }}
              />
            </div>
          ) : (
            <motion.div
              key="weekly-plan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {weeklyError && (
                <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  {weeklyError}
                  <button onClick={handleGenerateWeekly} className="ml-auto text-xs font-semibold underline cursor-pointer">Retry</button>
                </div>
              )}
              <WeeklyNutritionPlanView
                plan={weeklyPlan}
                canSwap={false}
                isCoach={true}
                playerId={playerId}
                onGenerate={handleGenerateWeekly}
                isGenerating={generateWeekly.isPending}
              />
            </motion.div>
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
