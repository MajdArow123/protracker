import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useLogGoalProgress } from '../../hooks/useGoals';
import { useToast } from '../../context/useToast';
import type { PersonalGoal } from '../../types';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  goal: PersonalGoal | null;
}

export function LogProgressModal({ isOpen, onClose, goal }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const logProgress = useLogGoalProgress();

  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValue(goal?.currentValue != null ? String(goal.currentValue) : '');
      setNote('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen, goal]);

  if (!goal) return null;

  async function handleSave() {
    if (!goal) return;
    if (value.trim() === '' || isNaN(Number(value))) {
      addToast(t('goals.enterNumeric', 'Enter a numeric value'), 'error');
      return;
    }
    try {
      await logProgress.mutateAsync({
        id: goal.id,
        data: { value: Number(value), note: note.trim() || null, recordedAt: date || null },
      });
      addToast(t('goals.progressLogged', 'Progress logged'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('goals.failedLog', 'Failed to log progress'), 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('goals.logProgress', 'Log Progress')}>
      <div className="space-y-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-3">
          <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium uppercase tracking-wide">{t('goals.goalLabel', 'Goal')}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{goal.title}</p>
          {goal.targetValue != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('goals.targetColon', 'Target:')} {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}
              {goal.currentValue != null && ` · ${t('goals.currentColon', 'Current:')} ${goal.currentValue}`}
            </p>
          )}
        </div>

        <Input
          label={goal.unit ? t('goals.valueWithUnit', 'Value ({{unit}})', { unit: goal.unit }) : t('goals.value', 'Value')}
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('goals.noteOptional', 'Note (optional)')}</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('goals.notePlaceholder', 'How did it go?')}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
          />
        </div>

        <Input label={t('common.date', 'Date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={logProgress.isPending}>
            {logProgress.isPending ? t('common.saving', 'Saving…') : t('goals.saveProgress', 'Save Progress')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
