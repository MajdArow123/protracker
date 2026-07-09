import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Trophy, Swords, Medal, Globe, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSports } from '../../hooks/useSports';
import { useCreateLeague, useUpdateLeague } from '../../hooks/useLeagues';
import { LEAGUE_TYPES, LEAGUE_FORMATS } from '../../utils/leagueMeta';
import type { LeagueType, LeagueFormat, LeagueDetail } from '../../types';

const TYPE_ICONS: Record<LeagueType, typeof Trophy> = { League: Trophy, Tournament: Swords, Cup: Medal };

function toDateInput(s?: string | null) {
  return s ? new Date(s).toISOString().slice(0, 10) : '';
}

// Doubles as create (no `editLeague`) and edit (with `editLeague`).
export function CreateLeagueModal({ isOpen, onClose, onCreated, editLeague }: {
  isOpen: boolean; onClose: () => void; onCreated?: (id: number) => void; editLeague?: LeagueDetail;
}) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const { data: sports = [] } = useSports();
  const create = useCreateLeague();
  const update = useUpdateLeague(editLeague?.id ?? 0);
  const isEdit = !!editLeague;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<LeagueType>('League');
  const [format, setFormat] = useState<LeagueFormat>('RoundRobin');
  const [sportId, setSportId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxTeams, setMaxTeams] = useState('');
  const [location, setLocation] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [rules, setRules] = useState('');
  const [prize, setPrize] = useState('');
  const [error, setError] = useState('');

  // Lock sport to the coach's own sport when we can infer it.
  const coachSportName = (user as { sportName?: string } | null)?.sportName;
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editLeague) {
      setName(editLeague.name); setDescription(editLeague.description ?? '');
      setType(editLeague.type); setFormat(editLeague.format); setSportId(editLeague.sportId);
      setStartDate(toDateInput(editLeague.startDate)); setEndDate(toDateInput(editLeague.endDate));
      setMaxTeams(editLeague.maxTeams != null ? String(editLeague.maxTeams) : '');
      setLocation(editLeague.location ?? ''); setIsPublic(editLeague.isPublic);
      setRules(editLeague.rules ?? ''); setPrize(editLeague.prizeDescription ?? '');
      return;
    }
    setName(''); setDescription(''); setType('League'); setFormat('RoundRobin');
    setStartDate(''); setEndDate(''); setMaxTeams(''); setLocation(''); setIsPublic(true);
    setRules(''); setPrize(''); setError('');
    const own = sports.find(s => s.name === coachSportName);
    setSportId(own?.id ?? sports[0]?.id ?? null);
  }, [isOpen, sports, coachSportName, editLeague]);

  const submit = async () => {
    if (!name.trim()) { setError('League name is required.'); return; }
    if (!sportId) { setError('Please select a sport.'); return; }
    setError('');
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      sportId,
      type,
      format,
      startDate: startDate || null,
      endDate: endDate || null,
      maxTeams: maxTeams ? Number(maxTeams) : null,
      location: location.trim() || null,
      isPublic,
      rules: rules.trim() || null,
      prizeDescription: prize.trim() || null,
    };
    try {
      if (editLeague) {
        await update.mutateAsync({ ...payload, status: editLeague.status });
        addToast('League updated', 'success');
      } else {
        const league = await create.mutateAsync(payload);
        addToast('League created', 'success');
        onCreated?.(league.id);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save league.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit league' : 'Create a league'} size="lg">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. City Summer League" autoFocus />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {/* Type cards */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {LEAGUE_TYPES.map(t => {
              const Icon = TYPE_ICONS[t.value];
              return (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={clsx('p-3 rounded-xl border text-left transition-all cursor-pointer',
                    type === t.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300')}>
                  <Icon size={18} className={clsx('mb-1', type === t.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400')} />
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.label}</div>
                  <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
          <div className="grid grid-cols-2 gap-2">
            {LEAGUE_FORMATS.map(f => (
              <button key={f.value} type="button" onClick={() => setFormat(f.value)}
                className={clsx('p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                  format === f.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300')}>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{f.label}</div>
                <div className="text-[11px] text-gray-500 leading-tight">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sport</label>
            <select value={sportId ?? ''} onChange={e => setSportId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max teams (optional)</label>
            <Input type="number" min={2} value={maxTeams} onChange={e => setMaxTeams(e.target.value)} placeholder="e.g. 8" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End date</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Location</label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rules</label>
          <textarea value={rules} onChange={e => setRules(e.target.value)} rows={2} placeholder="Optional"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prize (optional)</label>
          <Input value={prize} onChange={e => setPrize(e.target.value)} placeholder="e.g. Trophy + medals" />
        </div>

        <button type="button" onClick={() => setIsPublic(v => !v)}
          className="flex items-center gap-3 w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer text-left">
          {isPublic ? <Globe size={18} className="text-indigo-500" /> : <Lock size={18} className="text-gray-400" />}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{isPublic ? 'Public league' : 'Private league'}</div>
            <div className="text-xs text-gray-500">{isPublic ? 'Visible in Browse Leagues; any coach can register.' : 'Only visible to you and registered teams.'}</div>
          </div>
          <div className={clsx('relative w-11 h-6 rounded-full transition-colors flex-shrink-0', isPublic ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600')}>
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', isPublic && 'translate-x-5')} />
          </div>
        </button>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={create.isPending || update.isPending}>{isEdit ? 'Save Changes' : 'Create League'}</Button>
        </div>
      </div>
    </Modal>
  );
}
