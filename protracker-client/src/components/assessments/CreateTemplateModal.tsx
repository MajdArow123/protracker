import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateTemplate, useUpdateTemplate } from '../../hooks/useAssessmentTemplates';
import { useToast } from '../../context/ToastContext';
import type { StatCategory, AssessmentTemplate } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sportId: number;
  statCategories: StatCategory[];
  // Pre-fill default scores from the coach's current sliders (Save as Template).
  initialScores?: Record<number, number | null>;
  template?: AssessmentTemplate | null; // edit mode
}

interface Row { defaultScore: string; required: boolean; }

export function CreateTemplateModal({ isOpen, onClose, sportId, statCategories, initialScores, template }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isEdit = !!template;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [rows, setRows] = useState<Record<number, Row>>({});

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setDefaultNotes(template?.defaultNotes ?? '');
    const next: Record<number, Row> = {};
    for (const c of statCategories) {
      const fromTemplate = template?.scores.find(s => s.sportStatCategoryId === c.id);
      const def = fromTemplate ? fromTemplate.defaultScore : initialScores?.[c.id] ?? null;
      next[c.id] = {
        defaultScore: def != null ? String(def) : '',
        required: fromTemplate?.isRequired ?? false,
      };
    }
    setRows(next);
  }, [isOpen, template, statCategories, initialScores]);

  async function handleSave() {
    if (!name.trim()) { addToast(t('assessment.templateNameRequired', 'A template name is required'), 'error'); return; }
    const scores = statCategories.map(c => {
      const r = rows[c.id] ?? { defaultScore: '', required: false };
      return {
        sportStatCategoryId: c.id,
        defaultScore: r.defaultScore.trim() ? Number(r.defaultScore) : null,
        isRequired: r.required,
      };
    });
    const data = { name: name.trim(), description: description.trim() || null, sportId, defaultNotes: defaultNotes.trim() || null, scores };
    try {
      if (isEdit && template) await updateTemplate.mutateAsync({ id: template.id, data });
      else await createTemplate.mutateAsync(data);
      addToast(isEdit ? t('assessment.templateUpdated', 'Template updated') : t('assessment.templateSaved', 'Template saved'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('assessment.templateSaveFailed', 'Failed to save template'), 'error');
    }
  }

  const saving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('assessment.editTemplate', 'Edit Template') : t('assessment.saveAsTemplate', 'Save as Template')} size="lg">
      <div className="space-y-4">
        <Input label={t('assessment.templateName', 'Template name')} placeholder={t('assessment.templateNamePlaceholder', 'e.g. Preseason baseline')} value={name} onChange={e => setName(e.target.value)} autoFocus />
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('assessment.descriptionOptional', 'Description (optional)')}</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('assessment.templateDescPlaceholder', 'What this template is for…')}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('assessment.defaultNotesOptional', 'Default notes (optional)')}</label>
          <textarea rows={2} value={defaultNotes} onChange={e => setDefaultNotes(e.target.value)} placeholder={t('assessment.defaultNotesPlaceholder', 'Notes pre-filled when this template is used…')}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('assessment.categories', 'Categories')}</p>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr,80px,80px] gap-2 px-1 text-[11px] font-medium text-gray-400">
              <span>{t('common.category', 'Category')}</span><span className="text-center">{t('assessment.default', 'Default')}</span><span className="text-center">{t('common.required', 'Required')}</span>
            </div>
            {statCategories.map(c => {
              const r = rows[c.id] ?? { defaultScore: '', required: false };
              return (
                <div key={c.id} className="grid grid-cols-[1fr,80px,80px] gap-2 items-center rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5">
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{c.name}</span>
                  <input type="number" min={0} max={10} step={0.5} value={r.defaultScore}
                    onChange={e => setRows(prev => ({ ...prev, [c.id]: { ...r, defaultScore: e.target.value } }))}
                    placeholder="—"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-center text-gray-900 dark:text-white" />
                  <button type="button" onClick={() => setRows(prev => ({ ...prev, [c.id]: { ...r, required: !r.required } }))}
                    className={clsx('mx-auto w-5 h-5 rounded flex items-center justify-center cursor-pointer',
                      r.required ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600')}>
                    {r.required && '✓'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving', 'Saving…') : isEdit ? t('assessment.saveChanges', 'Save Changes') : t('assessment.saveTemplate', 'Save Template')}</Button>
        </div>
      </div>
    </Modal>
  );
}
