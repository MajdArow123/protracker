import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, CalendarDays, MapPin, Clock } from 'lucide-react';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/useToast';
import { useTeamSessions, useCreateSession, useUpdateSession, useDeleteSession } from '../../hooks/useSessions';
import { useSoloSessions, useCreateSoloSession } from '../../hooks/useSolo';
import { CoachSessionFeedbackPanel } from './CoachSessionFeedbackPanel';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { ScheduledSession, SessionType } from '../../types';

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'Training', label: 'Training' },
  { value: 'MatchPrep', label: 'Match Prep' },
  { value: 'Recovery', label: 'Recovery' },
  { value: 'Strength', label: 'Strength' },
  { value: 'Tactical', label: 'Tactical' },
  { value: 'Other', label: 'Other' },
];

const TYPE_STYLES: Record<SessionType, string> = {
  Training: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  MatchPrep: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  Recovery: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Strength: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  Tactical: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

// Monday-based start of the week containing `d`.
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = (r.getDay() + 6) % 7; // 0 = Monday
  r.setDate(r.getDate() - day);
  return r;
}

function toLocalInput(s: string) {
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Create / edit modal ──────────────────────────────────────────────────────
function SessionModal({ teamId, solo, session, defaultDate, isOpen, onClose }: {
  teamId?: number; solo?: boolean; session: ScheduledSession | null; defaultDate: Date | null; isOpen: boolean; onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const createSession = useCreateSession();
  const createSoloSession = useCreateSoloSession();
  const updateSession = useUpdateSession();
  const isEdit = !!session;

  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('Training');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDuration] = useState('90');
  const [location, setLocation] = useState('');
  const [focus, setFocus] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (session) {
      setTitle(session.title);
      setSessionType(session.sessionType);
      setStartTime(toLocalInput(session.startTime));
      setDuration(String(session.durationMinutes));
      setLocation(session.location ?? '');
      setFocus(session.focus ?? '');
      setNotes(session.notes ?? '');
    } else {
      const base = defaultDate ? new Date(defaultDate) : new Date();
      if (defaultDate) base.setHours(17, 0, 0, 0);
      setTitle(''); setSessionType('Training'); setStartTime(toLocalInput(base.toISOString()));
      setDuration('90'); setLocation(''); setFocus(''); setNotes('');
    }
  }, [isOpen, session, defaultDate]);

  async function handleSubmit() {
    if (!title.trim()) { setError(tr('sessions.errTitleRequired', 'Title is required')); return; }
    if (!startTime) { setError(tr('sessions.errDateRequired', 'Date & time are required')); return; }
    const payload = {
      title: title.trim(),
      sessionType,
      startTime: new Date(startTime).toISOString(),
      durationMinutes: Number(durationMinutes) || 0,
      location: location.trim() || undefined,
      focus: focus.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (isEdit && session) {
        await updateSession.mutateAsync({ id: session.id, data: payload });
        addToast(tr('sessions.sessionUpdated', 'Session updated'), 'success');
      } else if (solo) {
        await createSoloSession.mutateAsync(payload);
        addToast(tr('sessions.sessionScheduled', 'Session scheduled'), 'success');
      } else {
        await createSession.mutateAsync({ teamId: teamId!, data: payload });
        addToast(tr('sessions.sessionScheduled', 'Session scheduled'), 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('sessions.saveFailed', 'Save failed'), 'error');
    }
  }

  const saving = createSession.isPending || createSoloSession.isPending || updateSession.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? tr('sessions.editSession', 'Edit Session') : tr('sessions.scheduleSession', 'Schedule Session')}>
      <div className="space-y-4">
        <Input label={tr('common.title', 'Title')} value={title} onChange={e => setTitle(e.target.value)} placeholder={tr('sessions.titlePlaceholder', 'e.g. Speed & Agility')} />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('common.type', 'Type')}</label>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setSessionType(t.value)}
                className={clsx('py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                  sessionType === t.value ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
                {L.sessionType(t.value)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={tr('sessions.dateTime', 'Date & Time')} type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label={tr('sessions.duration', 'Duration (min)')} type="number" min={0} value={durationMinutes} onChange={e => setDuration(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={tr('sessions.location', 'Location (optional)')} value={location} onChange={e => setLocation(e.target.value)} placeholder={tr('sessions.locationPlaceholder', 'Main Pitch')} />
          <Input label={tr('sessions.focus', 'Focus (optional)')} value={focus} onChange={e => setFocus(e.target.value)} placeholder={tr('sessions.focusPlaceholder', 'Finishing')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('common.notes', 'Notes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={tr('sessions.notesPlaceholder', 'Session details…')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} isLoading={saving}>{isEdit ? tr('sessions.saveChanges', 'Save Changes') : tr('sessions.schedule', 'Schedule')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────
export function TeamScheduleSection({ teamId, isCoach, solo = false }: { teamId?: number; isCoach: boolean; solo?: boolean; }) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate, formatTime } = useLocaleFormat();
  const fmtTime = (s: string) => formatTime(s, { hour: 'numeric', minute: '2-digit' });
  const { data: teamSessions = [], isLoading: loadingTeam } = useTeamSessions(solo ? null : teamId);
  const { data: soloSessions = [], isLoading: loadingSolo } = useSoloSessions(solo);
  const sessions = solo ? soloSessions : teamSessions;
  const isLoading = solo ? loadingSolo : loadingTeam;
  const canManage = isCoach || solo;
  const deleteSession = useDeleteSession();
  const { addToast } = useToast();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<ScheduledSession | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledSession | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  function sessionsForDay(d: Date): ScheduledSession[] {
    return sessions
      .filter(s => {
        const sd = new Date(s.startTime);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  function shiftWeek(delta: number) {
    const w = new Date(weekStart); w.setDate(w.getDate() + delta * 7); setWeekStart(w);
  }

  function openCreate(day: Date | null) {
    setEditSession(null); setDefaultDate(day); setModalOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><CalendarDays size={16} className="text-indigo-400" /> {tr('sessions.trainingSchedule', 'Training Schedule')}</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button onClick={() => shiftWeek(-1)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"><ChevronLeft size={16} /></button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">{tr('common.today', 'Today')}</button>
            <button onClick={() => shiftWeek(1)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"><ChevronRight size={16} /></button>
          </div>
          {canManage && (
            <button onClick={() => openCreate(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer">
              <Plus size={13} /> {tr('sessions.schedule', 'Schedule')}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        {formatDate(weekStart, { month: 'short', day: 'numeric' })} – {formatDate(weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500">{tr('common.loading', 'Loading...')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {days.map((d, i) => {
            const daySessions = sessionsForDay(d);
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={i} className={clsx('rounded-xl border p-2 min-h-[120px]',
                isToday ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-800')}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-gray-400">{L.dayNames('short')[d.getDay()]}</p>
                    <p className={clsx('text-sm font-bold', isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white')}>{d.getDate()}</p>
                  </div>
                  {canManage && (
                    <button onClick={() => openCreate(d)} className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Plus size={13} /></button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {daySessions.map(s => (
                    <div key={s.id} className={clsx('group rounded-lg border px-2 py-1.5 text-left', TYPE_STYLES[s.sessionType])}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-bold leading-tight">{s.title}</p>
                        {canManage && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => { setEditSession(s); setDefaultDate(null); setModalOpen(true); }} className="p-0.5 hover:text-indigo-600 cursor-pointer"><Pencil size={11} /></button>
                            <button onClick={() => setDeleteTarget(s)} className="p-0.5 hover:text-red-600 cursor-pointer"><Trash2 size={11} /></button>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-medium opacity-80">{L.sessionType(s.sessionType)}</p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] opacity-90">
                        <Clock size={9} /> {fmtTime(s.startTime)} · {s.durationMinutes}m
                      </div>
                      {s.location && (
                        <div className="flex items-center gap-1 text-[10px] opacity-90"><MapPin size={9} /> {s.location}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Coach: athlete session feedback + analytics */}
      {!solo && isCoach && teamId != null && <CoachSessionFeedbackPanel teamId={teamId} />}

      {canManage && (
        <>
          <SessionModal teamId={teamId} solo={solo} session={editSession} defaultDate={defaultDate} isOpen={modalOpen}
            onClose={() => { setModalOpen(false); setEditSession(null); setDefaultDate(null); }} />
          <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
            onConfirm={async () => { if (!deleteTarget) return; try { await deleteSession.mutateAsync(deleteTarget.id); addToast(tr('sessions.sessionDeleted', 'Session deleted'), 'success'); } catch (err) { addToast(err instanceof Error ? err.message : tr('sessions.deleteFailed', 'Delete failed'), 'error'); } finally { setDeleteTarget(null); } }}
            title={tr('sessions.deleteSessionTitle', 'Delete Session')} message={tr('sessions.deleteSessionMsg', 'Delete "{{title}}"?', { title: deleteTarget?.title })} confirmLabel={tr('common.delete', 'Delete')} isLoading={deleteSession.isPending} />
        </>
      )}
    </div>
  );
}
