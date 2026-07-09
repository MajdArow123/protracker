import { useState } from 'react';
import { clsx } from 'clsx';
import { UserPlus, Check, X, Copy, CheckCircle2, MessageSquare, Clock } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { useIncomingRequests, useAcceptRequest, useDeclineRequest } from '../../hooks/useConnections';
import { sportBadge } from '../../utils/sportColors';
import type { ConnectionRequest, ConnectionRequestStatus } from '../../types';

const TABS: { label: string; value: ConnectionRequestStatus | 'all' }[] = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Accepted', value: 'Accepted' },
  { label: 'Declined', value: 'Declined' },
  { label: 'All', value: 'all' },
];

function fmt(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLE: Record<ConnectionRequestStatus, string> = {
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Declined: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  Withdrawn: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function ConnectionRequestsPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<ConnectionRequestStatus | 'all'>('Pending');
  const { data: requests = [], isLoading } = useIncomingRequests(tab === 'all' ? undefined : tab);
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const [declineTarget, setDeclineTarget] = useState<ConnectionRequest | null>(null);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState<number | null>(null);

  const doAccept = async (r: ConnectionRequest) => {
    try {
      const res = await accept.mutateAsync(r.id);
      addToast(res.resultJoinCode ? `Accepted — join code ${res.resultJoinCode}` : 'Request accepted', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to accept', 'error');
    }
  };

  const doDecline = async () => {
    if (!declineTarget) return;
    try {
      await decline.mutateAsync({ id: declineTarget.id, reason: reason.trim() || undefined });
      addToast('Request declined', 'success');
      setDeclineTarget(null); setReason('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to decline', 'error');
    }
  };

  const copyCode = async (id: number, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <PageWrapper title="Connection Requests">
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx('px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer',
              tab === t.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={30} />}
          title={tab === 'Pending' ? 'No pending requests' : 'Nothing here'}
          description="Athletes who find you on the marketplace can request to connect. They'll show up here."
        />
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 dark:text-white">{r.athleteName}</h3>
                    {r.sportName && <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', sportBadge(r.sportName))}>{r.sportName}</span>}
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_STYLE[r.status])}>{r.status}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1"><Clock size={11} /> {fmt(r.requestedAt)}</div>
                </div>
                {r.status === 'Pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => doAccept(r)} disabled={accept.isPending}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                      <Check size={15} /> Accept
                    </button>
                    <button onClick={() => setDeclineTarget(r)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <X size={15} /> Decline
                    </button>
                  </div>
                )}
              </div>

              {r.message && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-300">
                  <MessageSquare size={15} className="text-gray-400 mt-0.5 flex-shrink-0" /> {r.message}
                </div>
              )}

              {r.status === 'Accepted' && r.resultJoinCode && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-900/40">
                  <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">Share this join code so they can join your team:</span>
                  <code className="font-bold text-green-700 dark:text-green-300 tracking-wide">{r.resultJoinCode}</code>
                  <button onClick={() => copyCode(r.id, r.resultJoinCode!)} className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {copied === r.id ? <Check size={13} /> : <Copy size={13} />} {copied === r.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
              {r.status === 'Accepted' && !r.resultJoinCode && (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Accepted — this athlete is already on one of your teams.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!declineTarget} onClose={() => { setDeclineTarget(null); setReason(''); }} title="Decline request" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Decline {declineTarget?.athleteName}'s request? You can add an optional internal note (the athlete won't see it).
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Optional note…"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setDeclineTarget(null); setReason(''); }}>Cancel</Button>
          <Button variant="danger" onClick={doDecline} isLoading={decline.isPending}>Decline</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
