import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Spinner } from '../components/ui/Spinner/Spinner';
import { LandingPage } from './LandingPage';

export function RootRouter(): ReactElement {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 'var(--cv-space-4)',
        }}
      >
        <Spinner size="lg" color="cyan" label="Connecting to CorpVerse session..." />
        <span style={{ fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
          Authenticating session...
        </span>
      </div>
    );
  }

  if (user) {
    // Platform administrative roles priority
    if (user.platformRole === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    if (user.platformRole === 'AI_MANAGER') {
      return <Navigate to="/ai-ops" replace />;
    }

    // Career role progression routing
    if (user.careerRole === 'EMPLOYEE') {
      return <Navigate to="/workplace" replace />;
    }
    if (user.careerRole === 'FOUNDER') {
      return <Navigate to="/founder" replace />;
    }
    if (user.careerRole === 'JOB_SEEKER') {
      return <Navigate to="/career" replace />;
    }
    if (user.careerRole === 'NONE') {
      if (!user.emailVerified) {
        return <Navigate to="/verify-email" replace />;
      }
      return <Navigate to="/profile/setup" replace />;
    }
  }

  // Unauthenticated guests see the Landing Page
  return <LandingPage />;
}

export default RootRouter;
