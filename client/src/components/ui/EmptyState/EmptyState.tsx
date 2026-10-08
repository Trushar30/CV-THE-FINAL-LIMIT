import type { ReactElement, ReactNode, HTMLAttributes } from 'react';
import { FolderEmptyIcon } from '../Icon/Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className = '',
  ...props
}: EmptyStateProps): ReactElement {
  return (
    <div className={`${styles.container} ${className}`} {...props}>
      {illustration ? (
        <div className={styles.illustrationWrapper}>{illustration}</div>
      ) : (
        <div className={styles.iconWrapper}>{icon || <FolderEmptyIcon size={26} />}</div>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.actionWrapper}>{action}</div>}
    </div>
  );
}

export default EmptyState;
