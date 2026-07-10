import { useState, useEffect } from 'react';
import { Star, Lock, Users, X, Lightbulb, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUpsertJournal, useUpdateJournal } from '../../hooks/useJournal';
import { useToast } from '../../context/ToastContext';
import { MOODS, MOOD_CONFIG, randomPrompt, parseTags } from './journalUtils';
import type { JournalPrompt } from './journalUtils';
import type { JournalEntry, JournalMood } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // The entry being edited (past entry → PUT, or today's existing entry). Null = new today entry.
  entry?: JournalEntry | null;
}

export function JournalEntryModal({ isOpen, onClose, entry }: Props) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const { addToast } = useToast();
  const upsert = useUpsertJournal();
  const update = useUpdateJournal();

  const [mood, setMood] = useState<JournalMood>('Okay');
  const [energy, setEnergy] = useState(3);
  const [rating, setRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [keyLearning, setKeyLearning] = useState('');
  const [tomorrowFocus, setTomorrowFocus] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [prompt, setPrompt] = useState<JournalPrompt>(randomPrompt());
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setMood(entry?.mood ?? 'Okay');
    setEnergy(entry?.energyLevel ?? 3);
    setRating(entry?.trainingRating ?? null);
    setContent(entry?.content ?? '');
    setKeyLearning(entry?.keyLearning ?? '');
    setTomorrowFocus(entry?.tomorrowFocus ?? '');
    setTags(parseTags(entry?.tags));
    setTagInput('');
    setIsPrivate(entry?.isPrivate ?? true);
    setPrompt(randomPrompt());
    setShowPrompt(true);
  }, [isOpen, entry]);

  function addTag() {
    const tag = tagInput.trim().replace(/,/g, '');
    if (tag && !tags.some(x => x.toLowerCase() === tag.toLowerCase())) setTags(prev => [...prev, tag]);
    setTagInput('');
  }

  async function handleSave() {
    if (!content.trim() && !keyLearning.trim() && !tomorrowFocus.trim()) {
      addToast(tr('journal.writeSomething', 'Write something before saving'), 'error');
      return;
    }
    const data = {
      content: content.trim(),
      mood,
      energyLevel: energy,
      trainingRating: rating,
      keyLearning: keyLearning.trim() || null,
      tomorrowFocus: tomorrowFocus.trim() || null,
      tags: tags.length ? tags.join(',') : null,
      isPrivate,
    };
    try {
      if (entry?.id) await update.mutateAsync({ id: entry.id, data });
      else await upsert.mutateAsync(data);
      addToast(tr('journal.entrySaved', 'Entry saved'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('journal.failedSave', 'Failed to save entry'), 'error');
    }
  }

  const saving = upsert.isPending || update.isPending;
  const dateLabel = formatDate(entry?.entryDate ?? new Date().toISOString(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entry?.id ? tr('journal.editEntry', 'Edit Entry') : tr('journal.todaysEntry', "Today's Entry")} size="lg">
      <div className="space-y-5">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{dateLabel}</p>

        {/* Mood */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('journal.moodQuestion', 'How was your mood?')}</p>
          <div className="flex gap-2">
            {MOODS.map((m) => {
              const cfg = MOOD_CONFIG[m];
              const Icon = cfg.icon;
              const active = mood === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={clsx(
                    'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all cursor-pointer',
                    active ? `${cfg.bg} border-current ${cfg.color}` : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300',
                  )}
                >
                  <Icon size={22} className={active ? cfg.color : ''} />
                  <span className={clsx('text-xs font-medium', active ? cfg.color : 'text-gray-500 dark:text-gray-400')}>{L.mood(m)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Energy */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('journal.energyLevel', 'Energy level')}</p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEnergy(n)}
                className={clsx('w-8 h-8 rounded-full transition-all cursor-pointer',
                  n <= energy ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300')}
                aria-label={tr('journal.energyAria', 'Energy {{n}}', { n })}
              />
            ))}
            <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">{energy}/5</span>
          </div>
        </div>

        {/* Training rating */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('journal.trainingRating', 'Training rating')} <span className="text-gray-400 font-normal">{tr('journal.optionalParen', '(optional)')}</span></p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} className="cursor-pointer p-0.5" aria-label={tr('journal.rateAria', 'Rate {{n}}', { n })}>
                <Star size={22} className={n <= (rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
              </button>
            ))}
            {rating != null && <button type="button" onClick={() => setRating(null)} className="ml-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">{tr('common.clear', 'Clear')}</button>}
          </div>
        </div>

        {/* Main entry + prompt */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('journal.howDidTodayGo', 'How did today go?')}</label>
          {!content.trim() && showPrompt && (
            <div className="mt-1.5 flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2 text-sm text-indigo-600 dark:text-indigo-300">
              <span className="flex items-center gap-1.5"><Lightbulb size={14} /> {tr(prompt.key, prompt.text)}</span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => setPrompt(randomPrompt(prompt.key))} className="p-1 hover:text-indigo-800 dark:hover:text-indigo-100 cursor-pointer" title={tr('journal.newPrompt', 'New prompt')}><RefreshCw size={13} /></button>
                <button type="button" onClick={() => setShowPrompt(false)} className="p-1 hover:text-indigo-800 dark:hover:text-indigo-100 cursor-pointer" title={tr('common.dismiss', 'Dismiss')}><X size={13} /></button>
              </span>
            </div>
          )}
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={tr('journal.contentPlaceholder', 'Write about your training, how you felt, what happened…')}
            className="mt-1.5 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('journal.keyLearning', 'Key learning')}</label>
            <textarea rows={2} value={keyLearning} onChange={(e) => setKeyLearning(e.target.value)} placeholder={tr('journal.keyLearningPlaceholder', 'What I learned today…')}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('journal.tomorrowFocus', "Tomorrow's focus")}</label>
            <textarea rows={2} value={tomorrowFocus} onChange={(e) => setTomorrowFocus(e.target.value)} placeholder={tr('journal.tomorrowFocusPlaceholder', "What I'll focus on…")}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('journal.tags', 'Tags')}</label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                {tag}
                <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== tag))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
              onBlur={addTag}
              placeholder={tags.length ? '' : tr('journal.tagPlaceholder', 'Type a tag and press Enter')}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Privacy */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('journal.visibility', 'Visibility')}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsPrivate(true)}
              className={clsx('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer',
                isPrivate ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600 text-gray-500')}>
              <Lock size={15} /> {tr('journal.privateOnlyYou', 'Private (only you)')}
            </button>
            <button type="button" onClick={() => setIsPrivate(false)}
              className={clsx('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer',
                !isPrivate ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600 text-gray-500')}>
              <Users size={15} /> {tr('journal.shareWithCoach', 'Share with coach')}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tr('common.saving', 'Saving…') : tr('journal.saveEntry', 'Save Entry')}</Button>
        </div>
      </div>
    </Modal>
  );
}
