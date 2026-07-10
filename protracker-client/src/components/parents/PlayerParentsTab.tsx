import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Mail, Clock, CheckCircle2, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { usePlayerParents, useInviteParent } from '../../hooks/useParent';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import type { ParentInviteResult } from '../../types';

function InviteModal({ playerId, playerName, onClose }: { playerId: number; playerName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const invite = useInviteParent(playerId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<ParentInviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  async function submit() {
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      addToast(t('parent.enterNameEmail', 'Enter a name and a valid email.'), 'error');
      return;
    }
    try {
      const res = await invite.mutateAsync({ playerId, parentName: name.trim(), email: email.trim() });
      setResult(res);
      addToast(res.emailSent ? t('parent.inviteEmailSent', 'Invite email sent') : t('parent.inviteCreatedToast', 'Invite created'), 'success');
    } catch {
      addToast(t('parent.inviteSendError', 'Could not send the invite.'), 'error');
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal isOpen onClose={onClose} title={t('parent.inviteModalTitle', 'Invite a parent for {{name}}', { name: playerName })}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3.5">
            <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {result.emailSent
                ? <>{t('parent.emailSentPre', 'An invite email was sent to')} <span className="font-semibold">{result.email}</span>.</>
                : <>{t('parent.inviteCreatedPre', 'Invite created for')} <span className="font-semibold">{result.email}</span>. {t('parent.shareLink', 'Share this link so they can set a password:')}</>}
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
            <Button onClick={onClose}>{t('parent.done', 'Done')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('parent.parentName', 'Parent name')}</label>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={t('parent.parentNamePlaceholder', 'e.g. Sarah Ward')} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('parent.parentEmail', 'Parent email')}</label>
            <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder={t('parent.parentEmailPlaceholder', 'parent@example.com')} />
          </div>
          <p className="text-xs text-gray-500">{t('parent.inviteHelp', "They'll get a read-only account to follow {{name}}'s progress — no access to private notes, messages, or other players.", { name: playerName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>{t('parent.cancel', 'Cancel')}</Button>
            <Button onClick={submit} isLoading={invite.isPending}>{t('parent.sendInvite', 'Send Invite')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PlayerParentsTab({ playerId, playerName }: { playerId: number; playerName: string }) {
  const { t } = useTranslation();
  const labels = useDynamicLabels();
  const { data: parents = [], isLoading } = usePlayerParents(playerId);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><UserPlus size={16} className="text-indigo-500" /> {t('parent.parentsGuardians', 'Parents & Guardians')}</span>
          <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} /> {t('parent.inviteParent', 'Invite Parent')}</Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">{t('parent.loading', 'Loading…')}</p>
      ) : parents.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={36} />}
          title={t('parent.noParentsTitle', 'No parents linked')}
          description={t('parent.noParentsDesc', "Invite a parent or guardian to follow {{name}}'s progress in read-only mode.", { name: playerName })}
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
                {labels.status(p.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && <InviteModal playerId={playerId} playerName={playerName} onClose={() => setInviteOpen(false)} />}
    </Card>
  );
}
