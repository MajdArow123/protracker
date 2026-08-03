import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { PageSpinner } from '../ui/Spinner';
import type { Role } from '../../types';

interface Props {
  roles?: Role[];
}

export function ProtectedRoute({ roles }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const home = user.role === 'Coach' ? '/dashboard' : user.role === 'Parent' ? '/parent-dashboard' : user.role === 'SoloAthlete' ? '/solo-dashboard' : '/player-dashboard';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
