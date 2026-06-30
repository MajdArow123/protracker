import { useState } from 'react';
import { X, ArrowLeftRight, Loader2, CheckCircle2 } from 'lucide-react';
import type { PlannedMealItem, SwapMealItemRequest } from '../../types';
import { useSwapMealItem } from '../../hooks/useNutrition';
import { useToast } from '../../context/ToastContext';

const EQUIVALENCE_NOTE = 'Replacement must be within ±10% calories, ±15% protein/carbs/fats of the original.';

interface ManualSwapFormProps {
  item: PlannedMealItem;
  playerId: number;
  onSuccess: () => void;
}

function ManualSwapForm({ item, playerId, onSuccess }: ManualSwapFormProps) {
  const { addToast } = useToast();
  const swap = useSwapMealItem(playerId);

  const [form, setForm] = useState<SwapMealItemRequest>({
    newFoodName: '',
    newPortion: '',
    newCalories: item.calories,
    newProtein: item.protein,
    newCarbs: item.carbs,
    newFats: item.fats,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: ['newCalories', 'newProtein', 'newCarbs', 'newFats'].includes(name)
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.newFoodName.trim() || !form.newPortion.trim()) return;
    try {
      await swap.mutateAsync({ mealItemId: item.id, data: form });
      addToast(`Swapped to ${form.newFoodName}`, 'success');
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Swap failed. Check nutritional values are within range.';
      addToast(msg, 'error');
    }
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Food Name *</label>
          <input
            name="newFoodName"
            value={form.newFoodName}
            onChange={handleChange}
            placeholder="e.g. Greek Yogurt"
            className={inputCls}
            required
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Portion *</label>
          <input
            name="newPortion"
            value={form.newPortion}
            onChange={handleChange}
            placeholder="e.g. 150g"
            className={inputCls}
            required
          />
        </div>
        {(['newCalories', 'newProtein', 'newCarbs', 'newFats'] as const).map((field) => {
          const labels: Record<string, string> = {
            newCalories: 'Calories (kcal)',
            newProtein: 'Protein (g)',
            newCarbs: 'Carbs (g)',
            newFats: 'Fats (g)',
          };
          return (
            <div key={field}>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{labels[field]}</label>
              <input
                name={field}
                type="number"
                min="0"
                value={form[field]}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
        {EQUIVALENCE_NOTE}
      </p>

      <button
        type="submit"
        disabled={swap.isPending || !form.newFoodName.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
      >
        {swap.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        {swap.isPending ? 'Swapping…' : 'Confirm Swap'}
      </button>
    </form>
  );
}

interface Props {
  item: PlannedMealItem;
  playerId: number;
  onClose: () => void;
}

export function SwapModal({ item, playerId, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-indigo-400" />
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Swap Food Item</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {/* Current item */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 mb-1">
            <p className="text-xs text-gray-400 mb-1">Currently</p>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.foodName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {item.portion} · {item.calories} kcal · P:{item.protein}g C:{item.carbs}g F:{item.fats}g
            </p>
          </div>

          <ManualSwapForm item={item} playerId={playerId} onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
