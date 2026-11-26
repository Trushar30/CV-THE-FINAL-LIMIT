import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, getPostLoginRedirect } from '../store/AuthContext';
import { MarketingLayout } from '../components/layout/MarketingLayout';
import { LandingPage } from './LandingPage';
import styles from './RootRouter.module.css';

export function RootRouter(): ReactElement {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={styles.splashContainer} aria-label="Loading CorpVerse" role="status">
        <div className={styles.splashBrand}>
          <div className={styles.splashMonogram}>C</div>
          <div className={styles.splashBarTrack}>
            <div className={styles.splashBarIndicator} />
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getPostLoginRedirect(user)} replace />;
  }

  return (
    <MarketingLayout>
      <LandingPage />
    </MarketingLayout>
  );
}

export default RootRouter;

