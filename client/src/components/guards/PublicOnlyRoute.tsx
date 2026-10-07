import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export interface PublicOnlyRouteProps {
  children: ReactElement;
  redirectTo?: string;
}

export function PublicOnlyRoute({
  children,
  redirectTo = '/',
}: PublicOnlyRouteProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return children;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default PublicOnlyRoute;
