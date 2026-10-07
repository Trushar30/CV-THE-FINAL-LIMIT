import type { ReactElement } from 'react';
import { Spinner } from '../ui/Spinner/Spinner';
import styles from './Loading.module.css';

export interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps): ReactElement {
  return (
    <div className={styles.overlayContainer} role="status" aria-live="polite">
      <Spinner size="md" color="primary" label={message} />
      {message && <p className={styles.overlayText}>{message}</p>}
    </div>
  );
}

export default LoadingOverlay;
