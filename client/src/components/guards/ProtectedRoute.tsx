import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { LoadingScreen } from '../common/LoadingScreen';

export interface ProtectedRouteProps {
  children: ReactElement;
}

export function ProtectedRoute({ children }: ProtectedRouteProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Verifying session authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
