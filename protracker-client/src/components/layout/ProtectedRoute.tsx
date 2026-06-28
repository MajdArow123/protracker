import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
    return (
      <Navigate
        to={user.role === 'Coach' ? '/dashboard' : '/player-dashboard'}
        replace
      />
    );
  }

  return <Outlet />;
}
