import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, getPostLoginRedirect } from '../../store/AuthContext';

export interface PublicOnlyRouteProps {
  children: ReactElement;
  redirectTo?: string;
}

export function PublicOnlyRoute({
  children,
  redirectTo,
}: PublicOnlyRouteProps): ReactElement {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return children;
  }

  if (isAuthenticated) {
    const destination = redirectTo || getPostLoginRedirect(user);
    return <Navigate to={destination} replace />;
  }

  return children;
}

export default PublicOnlyRoute;

