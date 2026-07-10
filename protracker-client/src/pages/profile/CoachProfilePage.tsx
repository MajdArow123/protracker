import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, Users, Mail, Phone, Edit2, Loader2, X, Award, Briefcase, Target, HeartPulse,
} from 'lucide-react';
import { useCoachDashboard } from '../../hooks/useDashboard';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useToast } from '../../context/ToastContext';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { EditableAvatar } from '../../components/profile/ProfileAvatar';
import { ProfileCompletionCard } from '../../components/profile/ProfileCompletionCard';
import { AccountSettingsSection } from '../../components/profile/AccountSettingsSection';
import { CoachPublicProfileSection } from '../../components/profile/CoachPublicProfileSection';
import { computeProfileCompletion } from '../../utils/profileCompletion';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.08 },
  }),
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

function ViewRow({ label, value, onEdit }: { label: string; value?: string | null; onEdit: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="group flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 whitespace-pre-wrap">{value || <span className="text-gray-400 dark:text-gray-600 font-normal">{t('profile.notSet', 'Not set')}</span>}</p>
      </div>
      <button onClick={onEdit} aria-label={t('profile.editField', 'Edit {{label}}', { label })} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-500 transition-all cursor-pointer flex-shrink-0">
        <Edit2 size={13} />
      </button>
    </div>
  );
}

export function CoachProfilePage() {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { data } = useCoachDashboard();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: '', phoneNumber: '', bio: '',
    coachingExperience: '', certifications: '', specialization: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
  });

  if (isLoading || !profile) return <DetailSkeleton />;

  const completion = computeProfileCompletion(profile);

  const startEdit = () => {
    setForm({
      displayName: profile.displayName ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      bio: profile.bio ?? '',
      coachingExperience: profile.coachingExperience ?? '',
      certifications: profile.certifications ?? '',
      specialization: profile.specialization ?? '',
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactPhone: profile.emergencyContactPhone ?? '',
      emergencyContactRelationship: profile.emergencyContactRelationship ?? '',
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.displayName.trim()) { addToast(t('profile.toast.nameEmpty', 'Name cannot be empty'), 'error'); return; }
    try {
      await updateProfile.mutateAsync(form);
      addToast(t('profile.toast.updated', 'Profile updated'), 'success');
      setEditing(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('profile.toast.saveFailed', 'Could not save profile'), 'error');
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ── Hero ── */}
        <motion.div
          custom={0} initial="hidden" animate="show" variants={fadeUp}
          className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
          <div className="h-28 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700" />
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14">
              <div className="flex flex-col items-center sm:items-start">
                <EditableAvatar name={profile.displayName} src={profile.profilePictureUrl} />
              </div>
              <div className="flex-1 min-w-0 sm:pb-1 text-center sm:text-left">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">{profile.displayName}</h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mt-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/15 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 text-xs font-semibold">
                    <Shield size={11} /> {t('profile.coach', 'Coach')}
                  </span>
                  {data?.teams?.[0]?.sportName && (
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                      {dyn.sport(data.teams[0].sportName)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={11} /> {profile.email}
                  </span>
                </div>
              </div>
              <div className="sm:pb-1 flex justify-center">
                {editing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                      <X size={13} /> {t('common.cancel', 'Cancel')}
                    </button>
                    <button onClick={save} disabled={updateProfile.isPending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer">
                      {updateProfile.isPending ? <Loader2 size={13} className="animate-spin" /> : null} {t('profile.saveChanges', 'Save Changes')}
                    </button>
                  </div>
                ) : (
                  <button onClick={startEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer">
                    <Edit2 size={13} /> {t('profile.editProfile', 'Edit Profile')}
                  </button>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="mt-4">
              {editing ? (
                <textarea
                  value={form.bio}
                  onChange={set('bio')}
                  maxLength={500}
                  rows={2}
                  placeholder={t('profile.bioPlaceholderCoach', 'Write a short bio — your coaching philosophy, background…')}
                  className={inputCls}
                />
              ) : profile.bio ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <button onClick={startEdit} className="text-sm text-gray-400 dark:text-gray-500 italic hover:text-indigo-500 transition-colors cursor-pointer">
                  {t('profile.addShortBio', '+ Add a short bio')}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Completion ── */}
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
          <ProfileCompletionCard completion={completion} />
        </motion.div>

        {/* ── Two-column info ── */}
        <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Personal information */}
          <div className="lg:col-span-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t('profile.personalInfo', 'Personal Information')}</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{t('profile.fullName', 'Full name')}</label>
                  <input value={form.displayName} onChange={set('displayName')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('profile.email', 'Email')}</label>
                  <input value={profile.email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
                </div>
                <div>
                  <label className={labelCls}>{t('profile.phoneNumber', 'Phone number')}</label>
                  <input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder={t('profile.phonePlaceholder', '+1 555 123 4567')} className={inputCls} />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <ViewRow label={t('profile.fullName', 'Full name')} value={profile.displayName} onEdit={startEdit} />
                <div className="py-2.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.email', 'Email')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{profile.email} <span className="text-[10px] text-gray-400 font-normal">{t('profile.readOnlyParen', '(read-only)')}</span></p>
                </div>
                <ViewRow label={t('profile.phoneNumber', 'Phone number')} value={profile.phoneNumber} onEdit={startEdit} />
              </div>
            )}
          </div>

          {/* Coaching info */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t('profile.coaching', 'Coaching')}</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{t('profile.experience', 'Experience')}</label>
                  <input value={form.coachingExperience} onChange={set('coachingExperience')} placeholder={t('profile.experiencePlaceholder', 'e.g. 8 years, youth academies')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('profile.certifications', 'Certifications')}</label>
                  <input value={form.certifications} onChange={set('certifications')} placeholder={t('profile.certificationsPlaceholder', 'e.g. UEFA B License')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('profile.specialization', 'Specialization')}</label>
                  <input value={form.specialization} onChange={set('specialization')} placeholder={t('profile.specializationPlaceholderCoach', 'e.g. Youth development, tactical analysis')} className={inputCls} />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <ViewRow label={t('profile.experience', 'Experience')} value={profile.coachingExperience} onEdit={startEdit} />
                <ViewRow label={t('profile.certifications', 'Certifications')} value={profile.certifications} onEdit={startEdit} />
                <ViewRow label={t('profile.specialization', 'Specialization')} value={profile.specialization} onEdit={startEdit} />
              </div>
            )}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              {[
                { icon: Briefcase, done: !!profile.coachingExperience },
                { icon: Award, done: !!profile.certifications },
                { icon: Target, done: !!profile.specialization },
              ].map(({ icon: Icon, done }, i) => (
                <div key={i} className={`p-1.5 rounded-lg ${done ? 'bg-indigo-500/10 text-indigo-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'}`}>
                  <Icon size={13} />
                </div>
              ))}
              <p className="text-[11px] text-gray-400">{t('profile.shownToAthletes', 'Shown to athletes and parents')}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Emergency contact ── */}
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <HeartPulse size={15} className="text-rose-400" /> {t('profile.emergencyContact', 'Emergency Contact')}
          </h3>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>{t('profile.ec.name', 'Name')}</label>
                <input value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder={t('profile.ec.namePlaceholderCoach', 'e.g. Sarah Daniels')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('profile.ec.phone', 'Phone')}</label>
                <input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder={t('profile.ec.phonePlaceholder', '+1 555 987 6543')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('profile.ec.relationship', 'Relationship')}</label>
                <input value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} placeholder={t('profile.ec.relationshipPlaceholderCoach', 'e.g. Partner')} className={inputCls} />
              </div>
            </div>
          ) : profile.emergencyContactName ? (
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.emergencyContactName}</p>
              {profile.emergencyContactPhone && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"><Phone size={13} /> {profile.emergencyContactPhone}</span>
              )}
              {profile.emergencyContactRelationship && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">{profile.emergencyContactRelationship}</span>
              )}
              <button onClick={startEdit} className="p-1 text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer"><Edit2 size={13} /></button>
            </div>
          ) : (
            <button onClick={startEdit} className="text-sm text-indigo-500 hover:underline font-semibold cursor-pointer">{t('profile.ec.add', '+ Add Emergency Contact')}</button>
          )}
        </motion.div>

        {/* ── Overview stats + teams (kept from previous design) ── */}
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">{t('common.overview', 'Overview')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            {[
              { label: t('profile.totalTeams', 'Total Teams'), value: data?.totalTeams ?? 0, icon: Shield, color: 'text-purple-400 bg-purple-500/10' },
              { label: t('profile.totalPlayers', 'Total Players'), value: data?.totalPlayers ?? 0, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className={`inline-flex p-2 rounded-xl mb-2 ${s.color}`}>
                  <s.icon size={16} />
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {data?.teams?.length ? (
          <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">{t('profile.myTeams', 'My Teams')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.teams.map(team => (
                <div
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}`)}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <Shield size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{team.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{dyn.sport(team.sportName)} · {t('profile.playersCount', '{{count}} players', { count: team.playerCount ?? 0 })}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* ── Public coaching profile (marketplace) ── */}
        <motion.div custom={5.5} initial="hidden" animate="show" variants={fadeUp}>
          <CoachPublicProfileSection />
        </motion.div>

        {/* ── Account settings ── */}
        <motion.div custom={6} initial="hidden" animate="show" variants={fadeUp}>
          <AccountSettingsSection isCoach />
        </motion.div>
      </div>
    </PageWrapper>
  );
}
