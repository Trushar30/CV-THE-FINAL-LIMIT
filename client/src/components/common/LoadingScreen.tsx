import type { ReactElement } from 'react';
import { Spinner } from '../ui/Spinner/Spinner';
import styles from './Loading.module.css';

export interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = 'Initializing simulation environment...',
}: LoadingScreenProps): ReactElement {
  return (
    <div className={styles.screenContainer} role="status" aria-live="polite">
      <div className={styles.brandLogo}>CorpVerse</div>
      <Spinner size="lg" color="cyan" label={message} />
      <p className={styles.screenText}>{message}</p>
    </div>
  );
}

export default LoadingScreen;
