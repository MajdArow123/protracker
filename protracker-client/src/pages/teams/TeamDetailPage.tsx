import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeam, useDeleteTeam } from '../../hooks/useTeams';
import { usePlayers } from '../../hooks/usePlayers';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Edit, Trash2, Plus, User } from 'lucide-react';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const teamId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: team, isLoading } = useTeam(teamId);
  const { data: allPlayers = [] } = usePlayers();
  const deleteTeam = useDeleteTeam();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const teamPlayers = allPlayers.filter(p => p.teamId === teamId);

  if (isLoading) return <PageSpinner />;
  if (!team) return <PageWrapper><p className="text-red-500">Team not found.</p></PageWrapper>;

  return (
    <PageWrapper
      title={team.name}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/teams')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/teams/${id}/edit`)}>
            <Edit size={16} /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Sport</dt>
              <dd className="font-medium text-gray-800 dark:text-gray-200 mt-1">{team.sportName}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Players</dt>
              <dd className="mt-1"><Badge variant="info">{teamPlayers.length}</Badge></dd>
            </div>
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Roster</h3>
            <Button size="sm" onClick={() => navigate('/players/new')}>
              <Plus size={16} /> Add Player
            </Button>
          </div>

          {teamPlayers.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <User size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No players on this team yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teamPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/players/${p.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <Avatar name={p.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{p.fullName}</p>
                    {p.positionName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.positionName}</p>
                    )}
                  </div>
                  {p.fitnessLevel != null && (
                    <Badge variant="info" className="shrink-0">Fit {p.fitnessLevel}/10</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteTeam.mutateAsync(teamId);
            showToast('Team deleted', 'success');
            navigate('/teams');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
          } finally { setConfirmDelete(false); }
        }}
        title="Delete Team"
        message={`Permanently delete "${team.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteTeam.isPending}
      />
    </PageWrapper>
  );
}
