import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PageSpinner } from '../../components/ui/Spinner';
import { AutoSaveStatus } from '../../components/ui/AutoSaveStatus';
import { useToast } from '../../context/ToastContext';
import { useSports } from '../../hooks/useSports';
import { useTeam, useTeams, useCreateTeam, useUpdateTeam } from '../../hooks/useTeams';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { ArrowLeft, Lock } from 'lucide-react';

interface FormValues { name: string; sportId: string; foundedYear: string; description: string; }
interface FormErrors { name?: string; sportId?: string; foundedYear?: string; description?: string; }

type TFunc = (key: string, fallback: string, opts?: Record<string, unknown>) => string;

function validate(v: FormValues, t: TFunc): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim()) e.name = t('teams.errNameRequired', 'Team name is required');
  if (!v.sportId) e.sportId = t('teams.errSportRequired', 'Sport is required');
  if (v.foundedYear) {
    const y = Number(v.foundedYear);
    if (isNaN(y) || y < 1850 || y > new Date().getFullYear()) e.foundedYear = t('teams.errYearRange', 'Year must be 1850–{{year}}', { year: new Date().getFullYear() });
  }
  if (v.description.length > 500) e.description = t('teams.errMaxChars', 'Max 500 characters');
  return e;
}

export function TeamFormPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: team, isLoading: loadingTeam } = useTeam(isEdit ? Number(id) : undefined);
  const { data: sports = [] } = useSports();
  const { data: existingTeams = [] } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();

  const [values, setValues] = useState<FormValues>({ name: '', sportId: '', foundedYear: '', description: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

  // Determine locked sport from existing teams (sport locking per coach)
  const lockedSport = existingTeams.length > 0
    ? { id: String(existingTeams[0].sportId), name: existingTeams[0].sportName }
    : null;

  useEffect(() => {
    if (team && isEdit) {
      setValues({
        name: team.name,
        sportId: String(team.sportId),
        foundedYear: team.foundedYear?.toString() ?? '',
        description: team.description ?? '',
      });
    } else if (!isEdit && lockedSport && !values.sportId) {
      setValues(v => ({ ...v, sportId: lockedSport.id }));
    }
  }, [team, isEdit, lockedSport?.id]);

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched) setErrors(validate(next, t));
  };

  function buildPayload() {
    return {
      name: values.name.trim(),
      sportId: Number(values.sportId),
      foundedYear: values.foundedYear ? Number(values.foundedYear) : null,
      description: values.description.trim() || null,
    };
  }

  async function autoSaveTeam() {
    const errs = validate(values, t);
    if (Object.keys(errs).length) return;
    await updateTeam.mutateAsync({ id: Number(id), data: buildPayload() });
  }

  const { status: autoSaveStatus } = useAutoSave(isEdit, values, autoSaveTeam);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(values, t);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = buildPayload();

    try {
      const created = await createTeam.mutateAsync(payload as Parameters<typeof createTeam.mutateAsync>[0]);
      showToast(t('teams.teamCreated', 'Team created'), 'success');
      navigate(`/teams/${(created as { id: number }).id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('teams.saveFailed', 'Save failed'), 'error');
    }
  }

  if (isEdit && loadingTeam) return <PageSpinner />;
  const isLoading = createTeam.isPending || updateTeam.isPending;

  return (
    <PageWrapper
      title={isEdit ? t('teams.editTeam', 'Edit Team') : t('teams.newTeam', 'New Team')}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(isEdit ? `/teams/${id}` : '/teams')}>
          <ArrowLeft size={16} /> {t('common.back', 'Back')}
        </Button>
      }
    >
      <form onSubmit={submit} className="max-w-md space-y-6">
        <Card>
          <div className="space-y-4">
            <Input
              label={t('teams.teamNameLabel', 'Team Name *')}
              value={values.name}
              onChange={set('name')}
              error={errors.name}
              placeholder="Riverside Hawks"
            />

            {/* Sport field — locked if coach already has teams */}
            {lockedSport && !isEdit ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('teams.sport', 'Sport')}
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <Lock size={14} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    {L.sport(lockedSport.name)}
                  </span>
                  <span className="ml-auto text-xs text-indigo-500">{t('teams.lockedToSport', 'Locked to your sport')}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('teams.sameSportNote', 'All your teams must be in the same sport.')}
                </p>
              </div>
            ) : (
              <Select
                label={t('teams.sportLabel', 'Sport *')}
                value={values.sportId}
                onChange={set('sportId')}
                error={errors.sportId}
                options={[
                  { value: '', label: t('teams.selectSport', 'Select sport…') },
                  ...sports.map(s => ({ value: String(s.id), label: L.sport(s.name) })),
                ]}
              />
            )}

            <Input
              label={t('teams.foundedYear', 'Founded Year')}
              type="number"
              value={values.foundedYear}
              onChange={set('foundedYear')}
              error={errors.foundedYear}
              placeholder={t('teams.foundedYearPlaceholder', 'e.g. 2015')}
              min={1850}
              max={new Date().getFullYear()}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.description', 'Description')}
              </label>
              <textarea
                value={values.description}
                onChange={set('description')}
                maxLength={500}
                rows={3}
                placeholder={t('teams.descriptionPlaceholder', 'A short description of the team — level, ambitions, training culture…')}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none transition-all"
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              <p className="text-xs text-gray-400 mt-1 text-right">{values.description.length}/500</p>
            </div>
          </div>
        </Card>
        <div className="flex items-center justify-end gap-3">
          {isEdit && <AutoSaveStatus status={autoSaveStatus} />}
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/teams/${id}` : '/teams')}>
            {isEdit ? t('common.back', 'Back') : t('common.cancel', 'Cancel')}
          </Button>
          {!isEdit && (
            <Button type="submit" isLoading={isLoading}>{t('teams.createTeam', 'Create Team')}</Button>
          )}
        </div>
      </form>
    </PageWrapper>
  );
}
