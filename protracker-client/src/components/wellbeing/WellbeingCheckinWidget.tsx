import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartPulse, ChevronLeft, ChevronRight, Check, Zap, Moon, Smile,
  ShieldAlert, PartyPopper, Pencil,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTodayCheckin, useSubmitCheckin } from '../../hooks/useWellbeing';
import type { WellbeingCheckin } from '../../types';

// 1-5 option metadata shared across the three scales (emoji + label + color band).
const SCALE: { value: number; emoji: string; label: string; ring: string; bg: string }[] = [
  { value: 1, emoji: '😣', label: 'Very low', ring: 'ring-red-400 border-red-400', bg: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  { value: 2, emoji: '😕', label: 'Low', ring: 'ring-orange-400 border-orange-400', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { value: 3, emoji: '😐', label: 'Okay', ring: 'ring-amber-400 border-amber-400', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 4, emoji: '🙂', label: 'Good', ring: 'ring-lime-400 border-lime-400', bg: 'bg-lime-500/10 text-lime-600 dark:text-lime-400' },
  { value: 5, emoji: '😄', label: 'Great', ring: 'ring-green-400 border-green-400', bg: 'bg-green-500/10 text-green-600 dark:text-green-400' },
];

interface ScaleValues {
  feeling: number;
  energy: number;
  sleep: number;
  hasPain: boolean;
  painArea: string;
  painNote: string;
}

const EMPTY: ScaleValues = { feeling: 0, energy: 0, sleep: 0, hasPain: false, painArea: '', painNote: '' };

function scaleLabel(v: number) {
  return SCALE.find(s => s.value === v)?.label ?? '—';
}

function scoreColor(score: number) {
  return score < 4 ? 'text-red-500' : score < 7 ? 'text-amber-500' : 'text-green-500';
}

function ScaleStep({
  icon, title, subtitle, value, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-indigo-500">{icon}</span>
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{subtitle}</p>
      <div className="grid grid-cols-5 gap-2">
        {SCALE.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={clsx(
              'flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all cursor-pointer',
              value === s.value
                ? clsx('ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900', s.ring, s.bg)
                : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700',
            )}
          >
            <span className="text-2xl leading-none">{s.emoji}</span>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckedInSummary({ checkin, onEdit }: { checkin: WellbeingCheckin; onEdit: () => void }) {
  const rows = [
    { icon: <Smile size={15} />, label: 'Feeling', value: checkin.feeling },
    { icon: <Zap size={15} />, label: 'Energy', value: checkin.energy },
    { icon: <Moon size={15} />, label: 'Sleep', value: checkin.sleep },
  ];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex p-2.5 rounded-xl bg-green-500/10">
            <PartyPopper size={18} className="text-green-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">You're checked in for today</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Great habit — see you tomorrow!</p>
          </div>
        </div>
        <div className="text-right">
          <p className={clsx('text-2xl font-black', scoreColor(checkin.score))}>{checkin.score.toFixed(1)}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Wellbeing</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rows.map(r => (
          <div key={r.label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">{r.icon}</div>
            <p className="text-lg font-black text-gray-900 dark:text-white">{r.value}<span className="text-xs text-gray-400">/5</span></p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{r.label} · {scaleLabel(r.value)}</p>
          </div>
        ))}
      </div>
      {checkin.hasPain && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
          <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Pain reported{checkin.painArea ? `: ${checkin.painArea}` : ''}</p>
            {checkin.painNote && <p className="text-xs opacity-90 mt-0.5">{checkin.painNote}</p>}
          </div>
        </div>
      )}
      <button
        onClick={onEdit}
        className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
      >
        <Pencil size={14} /> Update today's check-in
      </button>
    </div>
  );
}

export function WellbeingCheckinWidget() {
  const { data: today, isLoading } = useTodayCheckin();
  const submit = useSubmitCheckin();
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ScaleValues>(EMPTY);

  if (isLoading) return null;

  // Already checked in and not editing → show the summary card.
  if (today && !editing) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <CheckedInSummary checkin={today} onEdit={() => {
          setValues({
            feeling: today.feeling, energy: today.energy, sleep: today.sleep,
            hasPain: today.hasPain, painArea: today.painArea ?? '', painNote: today.painNote ?? '',
          });
          setStep(0);
          setEditing(true);
        }} />
      </div>
    );
  }

  const TOTAL = 5;
  const set = (patch: Partial<ScaleValues>) => setValues(v => ({ ...v, ...patch }));

  const canAdvance =
    step === 0 ? values.feeling > 0 :
    step === 1 ? values.energy > 0 :
    step === 2 ? values.sleep > 0 :
    true;

  const finish = async () => {
    await submit.mutateAsync({
      feeling: values.feeling,
      energy: values.energy,
      sleep: values.sleep,
      hasPain: values.hasPain,
      painArea: values.hasPain ? values.painArea.trim() || null : null,
      painNote: values.hasPain ? values.painNote.trim() || null : null,
    });
    setEditing(false);
    setValues(EMPTY);
    setStep(0);
  };

  const previewScore = (values.feeling + values.energy + values.sleep) / 3 * 2;

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-900/10 dark:to-gray-900 p-5">
      {/* Header + progress */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
            <HeartPulse size={16} className="text-indigo-500" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">Daily Check-in</h2>
        </div>
        <span className="text-xs font-semibold text-gray-400">Step {step + 1} of {TOTAL}</span>
      </div>
      <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-indigo-500 rounded-full"
          initial={false}
          animate={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="min-h-[190px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && (
              <ScaleStep icon={<Smile size={16} />} title="How are you feeling?"
                subtitle="Your overall mood and readiness today."
                value={values.feeling} onChange={v => set({ feeling: v })} />
            )}
            {step === 1 && (
              <ScaleStep icon={<Zap size={16} />} title="Energy level"
                subtitle="How much gas do you have in the tank?"
                value={values.energy} onChange={v => set({ energy: v })} />
            )}
            {step === 2 && (
              <ScaleStep icon={<Moon size={16} />} title="Sleep quality"
                subtitle="How well did you sleep last night?"
                value={values.sleep} onChange={v => set({ sleep: v })} />
            )}
            {step === 3 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert size={16} className="text-indigo-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">Any pain or soreness?</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Let your coach know if something hurts.</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button type="button" onClick={() => set({ hasPain: false, painArea: '', painNote: '' })}
                    className={clsx('py-3 rounded-2xl border-2 font-semibold text-sm transition-all cursor-pointer',
                      !values.hasPain ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-green-400 border-green-400 bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'border-gray-100 dark:border-gray-800 text-gray-500')}>
                    😌 No pain
                  </button>
                  <button type="button" onClick={() => set({ hasPain: true })}
                    className={clsx('py-3 rounded-2xl border-2 font-semibold text-sm transition-all cursor-pointer',
                      values.hasPain ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-red-400 border-red-400 bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'border-gray-100 dark:border-gray-800 text-gray-500')}>
                    🤕 Yes, I have pain
                  </button>
                </div>
                {values.hasPain && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 overflow-hidden">
                    <input
                      value={values.painArea}
                      onChange={e => set({ painArea: e.target.value })}
                      placeholder="Where? (e.g. left hamstring, right knee)"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <textarea
                      value={values.painNote}
                      onChange={e => set({ painNote: e.target.value })}
                      placeholder="Describe it (optional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                  </motion.div>
                )}
              </div>
            )}
            {step === 4 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Check size={16} className="text-indigo-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">Review & submit</h3>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 mb-3">
                  <div className="grid grid-cols-3 gap-4 flex-1">
                    {[
                      { label: 'Feeling', v: values.feeling },
                      { label: 'Energy', v: values.energy },
                      { label: 'Sleep', v: values.sleep },
                    ].map(r => (
                      <div key={r.label} className="text-center">
                        <p className="text-lg font-black text-gray-900 dark:text-white">{r.v}<span className="text-xs text-gray-400">/5</span></p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{r.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pl-4 ml-4 border-l border-gray-100 dark:border-gray-700 text-center">
                    <p className={clsx('text-2xl font-black', scoreColor(previewScore))}>{previewScore.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Score</p>
                  </div>
                </div>
                {values.hasPain ? (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
                    <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
                    <span>Pain reported{values.painArea ? `: ${values.painArea}` : ''}. Your coach will see this.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400">
                    <Check size={16} /> <span>No pain reported — nice.</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 mt-5">
        <button
          type="button"
          onClick={() => (step === 0 ? (today ? setEditing(false) : null) : setStep(s => s - 1))}
          disabled={step === 0 && !today}
          className={clsx('flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all',
            step === 0 && !today ? 'opacity-0 pointer-events-none' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer')}
        >
          <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < TOTAL - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance}
            className={clsx('flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-semibold transition-all',
              canAdvance ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 cursor-pointer' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed')}
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            disabled={submit.isPending}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/20 transition-all cursor-pointer disabled:opacity-60"
          >
            <Check size={16} /> {submit.isPending ? 'Saving…' : 'Submit check-in'}
          </button>
        )}
      </div>
    </div>
  );
}
