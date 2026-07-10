import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutTemplate, ChevronDown, Plus, Trash2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { CreateTemplateModal } from './CreateTemplateModal';
import { useAssessmentTemplates, useDeleteTemplate } from '../../hooks/useAssessmentTemplates';
import { assessmentTemplatesApi } from '../../api/assessmentTemplatesApi';
import { useToast } from '../../context/ToastContext';
import type { StatCategory, AssessmentTemplate, AppliedTemplate } from '../../types';

interface Props {
  sportId: number;
  playerId: number;
  statCategories: StatCategory[];
  currentScores: Record<number, number | null>;
  onApply: (applied: AppliedTemplate) => void;
}

export function AssessmentTemplateBar({ sportId, playerId, statCategories, currentScores, onApply }: Props) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const { data: templates = [] } = useAssessmentTemplates(sportId, !!sportId);
  const deleteTemplate = useDeleteTemplate();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  async function apply(t: AssessmentTemplate) {
    setApplyingId(t.id);
    try {
      const applied = await assessmentTemplatesApi.apply(t.id, playerId);
      onApply(applied);
      addToast(tr('assessment.templateLoaded', 'Loaded "{{name}}"', { name: t.name }), 'success');
      setOpen(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('assessment.templateLoadFailed', 'Failed to load template'), 'error');
    } finally {
      setApplyingId(null);
    }
  }

  async function remove(t: AssessmentTemplate) {
    if (!confirm(tr('assessment.templateDeleteConfirm', 'Delete template "{{name}}"?', { name: t.name }))) return;
    try {
      await deleteTemplate.mutateAsync(t.id);
      addToast(tr('assessment.templateDeleted', 'Template deleted'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('common.error', 'Failed'), 'error');
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
        <LayoutTemplate size={15} /> {tr('assessment.templates', 'Templates')} <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-1 w-72 z-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1.5">
            <button onClick={() => { setCreateOpen(true); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer">
              <Plus size={15} /> {tr('assessment.saveCurrentAsTemplate', 'Save current as template')}
            </button>
            {templates.length > 0 && <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />}
            {templates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">{tr('assessment.noTemplatesForSport', 'No templates yet for this sport.')}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{tr('assessment.loadTemplate', 'Load template')}</p>
                {templates.map(t => (
                  <div key={t.id} className="group flex items-center gap-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <button onClick={() => apply(t)} disabled={applyingId === t.id}
                      className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left cursor-pointer">
                      <Check size={13} className={clsx('flex-shrink-0', applyingId === t.id ? 'text-indigo-500 animate-pulse' : 'text-gray-300 dark:text-gray-600')} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.name}</span>
                        <span className="block text-[11px] text-gray-400">{t.scores.filter(s => s.defaultScore != null).length} {tr('assessment.defaults', 'defaults')} · {t.scores.filter(s => s.isRequired).length} {tr('assessment.requiredCount', 'required')}</span>
                      </span>
                    </button>
                    <button onClick={() => remove(t)} className="p-1.5 mr-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer" title={tr('common.delete', 'Delete')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <CreateTemplateModal isOpen={createOpen} onClose={() => setCreateOpen(false)}
        sportId={sportId} statCategories={statCategories} initialScores={currentScores} />
    </div>
  );
}
