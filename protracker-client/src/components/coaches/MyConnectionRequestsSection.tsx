import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Handshake, Copy, Check, Clock, ArrowRight } from 'lucide-react';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { ConfirmModal } from '../ui/Modal';
import { useToast } from '../../context/useToast';
import { useMyRequests, useWithdrawRequest } from '../../hooks/useConnections';
import type { MyConnectionRequest, ConnectionRequestStatus } from '../../types';

function fmt(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS: Record<ConnectionRequestStatus, { label: string; cls: string }> = {
  Pending: { label: 'Waiting for response', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  Accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  Declined: { label: 'Not accepted', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  Withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const STATUS_LABEL_KEY: Record<ConnectionRequestStatus, string> = {
  Pending: 'coaches.reqStatusPending',
  Accepted: 'coaches.reqStatusAccepted',
  Declined: 'coaches.reqStatusDeclined',
  Withdrawn: 'coaches.reqStatusWithdrawn',
};

export function MyConnectionRequestsSection() {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { addToast } = useToast();
  const { data: requests = [], isLoading } = useMyRequests();
  const withdraw = useWithdrawRequest();
  const [withdrawTarget, setWithdrawTarget] = useState<MyConnectionRequest | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // Hide the section entirely when the athlete has never sent a request.
  if (!isLoading && requests.length === 0) return null;

  const copyCode = async (id: number, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const doWithdraw = async () => {
    if (!withdrawTarget) return;
    try {
      await withdraw.mutateAsync(withdrawTarget.id);
      addToast(t('coaches.requestWithdrawn', 'Request withdrawn'), 'success');
      setWithdrawTarget(null);
    } catch (e) {
      addToast(e instanceof Error ? e.message : t('coaches.failedToWithdraw', 'Failed to withdraw'), 'error');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <Handshake size={17} className="text-indigo-500" /> {t('coaches.myCoachRequests', 'My Coach Requests')}
      </h3>

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
      ) : (
        <div className="space-y-2.5">
          {requests.map(r => {
            const s = STATUS[r.status];
            return (
              <div key={r.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.coachSlug ? (
                        <Link to={`/coaches/${r.coachSlug}`} className="font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">{r.coachName}</Link>
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-white">{r.coachName}</span>
                      )}
                      {r.sportName && <span className="text-xs text-gray-400">· {dyn.sport(r.sportName)}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><Clock size={11} /> {fmt(r.requestedAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', s.cls)}>{t(STATUS_LABEL_KEY[r.status], s.label)}</span>
                    {r.status === 'Pending' && (
                      <button onClick={() => setWithdrawTarget(r)} className="text-xs font-semibold text-gray-400 hover:text-red-500 cursor-pointer">{t('coaches.withdraw', 'Withdraw')}</button>
                    )}
                  </div>
                </div>

                {r.status === 'Accepted' && r.resultJoinCode && (
                  <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-900/40 flex-wrap">
                    <span className="text-xs text-gray-600 dark:text-gray-300">{t('coaches.joinCodeLabel', 'Join code:')}</span>
                    <code className="font-bold text-green-700 dark:text-green-300 tracking-wide">{r.resultJoinCode}</code>
                    <button onClick={() => copyCode(r.id, r.resultJoinCode!)} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                      {copied === r.id ? <Check size={12} /> : <Copy size={12} />} {copied === r.id ? t('coaches.copied', 'Copied') : t('coaches.copy', 'Copy')}
                    </button>
                    <Link to={`/join/${r.resultJoinCode}`} className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      {t('coaches.useCode', 'Use code')} <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={!!withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={doWithdraw}
        title={t('coaches.withdrawRequest', 'Withdraw request')}
        message={t('coaches.withdrawConfirm', 'Withdraw your request to {{name}}?', { name: withdrawTarget?.coachName })}
        confirmLabel={t('coaches.withdraw', 'Withdraw')}
        isLoading={withdraw.isPending}
      />
    </div>
  );
}
