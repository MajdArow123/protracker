import { useState } from 'react';
import {
  CheckCircle2, Circle, Lock, Pencil, Trash2, TrendingUp, ChevronDown, ChevronUp,
  Calendar, Trophy, Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAchieveGoal, useDeleteGoal, useAchieveMilestone } from '../../hooks/useGoals';
import { useToast } from '../../context/ToastContext';
import { GoalProgressChart } from './GoalProgressChart';
import { GoalRecommendedDrills } from '../drills/GoalRecommendedDrills';
import {
  CATEGORY_BADGE, STATUS_BADGE, PRIORITY_BORDER, progressColor, completionPercent, formatDate, daysUntil,
} from './goalUtils';
import type { PersonalGoal } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface Props {
  goal: PersonalGoal;
  canManage: boolean;
  showPlayerName?: boolean;
  sportId?: number;
  onEdit: (goal: PersonalGoal) => void;
  onLogProgress: (goal: PersonalGoal) => void;
}

export function GoalCard({ goal, canManage, showPlayerName, sportId, onEdit, onLogProgress }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const achieve = useAchieveGoal();
  const del = useDeleteGoal();
  const toggleMilestone = useAchieveMilestone();
  const [showChart, setShowChart] = useState(false);
  const [showAllMilestones, setShowAllMilestones] = useState(false);

  const isAchieved = goal.status === 'Achieved';
  const pct = completionPercent(goal);
  const visibleMilestones = showAllMilestones ? goal.milestones : goal.milestones.slice(0, 3);

  async function handleAchieve() {
    try {
      await achieve.mutateAsync(goal.id);
      addToast(t('goals.goalAchievedToast', 'Goal achieved! 🎉'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.failed', 'Failed'), 'error');
    }
  }

  async function handleDelete() {
    if (!confirm(t('goals.deleteConfirm', 'Delete goal "{{title}}"?', { title: goal.title }))) return;
    try {
      await del.mutateAsync(goal.id);
      addToast(t('goals.goalDeleted', 'Goal deleted'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.failed', 'Failed'), 'error');
    }
  }

  const due = goal.targetDate ? daysUntil(goal.targetDate) : null;

  return (
    <div className={clsx(
      'group bg-white dark:bg-gray-800 rounded-xl border-l-4 border border-gray-200 dark:border-gray-700 shadow-sm p-4 transition-all',
      PRIORITY_BORDER[goal.priority],
      isAchieved && 'opacity-75',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isAchieved && <Trophy size={16} className="text-green-500 flex-shrink-0" />}
            <h3 className={clsx('font-semibold text-gray-900 dark:text-white', isAchieved && 'line-through decoration-green-500/50')}>
              {goal.title}
            </h3>
            {goal.isPrivate && <Lock size={13} className="text-gray-400 flex-shrink-0" />}
          </div>
          {showPlayerName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{goal.playerName}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', CATEGORY_BADGE[goal.category])}>
              {L.category(goal.category)}
            </span>
            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_BADGE[goal.status])}>
              {L.status(goal.status)}
            </span>
            {goal.linkedStatCategoryName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                <Sparkles size={10} /> {goal.linkedStatCategoryName}
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onEdit(goal)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" title={t('common.edit', 'Edit')}>
              <Pencil size={15} />
            </button>
            <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" title={t('common.delete', 'Delete')}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {pct != null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">
              {goal.targetValue != null
                ? `${goal.currentValue ?? 0} / ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`
                : t('goals.milestonesCount', '{{done}} / {{total}} milestones', { done: goal.milestones.filter(m => m.isAchieved).length, total: goal.milestones.length })}
            </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', progressColor(pct))} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          {goal.targetDate
            ? isAchieved
              ? t('goals.achievedOn', 'Achieved {{date}}', { date: goal.achievedAt ? formatDate(goal.achievedAt) : '' })
              : due != null && due < 0 ? <span className="text-red-500">{t('goals.overdueDate', 'Overdue · {{date}}', { date: formatDate(goal.targetDate) })}</span> : t('goals.dueDate', 'Due {{date}}', { date: formatDate(goal.targetDate) })
            : t('goals.noDeadline', 'No deadline')}
        </span>
      </div>

      {/* Description */}
      {goal.description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{goal.description}</p>
      )}

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <div className="mt-3 space-y-1">
          {visibleMilestones.map((m) => (
            <button
              key={m.id}
              disabled={!canManage || toggleMilestone.isPending}
              onClick={() => canManage && toggleMilestone.mutate({ id: goal.id, mid: m.id })}
              className={clsx('w-full flex items-center gap-2 text-sm text-left py-0.5', canManage && 'cursor-pointer hover:opacity-80')}
            >
              {m.isAchieved
                ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                : <Circle size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
              <span className={clsx(m.isAchieved ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300')}>
                {m.title}{m.targetValue != null ? ` — ${m.targetValue}` : ''}
              </span>
            </button>
          ))}
          {goal.milestones.length > 3 && (
            <button onClick={() => setShowAllMilestones(v => !v)} className="text-xs text-indigo-500 hover:underline cursor-pointer">
              {showAllMilestones ? t('common.showLess', 'Show less') : t('goals.seeMore', 'See {{count}} more', { count: goal.milestones.length - 3 })}
            </button>
          )}
        </div>
      )}

      {/* Recommended drills (goals → drills → tasks) */}
      {goal.linkedStatCategoryName && sportId && (
        <GoalRecommendedDrills goal={goal} sportId={sportId} canAssign={canManage} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        {canManage && !isAchieved && (
          <>
            <button
              onClick={() => onLogProgress(goal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 cursor-pointer"
            >
              <TrendingUp size={14} /> {t('goals.logProgress', 'Log Progress')}
            </button>
            <button
              onClick={handleAchieve}
              disabled={achieve.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 cursor-pointer"
            >
              <CheckCircle2 size={14} /> {t('goals.markAchieved', 'Mark as Achieved')}
            </button>
          </>
        )}
        <button
          onClick={() => setShowChart(v => !v)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ml-auto"
        >
          {showChart ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {t('goals.progress', 'Progress')}
        </button>
      </div>

      {showChart && <GoalProgressChart goal={goal} />}
    </div>
  );
}
