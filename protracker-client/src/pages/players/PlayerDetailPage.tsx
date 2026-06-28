import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../../hooks/usePlayers';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import {
  ArrowLeft,
  Edit,
  ClipboardList,
  TrendingUp,
  Salad,
} from 'lucide-react';

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: player, isLoading } = usePlayer(Number(id));

  if (isLoading) return <PageSpinner />;
  if (!player)
    return (
      <PageWrapper>
        <p className="text-red-500">Player not found.</p>
      </PageWrapper>
    );

  const quickLinks = [
    {
      label: 'Assessment',
      icon: ClipboardList,
      path: `/players/${id}/assessment`,
      color: 'text-blue-600',
    },
    {
      label: 'Improvement Plan',
      icon: TrendingUp,
      path: `/players/${id}/improvement-plan`,
      color: 'text-green-600',
    },
    {
      label: 'Nutrition',
      icon: Salad,
      path: `/players/${id}/nutrition`,
      color: 'text-orange-600',
    },
  ];

  return (
    <PageWrapper
      title={player.fullName}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button size="sm" onClick={() => navigate(`/players/${id}/edit`)}>
            <Edit size={16} /> Edit
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={player.fullName} size="lg" />
            <h3 className="mt-3 font-bold text-lg text-gray-900 dark:text-white">
              {player.fullName}
            </h3>
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              {player.positionName && (
                <Badge variant="neutral">{player.positionName}</Badge>
              )}
              {player.teamName && (
                <Badge variant="success">{player.teamName}</Badge>
              )}
              {player.fitnessLevel != null && (
                <Badge variant="info">Fitness {player.fitnessLevel}/10</Badge>
              )}
            </div>
            {player.age && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Age {player.age}
                {player.height ? ` · ${player.height}cm` : ''}
                {player.weight ? ` · ${player.weight}kg` : ''}
              </p>
            )}
          </div>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickLinks.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
            >
              <item.icon
                size={28}
                className={`${item.color} group-hover:scale-110 transition-transform`}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
