import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ArrowRight, Camera, ChevronDown, Loader2, PartyPopper, Ruler, Salad, ShieldAlert, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { EditableAvatar } from './ProfileAvatar';
import { useToast } from '../../context/ToastContext';
import { useUpdateProfile, useCompleteOnboarding } from '../../hooks/useProfile';
import { usePlayerNutritionProfile, useCreateProfileItem, useDeleteProfileItem } from '../../hooks/useNutrition';
import type { Profile } from '../../api/profileApi';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, getStoredHeightUnit, getStoredWeightUnit } from '../../utils/units';

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

const RESTRICTION_CATEGORIES = ['NutAllergy', 'DairyFree', 'GlutenFree', 'Halal', 'Vegan', 'Vegetarian', 'Custom'];
const CATEGORY_LABELS: Record<string, string> = { NutAllergy: 'Nuts', DairyFree: 'Dairy', GlutenFree: 'Gluten' };

const SEVERITY_STYLES: Record<string, string> = {
  Hard: 'bg-red-500/20 text-red-400',
  Lifestyle: 'bg-amber-500/20 text-amber-400',
  Soft: 'bg-gray-500/20 text-gray-400',
};

// First-login athlete onboarding: 3 quick steps (photo → physicals → dietary).
// Finishing OR skipping marks onboarding complete so it never nags again;
// the dashboard completion-reminder card takes over from there.
export function OnboardingModal({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const updateProfile = useUpdateProfile();
  const completeOnboarding = useCompleteOnboarding();
  const playerId = profile.playerId ?? 0;
  const { data: dietaryItems = [] } = usePlayerNutritionProfile(playerId);
  const createRestriction = useCreateProfileItem(playerId);
  const deleteRestriction = useDeleteProfileItem(playerId);

  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(1);

  // Step 2 — physicals (canonical cm/kg)
  const [heightUnit, setHeightUnit] = useState(getStoredHeightUnit());
  const [weightUnit, setWeightUnit] = useState(getStoredWeightUnit());
  const [heightCm, setHeightCm] = useState(profile.height ? String(Math.round(profile.height)) : '');
  const [heightFt, setHeightFt] = useState(profile.height ? cmToFtIn(profile.height).ft : '');
  const [heightIn, setHeightIn] = useState(profile.height ? cmToFtIn(profile.height).inches : '');
  const [weightVal, setWeightVal] = useState(
    profile.weight ? (getStoredWeightUnit() === 'kg' ? String(profile.weight) : kgToLb(profile.weight)) : '',
  );

  // Step 3 — dietary
  const [rCategory, setRCategory] = useState('NutAllergy');
  const [rSeverity, setRSeverity] = useState('Hard');
  const [rItem, setRItem] = useState('');

  const finish = async () => {
    try {
      await completeOnboarding.mutateAsync();
    } catch { /* non-fatal — modal still closes; reminder card covers the rest */ }
    setOpen(false);
  };

  const savePhysicals = async () => {
    const effHeight = heightUnit === 'cm' ? parseFloat(heightCm) : parseFloat(ftInToCm(heightFt, heightIn));
    const effWeight = weightUnit === 'kg' ? parseFloat(weightVal) : parseFloat(lbToKg(weightVal));
    if (!Number.isFinite(effHeight) || !Number.isFinite(effWeight)) {
      setStep(3); // nothing entered — treat as skip
      return;
    }
    try {
      await updateProfile.mutateAsync({
        displayName: profile.displayName,
        height: Math.round(effHeight * 10) / 10,
        weight: Math.round(effWeight * 10) / 10,
      });
      addToast(t('profile.onboarding.physicalsSaved', 'Physical stats saved'), 'success');
      setStep(3);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('profile.onboarding.saveFailed', 'Could not save'), 'error');
    }
  };

  const addRestriction = async () => {
    if (!playerId) return;
    if (rCategory === 'Custom' && !rItem.trim()) { addToast(t('profile.dietary.describeCustom', 'Describe the custom restriction'), 'error'); return; }
    try {
      await createRestriction.mutateAsync({
        preferenceType: rSeverity === 'Hard' ? 'Allergy' : rSeverity === 'Lifestyle' ? 'Lifestyle' : 'SoftPreference',
        category: rCategory,
        specificItem: rItem.trim() || null,
        severity: rSeverity,
      });
      setRItem('');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('profile.dietary.addFailed', 'Could not add restriction'), 'error');
    }
  };

  const firstName = profile.displayName.split(' ')[0];

  return (
    <Modal isOpen={open} onClose={finish} title="" size="md">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-4 -mt-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={clsx('h-1.5 rounded-full transition-all', s === step ? 'w-6 bg-indigo-500' : 'w-1.5 bg-gray-300 dark:bg-gray-700')} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mb-3">
            <PartyPopper size={22} className="text-indigo-500" />
          </div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">{t('profile.onboarding.welcome', 'Welcome to ProTracker, {{name}}!', { name: firstName })}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5 max-w-sm">
            {t('profile.onboarding.welcomeSubtitle', "Let's set up your profile in three quick steps. First — add a photo so your coach and teammates recognize you.")}
          </p>
          <EditableAvatar name={profile.displayName} src={profile.profilePictureUrl} />
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-3">
            <Camera size={11} /> {t('profile.onboarding.photoHint', 'Click or drop an image — or skip for now')}
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full mt-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {profile.profilePictureUrl ? t('common.next', 'Next') : t('profile.onboarding.skipPhoto', 'Skip photo for now')} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Ruler size={18} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">{t('profile.onboarding.physicalsTitle', 'Your physical stats')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('profile.onboarding.physicalsSubtitle', 'Used for assessments and AI nutrition planning.')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('profile.height', 'Height')}</label>
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                  {(['cm', 'ftin'] as const).map(u => (
                    <button key={u} type="button"
                      onClick={() => {
                        if (u === heightUnit) return;
                        if (u === 'ftin' && heightCm) { const { ft, inches } = cmToFtIn(heightCm); setHeightFt(ft); setHeightIn(inches); }
                        else if (u === 'cm' && (heightFt || heightIn)) setHeightCm(ftInToCm(heightFt, heightIn));
                        setHeightUnit(u);
                      }}
                      className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer', heightUnit === u ? 'bg-indigo-600 text-white' : 'text-gray-400')}
                    >
                      {u === 'cm' ? 'cm' : 'ft/in'}
                    </button>
                  ))}
                </div>
              </div>
              {heightUnit === 'cm' ? (
                <input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" className={inputCls} autoFocus />
              ) : (
                <div className="flex gap-2">
                  <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5" className={inputCls} aria-label={t('profile.feet', 'feet')} />
                  <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="9" className={inputCls} aria-label={t('profile.inches', 'inches')} />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('profile.weight', 'Weight')}</label>
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                  {(['kg', 'lb'] as const).map(u => (
                    <button key={u} type="button"
                      onClick={() => {
                        if (u === weightUnit) return;
                        setWeightVal(v => v ? (u === 'lb' ? kgToLb(v) : lbToKg(v)) : v);
                        setWeightUnit(u);
                      }}
                      className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer', weightUnit === u ? 'bg-indigo-600 text-white' : 'text-gray-400')}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input type="number" inputMode="decimal" value={weightVal} onChange={e => setWeightVal(e.target.value)} placeholder={weightUnit === 'kg' ? '70' : '155'} className={inputCls} />
            </div>
          </div>
          <button
            onClick={savePhysicals}
            disabled={updateProfile.isPending}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {updateProfile.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            {heightCm || heightFt || weightVal ? t('profile.onboarding.saveContinue', 'Save & continue') : t('profile.onboarding.skipForNow', 'Skip for now')} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Salad size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">{t('profile.onboarding.dietaryTitle', 'Any dietary restrictions?')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('profile.onboarding.dietarySubtitle', 'Shared with your coach and used for AI nutrition planning. Optional.')}</p>
            </div>
          </div>

          {dietaryItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dietaryItems.map(item => (
                <span key={item.id} className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', SEVERITY_STYLES[item.severity] ?? 'bg-gray-500/20 text-gray-400')}>
                  {item.severity === 'Hard' && <ShieldAlert size={10} />}
                  {t(`profile.dietary.category.${item.category}`, CATEGORY_LABELS[item.category] ?? item.category)}{item.specificItem ? ` (${item.specificItem})` : ''}
                  <button onClick={() => deleteRestriction.mutateAsync(item.id).catch(() => {})} aria-label={t('common.remove', 'Remove')} className="opacity-60 hover:opacity-100 cursor-pointer">
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="relative">
              <label className={labelCls}>{t('profile.dietary.category.label', 'Category')}</label>
              <select value={rCategory} onChange={e => setRCategory(e.target.value)} className={clsx(inputCls, 'appearance-none cursor-pointer')}>
                {RESTRICTION_CATEGORIES.map(c => <option key={c} value={c}>{t(`profile.dietary.category.${c}`, CATEGORY_LABELS[c] ?? c)}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 bottom-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <label className={labelCls}>{t('profile.dietary.severity', 'Severity')}</label>
              <select value={rSeverity} onChange={e => setRSeverity(e.target.value)} className={clsx(inputCls, 'appearance-none cursor-pointer')}>
                <option value="Hard">{t('profile.dietary.severityHard', 'Hard (allergy)')}</option>
                <option value="Lifestyle">{t('profile.dietary.severityModerate', 'Moderate (lifestyle)')}</option>
                <option value="Soft">{t('profile.dietary.severitySoft', 'Soft (preference)')}</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 bottom-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex gap-2 mb-5">
            <input value={rItem} onChange={e => setRItem(e.target.value)} placeholder={rCategory === 'Custom' ? t('profile.dietary.customPlaceholder', 'e.g. shellfish (required)') : t('profile.dietary.itemPlaceholder', 'Specific item (optional)')} className={inputCls} />
            <button
              onClick={addRestriction}
              disabled={createRestriction.isPending}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
            >
              {t('common.add', 'Add')}
            </button>
          </div>

          <button
            onClick={finish}
            disabled={completeOnboarding.isPending}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {completeOnboarding.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            {dietaryItems.length > 0 ? t('profile.onboarding.completeSetup', 'Complete Setup') : t('profile.onboarding.skipComplete', 'Skip & Complete Setup')}
          </button>
        </div>
      )}

      {/* Global skip — always available */}
      <button onClick={finish} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-3 cursor-pointer">
        {t('profile.onboarding.skipLater', "Skip for now — I'll do this later")}
      </button>
    </Modal>
  );
}
