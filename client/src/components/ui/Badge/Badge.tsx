import type { ReactElement, ReactNode, HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant =
  'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gold' | 'cyan';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
  ...props
}: BadgeProps): ReactElement {
  return (
    <span
      className={`${styles.badge} ${styles[`variant-${variant}`]} ${styles[`size-${size}`]} ${className}`}
      {...props}
    >
      {dot && <span className={styles.dot} />}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
