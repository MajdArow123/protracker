import { useState, useMemo } from 'react';
import { X, ArrowLeftRight, Search, Check, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { PlannedMealItem } from '../../types';
import type { FoodAlternative } from '../../types';
import { useSwapMealItem } from '../../hooks/useNutrition';
import { useFoodAlternatives } from '../../hooks/useReports';
import { useToast } from '../../context/ToastContext';

function pctDiff(a: number, b: number): number {
  if (a === 0) return 0;
  return Math.abs(b - a) / a;
}

function isGoodMatch(original: PlannedMealItem, food: FoodAlternative): boolean {
  if (food.calories == null || food.protein == null || food.carbs == null || food.fats == null) return false;
  return (
    pctDiff(original.calories, food.calories) <= 0.20 &&
    pctDiff(original.protein, food.protein) <= 0.25 &&
    pctDiff(original.carbs, food.carbs) <= 0.25 &&
    pctDiff(original.fats, food.fats) <= 0.25
  );
}

function MacDiff({ label, original, next, color }: { label: string; original: number; next: number; color: string }) {
  const diff = next - original;
  const pct = original > 0 ? ((diff / original) * 100) : 0;
  const significant = Math.abs(pct) > 20;
  return (
    <div className="text-center">
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${color}`}>{label}</p>
      <p className={clsx('text-base font-black', significant ? 'text-amber-500' : 'text-gray-900 dark:text-white')}>{next}g</p>
      {diff !== 0 && (
        <p className={clsx('text-[10px] font-semibold', diff > 0 ? 'text-emerald-500' : 'text-red-500')}>
          {diff > 0 ? '+' : ''}{diff}g
        </p>
      )}
    </div>
  );
}

interface Props {
  item: PlannedMealItem;
  playerId: number;
  onClose: () => void;
}

export function SwapModal({ item, playerId, onClose }: Props) {
  const { addToast } = useToast();
  const swap = useSwapMealItem(playerId);
  const { data: library = [], isLoading: loadingLibrary } = useFoodAlternatives();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodAlternative | null>(null);

  // Deduplicate by food name (keep first occurrence per unique alternativeFood)
  const uniqueFoods = useMemo(() => {
    const seen = new Set<string>();
    return library.filter(f => {
      const key = f.alternativeFood.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [library]);

  const filtered = useMemo(() => {
    if (!query.trim()) return uniqueFoods;
    const q = query.toLowerCase();
    return uniqueFoods.filter(f => f.alternativeFood.toLowerCase().includes(q));
  }, [uniqueFoods, query]);

  const goodMatch = selected ? isGoodMatch(item, selected) : false;
  const macrosDiffer = selected && !goodMatch;

  async function handleConfirm() {
    if (!selected || selected.calories == null) return;
    try {
      await swap.mutateAsync({
        mealItemId: item.id,
        data: {
          newFoodName: selected.alternativeFood,
          newPortion: selected.suggestedPortion ?? '',
          newCalories: selected.calories ?? 0,
          newProtein: selected.protein ?? 0,
          newCarbs: selected.carbs ?? 0,
          newFats: selected.fats ?? 0,
        },
      });
      addToast(`Swapped to ${selected.alternativeFood}`, 'success');
      onClose();
    } catch {
      addToast('Swap failed. Please try again.', 'error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-indigo-400" />
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Swap {item.foodName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1 min-h-0">
          {/* Current food */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Currently in your plan</p>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
              <p className="font-bold text-gray-900 dark:text-white text-sm">{item.foodName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.portion}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">{item.calories} kcal</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">P {item.protein}g</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold">C {item.carbs}g</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold">F {item.fats}g</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search alternatives..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          {/* Food list */}
          <div className="flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Food Library</p>
            {loadingLibrary ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No foods found</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {filtered.map(food => {
                  const match = isGoodMatch(item, food);
                  const isSelected = selected?.id === food.id;
                  return (
                    <button
                      key={food.id}
                      onClick={() => setSelected(isSelected ? null : food)}
                      className={clsx(
                        'w-full text-left rounded-xl border p-3 transition-all cursor-pointer',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{food.alternativeFood}</p>
                          {food.suggestedPortion && (
                            <p className="text-xs text-gray-500 mt-0.5">{food.suggestedPortion}</p>
                          )}
                          {food.calories != null && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">{food.calories} kcal</span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">P {food.protein}g</span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold">C {food.carbs}g</span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold">F {food.fats}g</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {food.calories != null && (
                            <span className={clsx(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1',
                              match
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            )}>
                              {match ? <Check size={9} /> : <AlertTriangle size={9} />}
                              {match ? 'Good match' : 'Different macros'}
                            </span>
                          )}
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                              <Check size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comparison section */}
          <AnimatePresence>
            {selected && selected.calories != null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Nutritional Comparison</p>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Calories</p>
                      <p className={clsx('text-base font-black', pctDiff(item.calories, selected.calories!) > 0.20 ? 'text-amber-500' : 'text-gray-900 dark:text-white')}>{selected.calories}</p>
                      {selected.calories !== item.calories && (
                        <p className={clsx('text-[10px] font-semibold', selected.calories! > item.calories ? 'text-emerald-500' : 'text-red-500')}>
                          {selected.calories! > item.calories ? '+' : ''}{selected.calories! - item.calories}
                        </p>
                      )}
                    </div>
                    <MacDiff label="Protein" original={item.protein} next={selected.protein ?? 0} color="text-blue-500" />
                    <MacDiff label="Carbs" original={item.carbs} next={selected.carbs ?? 0} color="text-amber-500" />
                    <MacDiff label="Fats" original={item.fats} next={selected.fats ?? 0} color="text-red-500" />
                    <div className="flex items-center justify-center">
                      {goodMatch ? (
                        <span className="text-emerald-500"><Check size={18} /></span>
                      ) : (
                        <span className="text-amber-500"><ChevronRight size={18} /></span>
                      )}
                    </div>
                  </div>
                  <p className={clsx(
                    'text-xs font-semibold mt-2',
                    goodMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  )}>
                    {goodMatch ? '✓ Macros are similar' : 'Macros differ significantly from original'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex-shrink-0 space-y-2">
          {macrosDiffer && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This replacement has different nutritional values. Your coach will be notified.
              </p>
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selected || selected.calories == null || swap.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer"
          >
            {swap.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {swap.isPending ? 'Swapping…' : selected ? 'Confirm Swap' : 'Select a food to swap'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
