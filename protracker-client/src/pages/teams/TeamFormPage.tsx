import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { useSports } from '../../hooks/useSports';
import { useTeam, useTeams, useCreateTeam, useUpdateTeam } from '../../hooks/useTeams';
import { ArrowLeft, Lock } from 'lucide-react';

interface FormValues { name: string; sportId: string; }
interface FormErrors { name?: string; sportId?: string; }

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim()) e.name = 'Team name is required';
  if (!v.sportId) e.sportId = 'Sport is required';
  return e;
}

export function TeamFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: team, isLoading: loadingTeam } = useTeam(isEdit ? Number(id) : undefined);
  const { data: sports = [] } = useSports();
  const { data: existingTeams = [] } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();

  const [values, setValues] = useState<FormValues>({ name: '', sportId: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

  // Determine locked sport from existing teams (sport locking per coach)
  const lockedSport = existingTeams.length > 0
    ? { id: String(existingTeams[0].sportId), name: existingTeams[0].sportName }
    : null;

  useEffect(() => {
    if (team && isEdit) {
      setValues({ name: team.name, sportId: String(team.sportId) });
    } else if (!isEdit && lockedSport && !values.sportId) {
      setValues(v => ({ ...v, sportId: lockedSport.id }));
    }
  }, [team, isEdit, lockedSport?.id]);

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched) setErrors(validate(next));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = { name: values.name.trim(), sportId: Number(values.sportId) };

    try {
      if (isEdit) {
        await updateTeam.mutateAsync({ id: Number(id), data: payload });
        showToast('Team updated', 'success');
        navigate(`/teams/${id}`);
      } else {
        const created = await createTeam.mutateAsync(payload as Parameters<typeof createTeam.mutateAsync>[0]);
        showToast('Team created', 'success');
        navigate(`/teams/${(created as { id: number }).id}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  if (isEdit && loadingTeam) return <PageSpinner />;
  const isLoading = createTeam.isPending || updateTeam.isPending;

  return (
    <PageWrapper
      title={isEdit ? 'Edit Team' : 'New Team'}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(isEdit ? `/teams/${id}` : '/teams')}>
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
      <form onSubmit={submit} className="max-w-md space-y-6">
        <Card>
          <div className="space-y-4">
            <Input
              label="Team Name *"
              value={values.name}
              onChange={set('name')}
              error={errors.name}
              placeholder="Riverside Hawks"
            />

            {/* Sport field — locked if coach already has teams */}
            {lockedSport && !isEdit ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sport
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <Lock size={14} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    {lockedSport.name}
                  </span>
                  <span className="ml-auto text-xs text-indigo-500">Locked to your sport</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  All your teams must be in the same sport.
                </p>
              </div>
            ) : (
              <Select
                label="Sport *"
                value={values.sportId}
                onChange={set('sportId')}
                error={errors.sportId}
                options={[
                  { value: '', label: 'Select sport…' },
                  ...sports.map(s => ({ value: String(s.id), label: s.name })),
                ]}
              />
            )}
          </div>
        </Card>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/teams/${id}` : '/teams')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEdit ? 'Save Changes' : 'Create Team'}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
