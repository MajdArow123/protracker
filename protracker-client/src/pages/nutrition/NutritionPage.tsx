import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { PageSpinner } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { usePlayer } from '../../hooks/usePlayers';
import {
  usePlayerNutritionProfile,
  useCreateProfileItem,
  useUpdateProfileItem,
  useDeleteProfileItem,
  usePlayerNutritionGuidance,
  useCreateGuidance,
  useUpdateGuidance,
} from '../../hooks/useNutrition';
import { ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react';
import type { NutritionProfileItem, NutritionGuidance } from '../../types';

type Tab = 'profile' | 'guidance';

const PREFERENCE_TYPES = ['Allergy', 'Lifestyle', 'SoftPreference'];
const CATEGORIES = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'GlutenFree', 'NutAllergy', 'DairyFree', 'NoEggs', 'NoFish', 'NoRedMeat', 'LowFODMAP', 'Custom'];
const SEVERITIES = ['Hard', 'Lifestyle', 'Soft'];

const TEXTAREA_CLS = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none';

const SEVERITY_COLORS: Record<string, string> = {
  Hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Lifestyle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Soft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

interface ProfileForm {
  preferenceType: string;
  category: string;
  specificItem: string;
  severity: string;
  notes: string;
}

const EMPTY_PROFILE: ProfileForm = { preferenceType: 'Allergy', category: 'Custom', specificItem: '', severity: 'Hard', notes: '' };

const GUIDANCE_FIELDS: { key: keyof NutritionGuidance; label: string; placeholder: string }[] = [
  { key: 'goal', label: 'Goal', placeholder: 'Performance goal…' },
  { key: 'mealSuggestions', label: 'Meal Suggestions', placeholder: 'Breakfast, lunch, dinner ideas…' },
  { key: 'hydrationTips', label: 'Hydration Tips', placeholder: 'Daily water intake, electrolytes…' },
  { key: 'recoveryTips', label: 'Recovery Tips', placeholder: 'Post-training nutrition…' },
  { key: 'foodsToPrioritize', label: 'Foods to Prioritize', placeholder: 'High-value foods…' },
  { key: 'foodsToLimit', label: 'Foods to Limit', placeholder: 'Foods to avoid or minimize…' },
];

export function NutritionPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId);
  const { data: profileItems = [], isLoading: loadingProfile } = usePlayerNutritionProfile(playerId);
  const { data: guidanceList = [] } = usePlayerNutritionGuidance(playerId);
  const createItem = useCreateProfileItem(playerId);
  const updateItem = useUpdateProfileItem(playerId);
  const deleteItem = useDeleteProfileItem(playerId);
  const createGuidance = useCreateGuidance();
  const updateGuidance = useUpdateGuidance();

  const [tab, setTab] = useState<Tab>('profile');

  // Profile form state
  const [editingItem, setEditingItem] = useState<NutritionProfileItem | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [deleteTarget, setDeleteTarget] = useState<NutritionProfileItem | null>(null);

  // Guidance form state
  const [editingGuidance, setEditingGuidance] = useState<NutritionGuidance | null>(null);
  const [showNewGuidance, setShowNewGuidance] = useState(false);
  const [guidanceForm, setGuidanceForm] = useState<Partial<Record<keyof NutritionGuidance, string>>>({});

  function openNewItem() {
    setEditingItem(null);
    setProfileForm(EMPTY_PROFILE);
    setShowNewItem(true);
  }

  function openEditItem(item: NutritionProfileItem) {
    setEditingItem(item);
    setProfileForm({
      preferenceType: item.preferenceType,
      category: item.category,
      specificItem: item.specificItem ?? '',
      severity: item.severity,
      notes: item.notes ?? '',
    });
    setShowNewItem(false);
  }

  async function saveProfileItem() {
    const data = {
      preferenceType: profileForm.preferenceType,
      category: profileForm.category,
      specificItem: profileForm.specificItem || undefined,
      severity: profileForm.severity,
      notes: profileForm.notes || undefined,
    } as Omit<NutritionProfileItem, 'id' | 'playerId'>;

    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, data });
        showToast('Item updated', 'success');
        setEditingItem(null);
      } else {
        await createItem.mutateAsync(data);
        showToast('Item added', 'success');
        setShowNewItem(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  function openNewGuidance() {
    setEditingGuidance(null);
    setGuidanceForm({});
    setShowNewGuidance(true);
  }

  function openEditGuidance(g: NutritionGuidance) {
    setEditingGuidance(g);
    const f: typeof guidanceForm = {};
    GUIDANCE_FIELDS.forEach(field => { f[field.key] = String(g[field.key] ?? ''); });
    setGuidanceForm(f);
    setShowNewGuidance(false);
  }

  async function saveGuidance() {
    const payload: Partial<NutritionGuidance> = { playerId };
    GUIDANCE_FIELDS.forEach(f => {
      (payload as Record<string, unknown>)[f.key as string] = guidanceForm[f.key] || undefined;
    });

    try {
      if (editingGuidance) {
        await updateGuidance.mutateAsync({ id: editingGuidance.id, data: payload });
        showToast('Guidance updated', 'success');
        setEditingGuidance(null);
      } else {
        await createGuidance.mutateAsync(payload);
        showToast('Guidance created', 'success');
        setShowNewGuidance(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  if (loadingPlayer || loadingProfile) return <PageSpinner />;

  const isItemFormOpen = showNewItem || !!editingItem;
  const isGuidanceFormOpen = showNewGuidance || !!editingGuidance;

  return (
    <PageWrapper
      title={`Nutrition — ${player?.fullName ?? ''}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(`/players/${id}`)}>
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
      <div className="flex gap-2 mb-6">
        {(['profile', 'guidance'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t === 'profile' ? 'Dietary Profile' : 'Nutrition Guidance'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="max-w-2xl space-y-4">
          {!isItemFormOpen && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewItem}>
                <Plus size={16} /> Add Preference
              </Button>
            </div>
          )}

          {isItemFormOpen && (
            <Card header={editingItem ? 'Edit Preference' : 'New Preference'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Type"
                  value={profileForm.preferenceType}
                  onChange={e => setProfileForm(v => ({ ...v, preferenceType: e.target.value }))}
                  options={PREFERENCE_TYPES.map(t => ({ value: t, label: t }))}
                />
                <Select
                  label="Category"
                  value={profileForm.category}
                  onChange={e => setProfileForm(v => ({ ...v, category: e.target.value }))}
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                />
                <Select
                  label="Severity"
                  value={profileForm.severity}
                  onChange={e => setProfileForm(v => ({ ...v, severity: e.target.value }))}
                  options={SEVERITIES.map(s => ({ value: s, label: s }))}
                />
                <Input
                  label="Specific Item"
                  value={profileForm.specificItem}
                  onChange={e => setProfileForm(v => ({ ...v, specificItem: e.target.value }))}
                  placeholder="e.g. peanuts"
                />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={profileForm.notes}
                    onChange={e => setProfileForm(v => ({ ...v, notes: e.target.value }))}
                    rows={2}
                    placeholder="Additional notes…"
                    className={TEXTAREA_CLS}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={() => { setEditingItem(null); setShowNewItem(false); }}>
                  Cancel
                </Button>
                <Button
                  onClick={saveProfileItem}
                  isLoading={createItem.isPending || updateItem.isPending}
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </Button>
              </div>
            </Card>
          )}

          {profileItems.length === 0 && !isItemFormOpen ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              <p className="mb-4">No dietary preferences set.</p>
              <Button onClick={openNewItem}><Plus size={16} /> Add First Preference</Button>
            </div>
          ) : (
            profileItems.map(item => (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">{item.category}</span>
                      {item.specificItem && (
                        <span className="text-sm text-gray-500">({item.specificItem})</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[item.severity] ?? ''}`}>
                        {item.severity}
                      </span>
                      <span className="text-xs text-gray-500">{item.preferenceType}</span>
                    </div>
                    {item.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                      <Edit2 size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'guidance' && (
        <div className="max-w-2xl space-y-4">
          {!isGuidanceFormOpen && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewGuidance}>
                <Plus size={16} /> New Guidance
              </Button>
            </div>
          )}

          {isGuidanceFormOpen && (
            <Card header={editingGuidance ? 'Edit Guidance' : 'New Guidance'}>
              <div className="space-y-4">
                {GUIDANCE_FIELDS.map(f => (
                  <div key={String(f.key)}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                    <textarea
                      value={guidanceForm[f.key] ?? ''}
                      onChange={e => setGuidanceForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      rows={2}
                      placeholder={f.placeholder}
                      className={TEXTAREA_CLS}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={() => { setEditingGuidance(null); setShowNewGuidance(false); }}>
                  Cancel
                </Button>
                <Button
                  onClick={saveGuidance}
                  isLoading={createGuidance.isPending || updateGuidance.isPending}
                >
                  {editingGuidance ? 'Save Changes' : 'Create Guidance'}
                </Button>
              </div>
            </Card>
          )}

          {guidanceList.length === 0 && !isGuidanceFormOpen ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              <p className="mb-4">No nutrition guidance yet.</p>
              <Button onClick={openNewGuidance}><Plus size={16} /> Create Guidance</Button>
            </div>
          ) : (
            guidanceList.map((g, i) => (
              <Card key={g.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {i === 0 ? 'Latest Guidance' : `Guidance — ${g.createdDate}`}
                    </p>
                    <p className="text-xs text-gray-500">{g.createdDate}</p>
                    {g.isAIGenerated && (
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">AI Generated</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEditGuidance(g)}>
                    <Edit2 size={15} />
                  </Button>
                </div>
                <div className="space-y-3">
                  {GUIDANCE_FIELDS.map(f => g[f.key] ? (
                    <div key={String(f.key)}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{f.label}</p>
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{String(g[f.key])}</p>
                    </div>
                  ) : null)}
                  {g.disclaimer && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 italic border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                      {g.disclaimer}
                    </p>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteItem.mutateAsync(deleteTarget.id);
            showToast('Preference deleted', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
          } finally {
            setDeleteTarget(null);
          }
        }}
        title="Delete Preference"
        message={`Remove "${deleteTarget?.category}" from dietary profile?`}
        confirmLabel="Delete"
        isLoading={deleteItem.isPending}
      />
    </PageWrapper>
  );
}
