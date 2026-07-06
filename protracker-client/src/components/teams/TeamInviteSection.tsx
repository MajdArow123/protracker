import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import {
  Check, Download, Link2, Loader2, Mail, QrCode, RefreshCw, Share2, Ticket, UserPlus, XCircle,
} from 'lucide-react';
import {
  useJoinCodes, useGenerateJoinCode, useDeactivateJoinCode,
  useAthleteInvites, useInviteAthlete,
} from '../../hooks/useJoinCodes';
import { joinUrlFor } from '../../api/joinApi';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../ui/Modal';

export function TeamInviteSection({ teamId, teamName }: { teamId: number; teamName: string }) {
  const { addToast: showToast } = useToast();
  const { data: codes = [], isLoading } = useJoinCodes(teamId);
  const { data: invites = [] } = useAthleteInvites(teamId);
  const generate = useGenerateJoinCode(teamId);
  const deactivate = useDeactivateJoinCode(teamId);
  const invite = useInviteAthlete(teamId);

  const [copied, setCopied] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const active = codes.find(c =>
    c.isActive
    && (!c.expiresAt || new Date(c.expiresAt) > new Date())
    && (c.maxUses == null || c.useCount < c.maxUses));
  const joinUrl = active ? joinUrlFor(active.code) : '';
  const pendingInvites = invites.filter(i => i.status === 'Pending');

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync(undefined);
      showToast('New join code generated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not generate code', 'error');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Could not copy the link', 'error');
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${teamName} on ProTracker`, url: joinUrl });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  // Serialize the rendered QR SVG into a downloadable file (for printing/posting).
  const downloadQr = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg || !active) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-${active.code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email || invite.isPending) return;
    try {
      const res = await invite.mutateAsync(email);
      showToast(res.emailSent ? `Invite sent to ${email}` : `Invite recorded — email isn't configured, share the join link directly`, 'success');
      setInviteEmail('');
      setShowInvite(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send invite', 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UserPlus size={15} className="text-indigo-400" /> Invite & Join
        </h3>
        <button
          onClick={() => setShowInvite(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all cursor-pointer"
        >
          <Mail size={13} /> Invite by Email
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="flex gap-2 mb-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="athlete@example.com"
            autoFocus
            className="flex-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!inviteEmail.trim() || invite.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {invite.isPending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Send
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="h-32 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />
      ) : active ? (
        <div className="flex flex-col sm:flex-row gap-4">
          {/* QR code — white padding so any scanner reads it, even in dark mode. */}
          <div className="flex flex-col items-center gap-2">
            <div ref={qrRef} className="rounded-xl bg-white p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
              <QRCodeSVG value={joinUrl} size={132} level="M" marginSize={0} />
            </div>
            <button onClick={downloadQr} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-indigo-500 transition-colors cursor-pointer">
              <Download size={11} /> Download QR
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1">Active Join Code</p>
            <p className="text-3xl font-black tracking-[0.2em] text-gray-900 dark:text-white mb-1">{active.code}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {active.useCount} athlete{active.useCount === 1 ? '' : 's'} joined with this code
              {active.maxUses != null && ` · ${active.maxUses - active.useCount} use${active.maxUses - active.useCount === 1 ? '' : 's'} left`}
              {active.expiresAt && ` · expires ${new Date(active.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyLink}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                  copied
                    ? 'bg-green-500/15 text-green-500'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white',
                )}
              >
                {copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={shareLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Share2 size={13} /> Share
              </button>
              <button
                onClick={() => setConfirmRegenerate(true)}
                disabled={generate.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={generate.isPending ? 'animate-spin' : ''} /> New Code
              </button>
              <button
                onClick={() => setConfirmDeactivate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold transition-all cursor-pointer"
              >
                <XCircle size={13} /> Deactivate
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3">
            <QrCode size={22} className="text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No active join code</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
            Generate a code so athletes can join {teamName} themselves — share it as a link or printable QR code.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Ticket size={13} />} Generate Join Code
          </button>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-2">Pending Invites</p>
          <div className="space-y-1.5">
            {pendingInvites.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{i.email}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 flex-shrink-0">
                  Invited {new Date(i.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        onConfirm={async () => { setConfirmRegenerate(false); await handleGenerate(); }}
        title="Generate New Code"
        message="This deactivates the current code — shared links and printed QR codes for it will stop working."
        confirmLabel="Generate"
      />
      <ConfirmModal
        isOpen={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={async () => {
          setConfirmDeactivate(false);
          if (!active) return;
          try {
            await deactivate.mutateAsync(active.id);
            showToast('Join code deactivated', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not deactivate', 'error');
          }
        }}
        title="Deactivate Join Code"
        message="Athletes will no longer be able to join with this code, link, or QR."
        confirmLabel="Deactivate"
      />
    </div>
  );
}
