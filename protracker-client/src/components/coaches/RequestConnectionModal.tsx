import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, Send } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useSendRequest } from '../../hooks/useConnections';
import { sportBadge } from '../../utils/sportColors';

const MSG_MAX = 500;

export function RequestConnectionModal({ slug, coachName, sportName, isOpen, onClose }: {
  slug: string; coachName: string; sportName?: string | null; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const send = useSendRequest();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setMessage(''); setSent(false); setError(''); }
  }, [isOpen]);

  const submit = async () => {
    setError('');
    try {
      await send.mutateAsync({ slug, data: { message: message.trim() || null } });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send request.');
    }
  };

  const firstName = coachName.split(' ')[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={sent ? 'Request sent' : `Connect with ${coachName}`} size="md">
      {sent ? (
        <div className="text-center py-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <CheckCircle2 size={28} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Request sent!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {firstName} will be notified. You can track it under your connection requests.
          </p>
          <Button onClick={() => { addToast('Request sent', 'success'); onClose(); }} className="mt-5">Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sportName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Sport:</span>
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', sportBadge(sportName))}>{sportName}</span>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Introduce yourself</label>
              <span className="text-xs text-gray-400">{message.length}/{MSG_MAX}</span>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MSG_MAX))}
              rows={5}
              placeholder={`Tell ${firstName} about yourself, your goals, and why you'd like to connect… (optional)`}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} isLoading={send.isPending}><Send size={15} /> Send Request</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
