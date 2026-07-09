import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Store, Lock, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useSports } from '../../hooks/useSports';
import { useCoachPublicSettings, useUpdateCoachPublicProfile } from '../../hooks/useCoachMarketplace';
import type { UpdateCoachPublicProfileInput } from '../../types';

const BIO_MAX = 1000;

export function CoachPublicProfileSection() {
  const { addToast } = useToast();
  const { data: settings, isLoading } = useCoachPublicSettings();
  const { data: sports = [] } = useSports();
  const update = useUpdateCoachPublicProfile();

  const [form, setForm] = useState<UpdateCoachPublicProfileInput>({
    bio: '', sportId: null, city: '', country: '', yearsCoaching: null,
    certifications: '', specialization: '', isAcceptingAthletes: true, contactEmail: '', isPublic: false,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      bio: settings.bio ?? '',
      sportId: settings.sportId ?? null,
      city: settings.city ?? '',
      country: settings.country ?? '',
      yearsCoaching: settings.yearsCoaching ?? null,
      certifications: settings.certifications ?? '',
      specialization: settings.specialization ?? '',
      isAcceptingAthletes: settings.isAcceptingAthletes,
      contactEmail: settings.contactEmail ?? '',
      isPublic: settings.isPublic,
    });
  }, [settings]);

  const publicUrl = settings ? `${window.location.origin}/coaches/${settings.slug}` : '';

  const set = <K extends keyof UpdateCoachPublicProfileInput>(k: K, v: UpdateCoachPublicProfileInput[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Toggling public saves immediately so the "on" state reveals a working link.
  const togglePublic = async () => {
    const next = { ...form, isPublic: !form.isPublic };
    setForm(next);
    try {
      await update.mutateAsync(next);
      addToast(next.isPublic ? 'Your coaching profile is now public' : 'Profile set to private', 'success');
    } catch (e) {
      setForm(f => ({ ...f, isPublic: !f.isPublic })); // revert
      addToast(e instanceof Error ? e.message : 'Failed to update', 'error');
    }
  };

  const save = async () => {
    try {
      await update.mutateAsync(form);
      addToast('Public profile saved', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to save', 'error');
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) {
    return <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 h-40 skeleton" />;
  }

  const bioLen = (form.bio ?? '').length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Store size={17} className="text-indigo-500" /> Public Coaching Profile
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            List yourself on the coach marketplace so athletes can find and connect with you.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.isPublic}
          onClick={togglePublic}
          className={clsx('relative flex-shrink-0 w-12 h-7 rounded-full transition-colors cursor-pointer',
            form.isPublic ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600')}
        >
          <span className={clsx('absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform', form.isPublic && 'translate-x-5')} />
        </button>
      </div>

      {form.isPublic && (
        <div className="mt-5 mb-5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Public URL</label>
          <div className="mt-1 flex gap-2">
            <input
              readOnly
              value={publicUrl}
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
            />
            <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer flex-shrink-0">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:underline">
            <ExternalLink size={14} /> Preview my public page
          </a>
        </div>
      )}

      {!form.isPublic && (
        <div className="mt-4 mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5">
          <Lock size={15} /> Your profile is private. Turn it on to appear in the marketplace.
        </div>
      )}

      {/* Editable fields (always editable; only shown publicly when the toggle is on) */}
      <div className="mt-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
            <span className={clsx('text-xs', bioLen > BIO_MAX ? 'text-red-500' : 'text-gray-400')}>{bioLen}/{BIO_MAX}</span>
          </div>
          <textarea
            value={form.bio ?? ''}
            onChange={e => set('bio', e.target.value)}
            rows={4}
            maxLength={BIO_MAX}
            placeholder="Tell athletes about your coaching philosophy and experience…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary sport">
            <select
              value={form.sportId ?? ''}
              onChange={e => set('sportId', e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a sport</option>
              {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Years coaching">
            <input
              type="number" min={0} max={80}
              value={form.yearsCoaching ?? ''}
              onChange={e => set('yearsCoaching', e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>
          <Field label="City">
            <input value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="City"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
          <Field label="Country">
            <input value={form.country ?? ''} onChange={e => set('country', e.target.value)} placeholder="Country"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
          <Field label="Certifications">
            <input value={form.certifications ?? ''} onChange={e => set('certifications', e.target.value)} placeholder="e.g. UEFA B License"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
          <Field label="Specialization">
            <input value={form.specialization ?? ''} onChange={e => set('specialization', e.target.value)} placeholder="e.g. Youth development"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
        </div>

        <Field label="Public contact email (optional)">
          <input type="email" value={form.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value)} placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.isAcceptingAthletes} onChange={e => set('isAcceptingAthletes', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Accepting new athletes</div>
            <div className="text-xs text-gray-500">Shows a green "accepting" badge on your profile and cards.</div>
          </div>
        </label>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={update.isPending || bioLen > BIO_MAX}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            {update.isPending ? 'Saving…' : 'Save Public Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
