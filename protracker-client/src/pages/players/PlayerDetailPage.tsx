import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer, useDeletePlayer } from '../../hooks/usePlayers';
import { useInjuries, useCreateInjury, useUpdateInjury, useDeleteInjury } from '../../hooks/useInjuries';
import { useMatchPerformance, useCreateMatchPerformance, useUpdateMatchPerformance, useDeleteMatchPerformance } from '../../hooks/useMatchPerformance';
import { useTrainingSessions, useCreateTrainingSession, useUpdateTrainingSession, useDeleteTrainingSession } from '../../hooks/useTrainingSessions';
import { useTeams } from '../../hooks/useTeams';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PageSpinner } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft, Edit, ClipboardList, TrendingUp, Salad,
  Plus, Edit2, Trash2, Activity, Dumbbell, ShieldAlert
} from 'lucide-react';
import type { InjuryRecord, MatchPerformance, TrainingSession } from '../../types';

type Tab = 'overview' | 'injuries' | 'matches' | 'training';

const INJURY_SEVERITIES = ['Minor', 'Moderate', 'Severe'] as const;
const RECOVERY_STATUSES = ['Active', 'Recovering', 'FullyRecovered'] as const;
const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const;

const TEXTAREA_CLS = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none';

const SEVERITY_COLORS: Record<string, string> = {
  Minor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const RECOVERY_COLORS: Record<string, string> = {
  Active: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Recovering: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  FullyRecovered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const ATTENDANCE_COLORS: Record<string, string> = {
  Present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Late: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// ——————————————————————————————————————————————
// Injury inline form
// ——————————————————————————————————————————————
interface InjuryFormState {
  injuryDate: string;
  injuryType: string;
  severity: string;
  recoveryStatus: string;
  notes: string;
  expectedReturnDate: string;
}

const EMPTY_INJURY: InjuryFormState = {
  injuryDate: new Date().toISOString().split('T')[0],
  injuryType: '',
  severity: 'Minor',
  recoveryStatus: 'Active',
  notes: '',
  expectedReturnDate: '',
};

// ——————————————————————————————————————————————
// Match Performance inline form
// ——————————————————————————————————————————————
interface MatchFormState {
  matchDate: string;
  opponent: string;
  performanceRating: string;
  notes: string;
  sportSpecificStats: string;
}

const EMPTY_MATCH: MatchFormState = {
  matchDate: new Date().toISOString().split('T')[0],
  opponent: '',
  performanceRating: '7',
  notes: '',
  sportSpecificStats: '',
};

// ——————————————————————————————————————————————
// Training Session inline form
// ——————————————————————————————————————————————
interface TrainingFormState {
  date: string;
  durationMinutes: string;
  teamId: string;
  attendanceStatus: string;
  notes: string;
}

const EMPTY_TRAINING: TrainingFormState = {
  date: new Date().toISOString().split('T')[0],
  durationMinutes: '60',
  teamId: '',
  attendanceStatus: 'Present',
  notes: '',
};

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading } = usePlayer(playerId);
  const { data: teams = [] } = useTeams();
  const { data: injuries = [] } = useInjuries(playerId);
  const { data: matches = [] } = useMatchPerformance(playerId);
  const { data: sessions = [] } = useTrainingSessions(playerId);

  const createInjury = useCreateInjury();
  const updateInjury = useUpdateInjury();
  const deleteInjury = useDeleteInjury();
  const createMatch = useCreateMatchPerformance();
  const updateMatch = useUpdateMatchPerformance();
  const deleteMatch = useDeleteMatchPerformance();
  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const deletePlayer = useDeletePlayer();

  const [tab, setTab] = useState<Tab>('overview');

  // Injury state
  const [injuryForm, setInjuryForm] = useState<InjuryFormState>(EMPTY_INJURY);
  const [editingInjury, setEditingInjury] = useState<InjuryRecord | null>(null);
  const [showNewInjury, setShowNewInjury] = useState(false);
  const [deleteInjuryTarget, setDeleteInjuryTarget] = useState<InjuryRecord | null>(null);

  // Match state
  const [matchForm, setMatchForm] = useState<MatchFormState>(EMPTY_MATCH);
  const [editingMatch, setEditingMatch] = useState<MatchPerformance | null>(null);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [deleteMatchTarget, setDeleteMatchTarget] = useState<MatchPerformance | null>(null);

  // Training state
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>({
    ...EMPTY_TRAINING,
    teamId: player?.teamId?.toString() ?? '',
  });
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<TrainingSession | null>(null);

  // Delete player
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(false);

  // ——————— Injury handlers ———————
  function openNewInjury() {
    setEditingInjury(null);
    setInjuryForm(EMPTY_INJURY);
    setShowNewInjury(true);
  }
  function openEditInjury(r: InjuryRecord) {
    setEditingInjury(r);
    setInjuryForm({
      injuryDate: r.injuryDate,
      injuryType: r.injuryType,
      severity: r.severity,
      recoveryStatus: r.recoveryStatus,
      notes: r.notes ?? '',
      expectedReturnDate: r.expectedReturnDate ?? '',
    });
    setShowNewInjury(false);
  }
  async function saveInjury() {
    if (!injuryForm.injuryType.trim()) { showToast('Injury type required', 'error'); return; }
    const payload = {
      playerId,
      injuryDate: injuryForm.injuryDate,
      injuryType: injuryForm.injuryType,
      severity: injuryForm.severity as InjuryRecord['severity'],
      recoveryStatus: injuryForm.recoveryStatus as InjuryRecord['recoveryStatus'],
      notes: injuryForm.notes || undefined,
      expectedReturnDate: injuryForm.expectedReturnDate || undefined,
    };
    try {
      if (editingInjury) {
        await updateInjury.mutateAsync({ id: editingInjury.id, data: payload });
        showToast('Injury updated', 'success');
        setEditingInjury(null);
      } else {
        await createInjury.mutateAsync(payload as Parameters<typeof createInjury.mutateAsync>[0]);
        showToast('Injury recorded', 'success');
        setShowNewInjury(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  // ——————— Match handlers ———————
  function openNewMatch() {
    setEditingMatch(null);
    setMatchForm(EMPTY_MATCH);
    setShowNewMatch(true);
  }
  function openEditMatch(m: MatchPerformance) {
    setEditingMatch(m);
    setMatchForm({
      matchDate: m.matchDate,
      opponent: m.opponent,
      performanceRating: String(m.performanceRating),
      notes: m.notes ?? '',
      sportSpecificStats: m.sportSpecificStats ?? '',
    });
    setShowNewMatch(false);
  }
  async function saveMatch() {
    if (!matchForm.opponent.trim()) { showToast('Opponent required', 'error'); return; }
    const rating = Number(matchForm.performanceRating);
    if (isNaN(rating) || rating < 1 || rating > 10) { showToast('Rating must be 1–10', 'error'); return; }
    const payload = {
      playerId,
      matchDate: matchForm.matchDate,
      opponent: matchForm.opponent,
      performanceRating: rating,
      notes: matchForm.notes || undefined,
      sportSpecificStats: matchForm.sportSpecificStats || undefined,
    };
    try {
      if (editingMatch) {
        await updateMatch.mutateAsync({ id: editingMatch.id, data: payload });
        showToast('Match updated', 'success');
        setEditingMatch(null);
      } else {
        await createMatch.mutateAsync(payload as Parameters<typeof createMatch.mutateAsync>[0]);
        showToast('Match recorded', 'success');
        setShowNewMatch(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  // ——————— Training handlers ———————
  function openNewSession() {
    setEditingSession(null);
    setTrainingForm({ ...EMPTY_TRAINING, teamId: player?.teamId?.toString() ?? '' });
    setShowNewSession(true);
  }
  function openEditSession(s: TrainingSession) {
    setEditingSession(s);
    setTrainingForm({
      date: s.date,
      durationMinutes: String(s.durationMinutes),
      teamId: String(s.teamId),
      attendanceStatus: s.attendanceStatus,
      notes: s.notes ?? '',
    });
    setShowNewSession(false);
  }
  async function saveSession() {
    const duration = Number(trainingForm.durationMinutes);
    if (isNaN(duration) || duration < 1 || duration > 300) { showToast('Duration must be 1–300 min', 'error'); return; }
    if (!trainingForm.teamId) { showToast('Select a team', 'error'); return; }
    const payload = {
      playerId,
      teamId: Number(trainingForm.teamId),
      date: trainingForm.date,
      durationMinutes: duration,
      attendanceStatus: trainingForm.attendanceStatus as TrainingSession['attendanceStatus'],
      notes: trainingForm.notes || undefined,
    };
    try {
      if (editingSession) {
        await updateSession.mutateAsync({ id: editingSession.id, data: payload });
        showToast('Session updated', 'success');
        setEditingSession(null);
      } else {
        await createSession.mutateAsync(payload as Parameters<typeof createSession.mutateAsync>[0]);
        showToast('Session recorded', 'success');
        setShowNewSession(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  if (isLoading) return <PageSpinner />;
  if (!player) return <PageWrapper><p className="text-red-500">Player not found.</p></PageWrapper>;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'injuries', label: `Injuries (${injuries.length})`, icon: ShieldAlert },
    { id: 'matches', label: `Matches (${matches.length})`, icon: Activity },
    { id: 'training', label: `Training (${sessions.length})`, icon: Dumbbell },
  ];

  return (
    <PageWrapper
      title={player.fullName}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/players/${id}/edit`)}>
            <Edit size={16} /> Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDeletePlayer(true)}
          >
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      }
    >
      {/* Profile card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={player.fullName} size="lg" />
            <h3 className="mt-3 font-bold text-lg text-gray-900 dark:text-white">{player.fullName}</h3>
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              {player.positionName && <Badge variant="neutral">{player.positionName}</Badge>}
              {player.teamName && <Badge variant="success">{player.teamName}</Badge>}
              {player.fitnessLevel != null && <Badge variant="info">Fitness {player.fitnessLevel}/10</Badge>}
            </div>
            {player.age && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Age {player.age}{player.height ? ` · ${player.height}cm` : ''}{player.weight ? ` · ${player.weight}kg` : ''}
              </p>
            )}
          </div>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Assessment', icon: ClipboardList, path: `/players/${id}/assessment`, color: 'text-blue-600' },
            { label: 'Improvement Plan', icon: TrendingUp, path: `/players/${id}/improvement-plan`, color: 'text-green-600' },
            { label: 'Nutrition', icon: Salad, path: `/players/${id}/nutrition`, color: 'text-orange-600' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
            >
              <item.icon size={28} className={`${item.color} group-hover:scale-110 transition-transform`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="max-w-xl space-y-4">
          {player.goals && (
            <Card header="Goals">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{player.goals}</p>
            </Card>
          )}
          {player.coachNotes && (
            <Card header="Coach Notes">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{player.coachNotes}</p>
            </Card>
          )}
          {player.injuryNotes && (
            <Card header="Injury Notes">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{player.injuryNotes}</p>
            </Card>
          )}
          {!player.goals && !player.coachNotes && !player.injuryNotes && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No notes yet. <button className="text-indigo-600 hover:underline" onClick={() => navigate(`/players/${id}/edit`)}>Edit player</button> to add them.
            </p>
          )}
        </div>
      )}

      {/* Injuries tab */}
      {tab === 'injuries' && (
        <div className="max-w-2xl space-y-4">
          {!(showNewInjury || editingInjury) && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewInjury}><Plus size={16} /> Record Injury</Button>
            </div>
          )}

          {(showNewInjury || editingInjury) && (
            <Card header={editingInjury ? 'Edit Injury' : 'Record Injury'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Injury Date" type="date" value={injuryForm.injuryDate}
                  onChange={e => setInjuryForm(v => ({ ...v, injuryDate: e.target.value }))} />
                <Input label="Injury Type *" value={injuryForm.injuryType}
                  onChange={e => setInjuryForm(v => ({ ...v, injuryType: e.target.value }))}
                  placeholder="e.g. Hamstring strain" />
                <Select label="Severity" value={injuryForm.severity}
                  onChange={e => setInjuryForm(v => ({ ...v, severity: e.target.value }))}
                  options={INJURY_SEVERITIES.map(s => ({ value: s, label: s }))} />
                <Select label="Recovery Status" value={injuryForm.recoveryStatus}
                  onChange={e => setInjuryForm(v => ({ ...v, recoveryStatus: e.target.value }))}
                  options={RECOVERY_STATUSES.map(s => ({ value: s, label: s }))} />
                <Input label="Expected Return Date" type="date" value={injuryForm.expectedReturnDate}
                  onChange={e => setInjuryForm(v => ({ ...v, expectedReturnDate: e.target.value }))} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={injuryForm.notes}
                    onChange={e => setInjuryForm(v => ({ ...v, notes: e.target.value }))}
                    rows={2} placeholder="Details…" className={TEXTAREA_CLS} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={() => { setEditingInjury(null); setShowNewInjury(false); }}>Cancel</Button>
                <Button onClick={saveInjury} isLoading={createInjury.isPending || updateInjury.isPending}>
                  {editingInjury ? 'Save Changes' : 'Record'}
                </Button>
              </div>
            </Card>
          )}

          {injuries.length === 0 && !(showNewInjury || editingInjury) ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No injury records.</p>
          ) : (
            injuries.map(r => (
              <Card key={r.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">{r.injuryType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[r.severity] ?? ''}`}>{r.severity}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECOVERY_COLORS[r.recoveryStatus] ?? ''}`}>{r.recoveryStatus}</span>
                    </div>
                    <p className="text-xs text-gray-500">{r.injuryDate}{r.expectedReturnDate ? ` → ${r.expectedReturnDate}` : ''}</p>
                    {r.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{r.notes}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button variant="ghost" size="sm" onClick={() => openEditInjury(r)}><Edit2 size={15} /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteInjuryTarget(r)}><Trash2 size={15} /></Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Matches tab */}
      {tab === 'matches' && (
        <div className="max-w-2xl space-y-4">
          {!(showNewMatch || editingMatch) && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewMatch}><Plus size={16} /> Record Match</Button>
            </div>
          )}

          {(showNewMatch || editingMatch) && (
            <Card header={editingMatch ? 'Edit Match' : 'Record Match'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Match Date" type="date" value={matchForm.matchDate}
                  onChange={e => setMatchForm(v => ({ ...v, matchDate: e.target.value }))} />
                <Input label="Opponent *" value={matchForm.opponent}
                  onChange={e => setMatchForm(v => ({ ...v, opponent: e.target.value }))}
                  placeholder="Opponent team name" />
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Performance Rating</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{matchForm.performanceRating}/10</span>
                  </div>
                  <input type="range" min={1} max={10} step={1}
                    value={matchForm.performanceRating}
                    onChange={e => setMatchForm(v => ({ ...v, performanceRating: e.target.value }))}
                    className="w-full accent-indigo-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sport-Specific Stats</label>
                  <textarea value={matchForm.sportSpecificStats}
                    onChange={e => setMatchForm(v => ({ ...v, sportSpecificStats: e.target.value }))}
                    rows={2} placeholder="Goals, assists, tackles…" className={TEXTAREA_CLS} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={matchForm.notes}
                    onChange={e => setMatchForm(v => ({ ...v, notes: e.target.value }))}
                    rows={2} placeholder="Match observations…" className={TEXTAREA_CLS} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={() => { setEditingMatch(null); setShowNewMatch(false); }}>Cancel</Button>
                <Button onClick={saveMatch} isLoading={createMatch.isPending || updateMatch.isPending}>
                  {editingMatch ? 'Save Changes' : 'Record'}
                </Button>
              </div>
            </Card>
          )}

          {matches.length === 0 && !(showNewMatch || editingMatch) ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No match records.</p>
          ) : (
            matches.map(m => (
              <Card key={m.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">vs {m.opponent}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Rating {m.performanceRating}/10
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{m.matchDate}</p>
                    {m.sportSpecificStats && <p className="text-sm text-gray-600 dark:text-gray-400">{m.sportSpecificStats}</p>}
                    {m.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{m.notes}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button variant="ghost" size="sm" onClick={() => openEditMatch(m)}><Edit2 size={15} /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteMatchTarget(m)}><Trash2 size={15} /></Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Training tab */}
      {tab === 'training' && (
        <div className="max-w-2xl space-y-4">
          {!(showNewSession || editingSession) && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewSession}><Plus size={16} /> Log Session</Button>
            </div>
          )}

          {(showNewSession || editingSession) && (
            <Card header={editingSession ? 'Edit Session' : 'Log Training Session'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Date" type="date" value={trainingForm.date}
                  onChange={e => setTrainingForm(v => ({ ...v, date: e.target.value }))} />
                <Input label="Duration (min)" type="number" value={trainingForm.durationMinutes}
                  onChange={e => setTrainingForm(v => ({ ...v, durationMinutes: e.target.value }))}
                  min={1} max={300} />
                <Select label="Team *" value={trainingForm.teamId}
                  onChange={e => setTrainingForm(v => ({ ...v, teamId: e.target.value }))}
                  options={[
                    { value: '', label: 'Select team…' },
                    ...teams.map(t => ({ value: String(t.id), label: t.name })),
                  ]} />
                <Select label="Attendance" value={trainingForm.attendanceStatus}
                  onChange={e => setTrainingForm(v => ({ ...v, attendanceStatus: e.target.value }))}
                  options={ATTENDANCE_STATUSES.map(s => ({ value: s, label: s }))} />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={trainingForm.notes}
                    onChange={e => setTrainingForm(v => ({ ...v, notes: e.target.value }))}
                    rows={2} placeholder="Session notes…" className={TEXTAREA_CLS} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={() => { setEditingSession(null); setShowNewSession(false); }}>Cancel</Button>
                <Button onClick={saveSession} isLoading={createSession.isPending || updateSession.isPending}>
                  {editingSession ? 'Save Changes' : 'Log Session'}
                </Button>
              </div>
            </Card>
          )}

          {sessions.length === 0 && !(showNewSession || editingSession) ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No training sessions logged.</p>
          ) : (
            sessions.map(s => (
              <Card key={s.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">{s.durationMinutes} min</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ATTENDANCE_COLORS[s.attendanceStatus] ?? ''}`}>
                        {s.attendanceStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{s.date}</p>
                    {s.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{s.notes}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button variant="ghost" size="sm" onClick={() => openEditSession(s)}><Edit2 size={15} /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteSessionTarget(s)}><Trash2 size={15} /></Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Confirm modals */}
      <ConfirmModal
        isOpen={!!deleteInjuryTarget}
        onClose={() => setDeleteInjuryTarget(null)}
        onConfirm={async () => {
          if (!deleteInjuryTarget) return;
          try {
            await deleteInjury.mutateAsync(deleteInjuryTarget.id);
            showToast('Injury deleted', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
          } finally { setDeleteInjuryTarget(null); }
        }}
        title="Delete Injury Record"
        message={`Delete "${deleteInjuryTarget?.injuryType}" record?`}
        confirmLabel="Delete"
        isLoading={deleteInjury.isPending}
      />
      <ConfirmModal
        isOpen={!!deleteMatchTarget}
        onClose={() => setDeleteMatchTarget(null)}
        onConfirm={async () => {
          if (!deleteMatchTarget) return;
          try {
            await deleteMatch.mutateAsync(deleteMatchTarget.id);
            showToast('Match deleted', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
          } finally { setDeleteMatchTarget(null); }
        }}
        title="Delete Match Record"
        message={`Delete match vs "${deleteMatchTarget?.opponent}"?`}
        confirmLabel="Delete"
        isLoading={deleteMatch.isPending}
      />
      <ConfirmModal
        isOpen={!!deleteSessionTarget}
        onClose={() => setDeleteSessionTarget(null)}
        onConfirm={async () => {
          if (!deleteSessionTarget) return;
          try {
            await deleteSession.mutateAsync(deleteSessionTarget.id);
            showToast('Session deleted', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
          } finally { setDeleteSessionTarget(null); }
        }}
        title="Delete Training Session"
        message="Delete this training session?"
        confirmLabel="Delete"
        isLoading={deleteSession.isPending}
      />
      <ConfirmModal
        isOpen={confirmDeletePlayer}
        onClose={() => setConfirmDeletePlayer(false)}
        onConfirm={async () => {
          try {
            await deletePlayer.mutateAsync(playerId);
            showToast('Player deleted', 'success');
            navigate('/players');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
          } finally { setConfirmDeletePlayer(false); }
        }}
        title="Delete Player"
        message={`Permanently delete ${player.fullName}? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deletePlayer.isPending}
      />
    </PageWrapper>
  );
}
