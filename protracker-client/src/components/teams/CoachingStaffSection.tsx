import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus, Trash2, ShieldCheck, UserPlus, Copy, Check, Crown, Sliders } from 'lucide-react';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  useTeamCoaches, useInviteCoach, useUpdateCoachPermissions, useRemoveCoach,
} from '../../hooks/useTeamCoaches';
import type { TeamCoach, CoachRoleType, CoachPermissions } from '../../types';

const PERMISSION_LABELS: { key: keyof CoachPermissions; label: string; hint: string }[] = [
  { key: 'canAssessPlayers', label: 'Assess players', hint: 'Record assessment scores' },
  { key: 'canAssignTasks', label: 'Assign tasks', hint: 'Create & assign player tasks' },
  { key: 'canViewPrivateNotes', label: 'View private notes', hint: 'See coach-private player notes' },
  { key: 'canManagePlayers', label: 'Manage players', hint: 'Add, edit & remove players' },
  { key: 'canManageTeam', label: 'Manage team', hint: 'Edit team details & settings' },
];

const ROLE_PRESETS: Record<CoachRoleType, CoachPermissions> = {
  HeadCoach: { canAssessPlayers: true, canAssignTasks: true, canViewPrivateNotes: true, canManagePlayers: true, canManageTeam: true },
  AssistantCoach: { canAssessPlayers: true, canAssignTasks: true, canViewPrivateNotes: false, canManagePlayers: true, canManageTeam: false },
  Analyst: { canAssessPlayers: true, canAssignTasks: false, canViewPrivateNotes: false, canManagePlayers: false, canManageTeam: false },
};

function roleLabel(role: CoachRoleType) {
  return role === 'HeadCoach' ? 'Head Coach' : role === 'AssistantCoach' ? 'Assistant Coach' : 'Analyst';
}

function Avatar({ coach }: { coach: TeamCoach }) {
  if (coach.profilePictureUrl)
    return <img src={coach.profilePictureUrl} alt={coach.name} className="w-11 h-11 rounded-full object-cover" />;
  const initials = coach.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
      {initials || '?'}
    </div>
  );
}

function PermissionChips({ perms }: { perms: CoachPermissions }) {
  const active = PERMISSION_LABELS.filter(p => perms[p.key]);
  if (active.length === 0) return <span className="text-xs text-gray-400">View-only</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(p => (
        <span key={p.key} className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
          {p.label}
        </span>
      ))}
    </div>
  );
}

function PermissionPicker({ value, onChange }: { value: CoachPermissions; onChange: (v: CoachPermissions) => void }) {
  return (
    <div className="space-y-1.5">
      {PERMISSION_LABELS.map(p => (
        <label
          key={p.key}
          className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <input
            type="checkbox"
            checked={value[p.key]}
            onChange={e => onChange({ ...value, [p.key]: e.target.checked })}
            className="w-4 h-4 accent-indigo-600"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{p.label}</div>
            <div className="text-xs text-gray-500">{p.hint}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

function InviteCoachModal({ teamId, isOpen, onClose }: { teamId: number; isOpen: boolean; onClose: () => void }) {
  const { addToast } = useToast();
  const invite = useInviteCoach(teamId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CoachRoleType>('AssistantCoach');
  const [perms, setPerms] = useState<CoachPermissions>(ROLE_PRESETS.AssistantCoach);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(''); setRole('AssistantCoach'); setPerms(ROLE_PRESETS.AssistantCoach);
    setError(''); setInviteUrl(''); setCopied(false);
  }, [isOpen]);

  const pickRole = (r: CoachRoleType) => {
    setRole(r);
    setPerms(ROLE_PRESETS[r]);
  };

  const submit = async () => {
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address.'); return; }
    setError('');
    try {
      const res = await invite.mutateAsync({ email: email.trim(), role, permissions: perms });
      setInviteUrl(res.inviteUrl);
      addToast(`Invite created for ${res.email}`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invite.');
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite coaching staff" size="lg">
      {inviteUrl ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
            <Check size={18} /> Invite created
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            We emailed the invite. You can also share this link directly — it expires in 7 days.
          </p>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <code className="flex-1 text-xs text-gray-600 dark:text-gray-300 truncate">{inviteUrl}</code>
            <button onClick={copyLink} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['AssistantCoach', 'Analyst'] as CoachRoleType[]).map(r => (
                <button
                  key={r}
                  onClick={() => pickRole(r)}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all cursor-pointer',
                    role === r
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  )}
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{roleLabel(r)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r === 'AssistantCoach' ? 'Helps run the team' : 'Read & assess only'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Permissions</label>
            <PermissionPicker value={perms} onChange={setPerms} />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={invite.isPending}>
              <UserPlus size={15} /> {invite.isPending ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditPermissionsModal({ teamId, coach, isOpen, onClose }: {
  teamId: number; coach: TeamCoach | null; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const update = useUpdateCoachPermissions(teamId);
  const [perms, setPerms] = useState<CoachPermissions>(ROLE_PRESETS.AssistantCoach);

  useEffect(() => {
    if (coach) setPerms(coach.permissions);
  }, [coach]);

  if (!coach) return null;

  const submit = async () => {
    try {
      await update.mutateAsync({ roleId: coach.id!, permissions: perms });
      addToast('Permissions updated', 'success');
      onClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update permissions', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${coach.name}'s permissions`} size="md">
      <div className="space-y-4">
        <PermissionPicker value={perms} onChange={setPerms} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function CoachingStaffSection({ teamId }: { teamId: number }) {
  const { addToast } = useToast();
  const { data: coaches = [], isLoading } = useTeamCoaches(teamId);
  const remove = useRemoveCoach(teamId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editCoach, setEditCoach] = useState<TeamCoach | null>(null);
  const [removeCoach, setRemoveCoach] = useState<TeamCoach | null>(null);

  // Only the head coach (viewing their own team) may manage staff.
  const iAmHead = coaches.some(c => c.isYou && c.isHeadCoach);
  const assistants = coaches.filter(c => !c.isHeadCoach);
  const head = coaches.find(c => c.isHeadCoach);

  const doRemove = async () => {
    if (!removeCoach?.id) return;
    try {
      await remove.mutateAsync(removeCoach.id);
      addToast(`${removeCoach.name} removed from staff`, 'success');
      setRemoveCoach(null);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to remove', 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-indigo-500" />
          <h3 className="font-bold text-gray-900 dark:text-white">Coaching Staff</h3>
        </div>
        {iAmHead && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus size={13} /> Invite Assistant
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {head && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10">
              <Avatar coach={head} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{head.name}</span>
                  {head.isYou && <span className="text-[10px] text-gray-400">(you)</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <Crown size={12} /> Head Coach
                </div>
              </div>
            </div>
          )}

          {assistants.map(coach => (
            <div key={coach.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
              <Avatar coach={coach} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{coach.name}</span>
                  {coach.isYou && <span className="text-[10px] text-gray-400">(you)</span>}
                  {!coach.acceptedAt && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">Pending</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-1">{roleLabel(coach.role)}</div>
                <PermissionChips perms={coach.permissions} />
              </div>
              {iAmHead && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setEditCoach(coach)}
                    title="Edit permissions"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer"
                  >
                    <Sliders size={15} />
                  </button>
                  <button
                    onClick={() => setRemoveCoach(coach)}
                    title="Remove"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {assistants.length === 0 && (
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="No assistant coaches"
              description={iAmHead ? 'Invite assistant coaches or analysts to help manage this team.' : 'The head coach runs this team solo.'}
              action={iAmHead ? { label: 'Invite Assistant', onClick: () => setInviteOpen(true) } : undefined}
            />
          )}
        </div>
      )}

      <InviteCoachModal teamId={teamId} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EditPermissionsModal teamId={teamId} coach={editCoach} isOpen={!!editCoach} onClose={() => setEditCoach(null)} />
      <ConfirmModal
        isOpen={!!removeCoach}
        onClose={() => setRemoveCoach(null)}
        onConfirm={doRemove}
        title="Remove coach"
        message={`Remove ${removeCoach?.name} from this team's coaching staff? They'll lose all access to the team.`}
        confirmLabel="Remove"
        isLoading={remove.isPending}
      />
    </div>
  );
}
