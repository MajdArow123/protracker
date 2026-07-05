import { useState } from 'react';
import { UserPlus, Mail, Clock, CheckCircle2, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { usePlayerParents, useInviteParent } from '../../hooks/useParent';
import type { ParentInviteResult } from '../../types';

function InviteModal({ playerId, playerName, onClose }: { playerId: number; playerName: string; onClose: () => void }) {
  const { addToast } = useToast();
  const invite = useInviteParent(playerId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<ParentInviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  async function submit() {
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      addToast('Enter a name and a valid email.', 'error');
      return;
    }
    try {
      const res = await invite.mutateAsync({ playerId, parentName: name.trim(), email: email.trim() });
      setResult(res);
      addToast(res.emailSent ? 'Invite email sent' : 'Invite created', 'success');
    } catch {
      addToast('Could not send the invite.', 'error');
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal isOpen onClose={onClose} title={`Invite a parent for ${playerName}`}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3.5">
            <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {result.emailSent
                ? <>An invite email was sent to <span className="font-semibold">{result.email}</span>.</>
                : <>Invite created for <span className="font-semibold">{result.email}</span>. Share this link so they can set a password:</>}
            </p>
          </div>
          {!result.emailSent && (
            <div className="flex items-center gap-2">
              <input readOnly value={result.inviteUrl} className={clsx(inputClass, 'flex-1 text-xs')} onFocus={e => e.target.select()} />
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Parent name</label>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Ward" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Parent email</label>
            <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" />
          </div>
          <p className="text-xs text-gray-500">They'll get a read-only account to follow {playerName}'s progress — no access to private notes, messages, or other players.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} isLoading={invite.isPending}>Send Invite</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PlayerParentsTab({ playerId, playerName }: { playerId: number; playerName: string }) {
  const { data: parents = [], isLoading } = usePlayerParents(playerId);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><UserPlus size={16} className="text-indigo-500" /> Parents & Guardians</span>
          <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} /> Invite Parent</Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : parents.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={36} />}
          title="No parents linked"
          description={`Invite a parent or guardian to follow ${playerName}'s progress in read-only mode.`}
        />
      ) : (
        <div className="space-y-2">
          {parents.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate"><Mail size={11} /> {p.email}</p>
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0',
                p.status === 'Active'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
              )}>
                {p.status === 'Active' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && <InviteModal playerId={playerId} playerName={playerName} onClose={() => setInviteOpen(false)} />}
    </Card>
  );
}
