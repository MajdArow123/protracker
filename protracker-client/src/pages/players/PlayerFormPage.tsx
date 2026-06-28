import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { useSports, usePositions } from '../../hooks/useSports';
import { useTeams } from '../../hooks/useTeams';
import { usePlayer, useCreatePlayer, useUpdatePlayer } from '../../hooks/usePlayers';
import { ArrowLeft } from 'lucide-react';

interface FormValues {
  fullName: string;
  age: string;
  height: string;
  weight: string;
  sportId: string;
  teamId: string;
  positionId: string;
  fitnessLevel: string;
  goals: string;
  coachNotes: string;
  injuryNotes: string;
}

interface FormErrors {
  fullName?: string;
  age?: string;
  height?: string;
  weight?: string;
  sportId?: string;
  fitnessLevel?: string;
}

const EMPTY: FormValues = {
  fullName: '',
  age: '',
  height: '',
  weight: '',
  sportId: '',
  teamId: '',
  positionId: '',
  fitnessLevel: '5',
  goals: '',
  coachNotes: '',
  injuryNotes: '',
};

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.fullName.trim()) e.fullName = 'Name is required';
  if (v.age) {
    const n = Number(v.age);
    if (isNaN(n) || n < 10 || n > 60) e.age = 'Age must be 10–60';
  }
  if (v.height) {
    const n = Number(v.height);
    if (isNaN(n) || n < 100 || n > 250) e.height = 'Height must be 100–250 cm';
  }
  if (v.weight) {
    const n = Number(v.weight);
    if (isNaN(n) || n < 30 || n > 200) e.weight = 'Weight must be 30–200 kg';
  }
  if (!v.sportId) e.sportId = 'Sport is required';
  const fl = Number(v.fitnessLevel);
  if (isNaN(fl) || fl < 1 || fl > 10) e.fitnessLevel = 'Fitness level must be 1–10';
  return e;
}

export function PlayerFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading: loadingPlayer } = usePlayer(isEdit ? Number(id) : undefined);
  const { data: sports = [] } = useSports();
  const { data: teams = [] } = useTeams();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

  const { data: positions = [] } = usePositions(values.sportId ? Number(values.sportId) : undefined);

  useEffect(() => {
    if (player && isEdit) {
      setValues({
        fullName: player.fullName ?? '',
        age: player.age?.toString() ?? '',
        height: player.height?.toString() ?? '',
        weight: player.weight?.toString() ?? '',
        sportId: player.sportId?.toString() ?? '',
        teamId: player.teamId?.toString() ?? '',
        positionId: player.positionId?.toString() ?? '',
        fitnessLevel: player.fitnessLevel?.toString() ?? '5',
        goals: player.goals ?? '',
        coachNotes: player.coachNotes ?? '',
        injuryNotes: player.injuryNotes ?? '',
      });
    }
  }, [player, isEdit]);

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched) setErrors(validate(next));
    if (field === 'sportId') setValues(v => ({ ...v, positionId: '', sportId: e.target.value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      fullName: values.fullName.trim(),
      age: values.age ? Number(values.age) : undefined,
      height: values.height ? Number(values.height) : undefined,
      weight: values.weight ? Number(values.weight) : undefined,
      sportId: Number(values.sportId),
      teamId: values.teamId ? Number(values.teamId) : undefined,
      positionId: values.positionId ? Number(values.positionId) : undefined,
      fitnessLevel: Number(values.fitnessLevel),
      goals: values.goals || undefined,
      coachNotes: values.coachNotes || undefined,
      injuryNotes: values.injuryNotes || undefined,
    };

    try {
      if (isEdit) {
        await updatePlayer.mutateAsync({ id: Number(id), data: payload });
        showToast('Player updated', 'success');
        navigate(`/players/${id}`);
      } else {
        const created = await createPlayer.mutateAsync(payload as Parameters<typeof createPlayer.mutateAsync>[0]);
        showToast('Player created', 'success');
        navigate(`/players/${(created as { id: number }).id}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  if (isEdit && loadingPlayer) return <PageSpinner />;

  const isLoading = createPlayer.isPending || updatePlayer.isPending;

  return (
    <PageWrapper
      title={isEdit ? 'Edit Player' : 'Add Player'}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(isEdit ? `/players/${id}` : '/players')}>
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card header="Basic Info">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Full Name *"
                value={values.fullName}
                onChange={set('fullName')}
                error={errors.fullName}
                placeholder="Marcus Bell"
              />
            </div>
            <Input label="Age" type="number" value={values.age} onChange={set('age')} error={errors.age} placeholder="20" min={10} max={60} />
            <Input label="Height (cm)" type="number" value={values.height} onChange={set('height')} error={errors.height} placeholder="185" />
            <Input label="Weight (kg)" type="number" value={values.weight} onChange={set('weight')} error={errors.weight} placeholder="80" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fitness Level: {values.fitnessLevel}/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={values.fitnessLevel}
                onChange={set('fitnessLevel')}
                className="w-full accent-indigo-600"
              />
              {errors.fitnessLevel && <p className="text-xs text-red-500 mt-1">{errors.fitnessLevel}</p>}
            </div>
          </div>
        </Card>

        <Card header="Sport & Team">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Select
              label="Team"
              value={values.teamId}
              onChange={set('teamId')}
              options={[
                { value: '', label: 'No team' },
                ...teams.map(t => ({ value: String(t.id), label: t.name })),
              ]}
            />
            <Select
              label="Position"
              value={values.positionId}
              onChange={set('positionId')}
              disabled={!values.sportId}
              options={[
                { value: '', label: 'Select position…' },
                ...positions.map(p => ({ value: String(p.id), label: p.name })),
              ]}
            />
          </div>
        </Card>

        <Card header="Notes">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goals</label>
              <textarea
                value={values.goals}
                onChange={set('goals')}
                rows={3}
                placeholder="Player's goals this season…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coach Notes</label>
              <textarea
                value={values.coachNotes}
                onChange={set('coachNotes')}
                rows={3}
                placeholder="Internal notes for coaches…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Injury Notes</label>
              <textarea
                value={values.injuryNotes}
                onChange={set('injuryNotes')}
                rows={2}
                placeholder="Current injury notes…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/players/${id}` : '/players')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEdit ? 'Save Changes' : 'Create Player'}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
