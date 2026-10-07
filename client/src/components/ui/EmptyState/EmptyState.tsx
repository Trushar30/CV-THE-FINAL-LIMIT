import type { ReactElement, ReactNode, HTMLAttributes } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = '📁',
  title,
  description,
  action,
  className = '',
  ...props
}: EmptyStateProps): ReactElement {
  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.iconWrapper}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.actionWrapper}>{action}</div>}
    </div>
  );
}

export default EmptyState;
