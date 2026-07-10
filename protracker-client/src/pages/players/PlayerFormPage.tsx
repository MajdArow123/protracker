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
import { useSports, usePositions } from '../../hooks/useSports';
import { useTeams } from '../../hooks/useTeams';
import { usePlayer, useCreatePlayer, useUpdatePlayer } from '../../hooks/usePlayers';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { ArrowLeft, Lock } from 'lucide-react';
import {
  type HeightUnit, type WeightUnit,
  cmToFtIn, ftInToCm, kgToLb, lbToKg,
  getStoredHeightUnit, getStoredWeightUnit,
  setStoredHeightUnit, setStoredWeightUnit,
} from '../../utils/units';

interface FormValues {
  fullName: string;
  age: string;
  heightCm: string;
  weightKg: string;
  sportId: string;
  teamId: string;
  positionId: string;
  fitnessLevel: string;
  jerseyNumber: string;
  status: string;
  goals: string;
  coachNotes: string;
  injuryNotes: string;
}

interface FormErrors {
  fullName?: string;
  age?: string;
  heightCm?: string;
  weightKg?: string;
  sportId?: string;
  fitnessLevel?: string;
}

const EMPTY: FormValues = {
  fullName: '',
  age: '',
  heightCm: '',
  weightKg: '',
  sportId: '',
  teamId: '',
  positionId: '',
  fitnessLevel: '5',
  jerseyNumber: '',
  status: 'Active',
  goals: '',
  coachNotes: '',
  injuryNotes: '',
};

type TFunc = (key: string, fallback: string) => string;

function validate(v: FormValues, t: TFunc): FormErrors {
  const e: FormErrors = {};
  if (!v.fullName.trim()) e.fullName = t('players.errNameRequired', 'Name is required');
  if (v.age) {
    const n = Number(v.age);
    if (isNaN(n) || n < 10 || n > 60) e.age = t('players.errAgeRange', 'Age must be 10–60');
  }
  if (v.heightCm) {
    const n = Number(v.heightCm);
    if (isNaN(n) || n < 100 || n > 250) e.heightCm = t('players.errHeightRange', 'Height must be 100–250 cm');
  }
  if (v.weightKg) {
    const n = Number(v.weightKg);
    if (isNaN(n) || n < 30 || n > 200) e.weightKg = t('players.errWeightRange', 'Weight must be 30–200 kg');
  }
  if (!v.sportId) e.sportId = t('players.errSportRequired', 'Sport is required');
  const fl = Number(v.fitnessLevel);
  if (isNaN(fl) || fl < 1 || fl > 10) e.fitnessLevel = t('players.errFitnessRange', 'Fitness level must be 1–10');
  return e;
}

export function PlayerFormPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
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

  // Unit preferences (saved to localStorage)
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(getStoredHeightUnit);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(getStoredWeightUnit);
  const [ftVal, setFtVal] = useState('');
  const [inVal, setInVal] = useState('');
  const [lbVal, setLbVal] = useState('');

  const { data: positions = [] } = usePositions(values.sportId ? Number(values.sportId) : undefined);

  // Determine locked sport from existing teams
  const lockedSport = teams.length > 0
    ? { id: String(teams[0].sportId), name: teams[0].sportName }
    : null;

  useEffect(() => {
    if (player && isEdit) {
      const heightCm = player.height?.toString() ?? '';
      const weightKg = player.weight?.toString() ?? '';
      setValues({
        fullName: player.fullName ?? '',
        age: player.age?.toString() ?? '',
        heightCm,
        weightKg,
        sportId: player.sportId?.toString() ?? '',
        teamId: player.teamId?.toString() ?? '',
        positionId: player.positionId?.toString() ?? '',
        fitnessLevel: player.fitnessLevel?.toString() ?? '5',
        jerseyNumber: player.jerseyNumber?.toString() ?? '',
        status: player.status ?? 'Active',
        goals: player.goals ?? '',
        coachNotes: player.coachNotes ?? '',
        injuryNotes: player.injuryNotes ?? '',
      });
      // Sync ft/in and lb display values
      const { ft, inches } = cmToFtIn(heightCm);
      setFtVal(ft);
      setInVal(inches);
      setLbVal(kgToLb(weightKg));
    } else if (!isEdit && lockedSport && !values.sportId) {
      setValues(v => ({ ...v, sportId: lockedSport.id }));
    }
  }, [player, isEdit, lockedSport?.id]);

  // Sync ft/in when switching to cm (in case user typed in cm mode)
  useEffect(() => {
    if (heightUnit === 'ftin' && values.heightCm) {
      const { ft, inches } = cmToFtIn(values.heightCm);
      setFtVal(ft);
      setInVal(inches);
    }
  }, [heightUnit]);

  // Sync lb when switching to lb
  useEffect(() => {
    if (weightUnit === 'lb' && values.weightKg) {
      setLbVal(kgToLb(values.weightKg));
    }
  }, [weightUnit]);

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched) setErrors(validate(next, t));
    if (field === 'sportId') setValues(v => ({ ...v, positionId: '', sportId: e.target.value }));
  };

  function switchHeightUnit(unit: HeightUnit) {
    setHeightUnit(unit);
    setStoredHeightUnit(unit);
    if (unit === 'ftin') {
      const { ft, inches } = cmToFtIn(values.heightCm);
      setFtVal(ft);
      setInVal(inches);
    } else {
      const cm = ftInToCm(ftVal, inVal);
      setValues(v => ({ ...v, heightCm: cm }));
    }
  }

  function switchWeightUnit(unit: WeightUnit) {
    setWeightUnit(unit);
    setStoredWeightUnit(unit);
    if (unit === 'lb') {
      setLbVal(kgToLb(values.weightKg));
    } else {
      const kg = lbToKg(lbVal);
      setValues(v => ({ ...v, weightKg: kg }));
    }
  }

  function handleFtChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFtVal(e.target.value);
    const cm = ftInToCm(e.target.value, inVal);
    setValues(v => ({ ...v, heightCm: cm }));
  }

  function handleInChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInVal(e.target.value);
    const cm = ftInToCm(ftVal, e.target.value);
    setValues(v => ({ ...v, heightCm: cm }));
  }

  function handleLbChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLbVal(e.target.value);
    setValues(v => ({ ...v, weightKg: lbToKg(e.target.value) }));
  }

  function buildPayload() {
    return {
      fullName: values.fullName.trim(),
      age: values.age ? Number(values.age) : undefined,
      height: values.heightCm ? Number(values.heightCm) : undefined,
      weight: values.weightKg ? Number(values.weightKg) : undefined,
      sportId: Number(values.sportId),
      teamId: values.teamId ? Number(values.teamId) : undefined,
      positionId: values.positionId ? Number(values.positionId) : undefined,
      fitnessLevel: Number(values.fitnessLevel),
      jerseyNumber: values.jerseyNumber ? Number(values.jerseyNumber) : null,
      status: (values.status || undefined) as import('../../types').PlayerStatus | undefined,
      goals: values.goals || undefined,
      coachNotes: values.coachNotes || undefined,
      injuryNotes: values.injuryNotes || undefined,
    };
  }

  async function autoSavePlayer() {
    const errs = validate(values, t);
    if (Object.keys(errs).length) return;
    await updatePlayer.mutateAsync({ id: Number(id), data: buildPayload() });
  }

  const { status: autoSaveStatus } = useAutoSave(isEdit, values, autoSavePlayer);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(values, t);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      const created = await createPlayer.mutateAsync(buildPayload() as Parameters<typeof createPlayer.mutateAsync>[0]);
      showToast(t('players.playerCreated', 'Player created'), 'success');
      navigate(`/players/${(created as { id: number }).id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('players.saveFailed', 'Save failed'), 'error');
    }
  }

  if (isEdit && loadingPlayer) return <PageSpinner />;

  const isLoading = createPlayer.isPending || updatePlayer.isPending;

  const unitToggleCls = (active: boolean) =>
    `px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`;

  return (
    <PageWrapper
      title={isEdit ? t('players.editPlayer', 'Edit Player') : t('players.addPlayer', 'Add Player')}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(isEdit ? `/players/${id}` : '/players')}>
          <ArrowLeft size={16} /> {t('common.back', 'Back')}
        </Button>
      }
    >
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card header={t('players.basicInfo', 'Basic Info')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label={t('players.fullNameLabel', 'Full Name *')}
                value={values.fullName}
                onChange={set('fullName')}
                error={errors.fullName}
                placeholder="Marcus Bell"
              />
            </div>
            <Input label={t('players.age', 'Age')} type="number" value={values.age} onChange={set('age')} error={errors.age} placeholder="20" min={10} max={60} />
            <Input label={t('players.jerseyNumber', 'Jersey Number')} type="number" value={values.jerseyNumber} onChange={set('jerseyNumber')} placeholder="7" min={0} max={999} />
            <Select
              label={t('common.status', 'Status')}
              value={values.status}
              onChange={set('status')}
              options={[
                { value: 'Active', label: L.status('Active') },
                { value: 'Injured', label: L.status('Injured') },
                { value: 'Suspended', label: L.status('Suspended') },
                { value: 'Inactive', label: L.status('Inactive') },
              ]}
            />

            {/* Height with unit toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('players.height', 'Height')}</label>
                <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button type="button" onClick={() => switchHeightUnit('cm')} className={unitToggleCls(heightUnit === 'cm')}>cm</button>
                  <button type="button" onClick={() => switchHeightUnit('ftin')} className={unitToggleCls(heightUnit === 'ftin')}>ft/in</button>
                </div>
              </div>
              {heightUnit === 'cm' ? (
                <input
                  type="number"
                  value={values.heightCm}
                  onChange={set('heightCm')}
                  placeholder="185"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={ftVal}
                    onChange={handleFtChange}
                    placeholder="6"
                    className="w-1/2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    value={inVal}
                    onChange={handleInChange}
                    placeholder="1"
                    min={0}
                    max={11}
                    className="w-1/2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              {errors.heightCm && <p className="text-xs text-red-500 mt-1">{errors.heightCm}</p>}
              {values.heightCm && (() => {
                const { ft, inches } = cmToFtIn(values.heightCm);
                return (
                  <p className="text-xs text-gray-400 mt-1">
                    {ft}'{inches}" = {values.heightCm} cm
                  </p>
                );
              })()}
            </div>

            {/* Weight with unit toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('players.weight', 'Weight')}</label>
                <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button type="button" onClick={() => switchWeightUnit('kg')} className={unitToggleCls(weightUnit === 'kg')}>kg</button>
                  <button type="button" onClick={() => switchWeightUnit('lb')} className={unitToggleCls(weightUnit === 'lb')}>lb</button>
                </div>
              </div>
              {weightUnit === 'kg' ? (
                <input
                  type="number"
                  value={values.weightKg}
                  onChange={set('weightKg')}
                  placeholder="80"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <input
                  type="number"
                  value={lbVal}
                  onChange={handleLbChange}
                  placeholder="176"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              {errors.weightKg && <p className="text-xs text-red-500 mt-1">{errors.weightKg}</p>}
              {values.weightKg && (
                <p className="text-xs text-gray-400 mt-1">
                  {kgToLb(values.weightKg)} lb = {values.weightKg} kg
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('players.fitnessLevel', 'Fitness Level')}: {values.fitnessLevel}/10
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

        <Card header={t('players.sportAndTeam', 'Sport & Team')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sport — locked if coach has existing teams */}
            {lockedSport && !isEdit ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('players.sportLabel', 'Sport *')}</label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <Lock size={14} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{L.sport(lockedSport.name)}</span>
                  <span className="ml-auto text-xs text-indigo-500">{t('players.locked', 'Locked')}</span>
                </div>
              </div>
            ) : (
              <Select
                label={t('players.sportLabel', 'Sport *')}
                value={values.sportId}
                onChange={set('sportId')}
                error={errors.sportId}
                options={[
                  { value: '', label: t('players.selectSport', 'Select sport…') },
                  ...sports.map(s => ({ value: String(s.id), label: L.sport(s.name) })),
                ]}
              />
            )}
            <Select
              label={t('players.team', 'Team')}
              value={values.teamId}
              onChange={set('teamId')}
              options={[
                { value: '', label: t('players.noTeam', 'No team') },
                ...teams.map(t => ({ value: String(t.id), label: t.name })),
              ]}
            />
            <Select
              label={t('players.position', 'Position')}
              value={values.positionId}
              onChange={set('positionId')}
              disabled={!values.sportId}
              options={[
                { value: '', label: t('players.selectPosition', 'Select position…') },
                ...positions.map(p => ({ value: String(p.id), label: p.name })),
              ]}
            />
          </div>
        </Card>

        <Card header={t('common.notes', 'Notes')}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('players.goals', 'Goals')}</label>
              <textarea
                value={values.goals}
                onChange={set('goals')}
                rows={3}
                placeholder={t('players.goalsPlaceholder', "Player's goals this season…")}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('players.coachNotes', 'Coach Notes')}</label>
              <textarea
                value={values.coachNotes}
                onChange={set('coachNotes')}
                rows={3}
                placeholder={t('players.coachNotesPlaceholder', 'Internal notes for coaches…')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('players.injuryNotes', 'Injury Notes')}</label>
              <textarea
                value={values.injuryNotes}
                onChange={set('injuryNotes')}
                rows={2}
                placeholder={t('players.injuryNotesPlaceholder', 'Current injury notes…')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {isEdit && <AutoSaveStatus status={autoSaveStatus} />}
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/players/${id}` : '/players')}>
            {isEdit ? t('common.back', 'Back') : t('common.cancel', 'Cancel')}
          </Button>
          {!isEdit && (
            <Button type="submit" isLoading={isLoading}>{t('players.createPlayer', 'Create Player')}</Button>
          )}
        </div>
      </form>
    </PageWrapper>
  );
}
