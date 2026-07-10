import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useSports } from '../../hooks/useSports';
import { useCreateDrill, useUpdateDrill } from '../../hooks/useDrills';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_ORDER, DIFFICULTY_ORDER, CATEGORY_LABEL, CATEGORY_BADGE, DIFFICULTY_BADGE, SPORT_SHORT } from './drillUtils';
import type { Drill, DrillCategory, DrillDifficulty } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  drill?: Drill | null;
  // For a solo athlete / single-sport coach, lock the sport selection.
  defaultSportId?: number;
}

export function CreateDrillModal({ isOpen, onClose, drill, defaultSportId }: Props) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const { data: sports = [] } = useSports();
  const createDrill = useCreateDrill();
  const updateDrill = useUpdateDrill();
  const isEdit = !!drill;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sportIds, setSportIds] = useState<number[]>([]);
  const [category, setCategory] = useState<DrillCategory>('Technical');
  const [difficulty, setDifficulty] = useState<DrillDifficulty>('Beginner');
  const [duration, setDuration] = useState('');
  const [equipment, setEquipment] = useState('');
  const [instructions, setInstructions] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(drill?.name ?? '');
    setDescription(drill?.description ?? '');
    setSportIds(drill?.sportIds ?? (defaultSportId ? [defaultSportId] : []));
    setCategory(drill?.category ?? 'Technical');
    setDifficulty(drill?.difficulty ?? 'Beginner');
    setDuration(drill?.durationMinutes != null ? String(drill.durationMinutes) : '');
    setEquipment(drill?.equipment ?? '');
    setInstructions(drill?.instructions ?? '');
    setVideoUrl(drill?.videoUrl ?? '');
    setTargets(drill?.targetStatCategories ?? []);
    setTagInput('');
  }, [isOpen, drill, defaultSportId]);

  function toggleSport(id: number) {
    setSportIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function addTag() {
    const t = tagInput.trim().replace(/,/g, '');
    if (t && !targets.some(x => x.toLowerCase() === t.toLowerCase())) setTargets(prev => [...prev, t]);
    setTagInput('');
  }

  async function handleSubmit() {
    if (!name.trim()) { addToast(tr('drills.nameRequired', 'A drill name is required'), 'error'); return; }
    if (sportIds.length === 0) { addToast(tr('drills.selectSport', 'Select at least one sport'), 'error'); return; }
    const data = {
      name: name.trim(),
      description: description.trim() || null,
      sportIds,
      category, difficulty,
      durationMinutes: duration.trim() ? Number(duration) : null,
      equipment: equipment.trim() || null,
      instructions: instructions.trim() || null,
      videoUrl: videoUrl.trim() || null,
      targetStatCategories: targets,
    };
    try {
      if (isEdit && drill) { await updateDrill.mutateAsync({ id: drill.id, data }); addToast(tr('drills.drillUpdated', 'Drill updated'), 'success'); }
      else { await createDrill.mutateAsync(data); addToast(tr('drills.drillCreated', 'Drill created'), 'success'); }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('drills.failedSave', 'Failed to save drill'), 'error');
    }
  }

  const saving = createDrill.isPending || updateDrill.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? tr('drills.editDrill', 'Edit Drill') : tr('drills.createDrill', 'Create Drill')} size="lg">
      <div className="space-y-4">
        <Input label={tr('common.name', 'Name')} placeholder={tr('drills.namePlaceholder', 'e.g. Passing Triangle')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('common.description', 'Description')}</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('drills.descriptionPlaceholder', 'Short summary of the drill…')}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
        </div>

        {/* Sports (multi-select) */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('drills.sports', 'Sports')}</p>
          <div className="flex flex-wrap gap-2">
            {sports.map(s => (
              <button key={s.id} type="button" onClick={() => toggleSport(s.id)}
                className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                  sportIds.includes(s.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:opacity-80')}>
                {L.sport(SPORT_SHORT[s.id] ?? s.name)}
              </button>
            ))}
          </div>
        </div>

        {/* Category + difficulty */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('common.category', 'Category')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ORDER.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={clsx('px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
                    category === c ? CATEGORY_BADGE[c] + ' ring-2 ring-current ring-offset-1 dark:ring-offset-gray-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400')}>
                  {L.category(CATEGORY_LABEL[c])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('drills.difficulty', 'Difficulty')}</p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_ORDER.map(d => (
                <button key={d} type="button" onClick={() => setDifficulty(d)}
                  className={clsx('px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
                    difficulty === d ? DIFFICULTY_BADGE[d] + ' ring-2 ring-current ring-offset-1 dark:ring-offset-gray-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400')}>
                  {L.difficulty(d)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input label={tr('drills.durationMinutes', 'Duration (minutes)')} type="number" placeholder="15" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <Input label={tr('drills.equipment', 'Equipment')} placeholder={tr('drills.equipmentPlaceholder', 'Cones, Ball')} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('drills.instructions', 'Instructions')}</label>
          <textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder={tr('drills.instructionsPlaceholder', 'One step per line, e.g.\n1. Set three cones in a triangle.\n2. Pass and follow your pass.')}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
        </div>

        <Input label={tr('drills.videoUrl', 'Video URL (optional)')} placeholder="https://youtube.com/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />

        {/* Target stat categories */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('drills.targetsImprovement', 'Targets improvement in')}</label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5">
            {targets.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                {t}
                <button type="button" onClick={() => setTargets(prev => prev.filter(x => x !== t))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
              </span>
            ))}
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
              onBlur={addTag}
              placeholder={targets.length ? '' : tr('drills.targetsPlaceholder', 'e.g. Passing, Ball Control')}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-white outline-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? tr('common.saving', 'Saving…') : isEdit ? tr('common.saveChanges', 'Save Changes') : tr('drills.createDrill', 'Create Drill')}</Button>
        </div>
      </div>
    </Modal>
  );
}
