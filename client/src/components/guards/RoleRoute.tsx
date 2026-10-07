import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type CareerRole, type PlatformRole } from '../../store/AuthContext';
import { LoadingScreen } from '../common/LoadingScreen';

export interface RoleRouteProps {
  children: ReactElement;
  allowedCareerRoles?: CareerRole[];
  allowedPlatformRoles?: PlatformRole[];
  fallbackPath?: string;
}

export function RoleRoute({
  children,
  allowedCareerRoles,
  allowedPlatformRoles,
  fallbackPath = '/unauthorized',
}: RoleRouteProps): ReactElement {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Checking role privileges..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Admins bypass normal career role restrictions if platformRole includes ADMIN
  const isAdmin = user.platformRole === 'ADMIN';

  const matchesCareerRole =
    !allowedCareerRoles ||
    allowedCareerRoles.length === 0 ||
    allowedCareerRoles.includes(user.careerRole) ||
    isAdmin;

  const matchesPlatformRole =
    !allowedPlatformRoles ||
    allowedPlatformRoles.length === 0 ||
    allowedPlatformRoles.includes(user.platformRole);

  if (!matchesCareerRole || !matchesPlatformRole) {
    if (user.careerRole === 'NONE' && !isAdmin && allowedCareerRoles?.includes('JOB_SEEKER')) {
      return <Navigate to="/profile/setup" replace />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}

export default RoleRoute;
