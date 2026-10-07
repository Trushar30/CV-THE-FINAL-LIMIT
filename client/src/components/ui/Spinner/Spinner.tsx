import type { ReactElement, HTMLAttributes } from 'react';
import styles from './Spinner.module.css';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'white' | 'cyan' | 'emerald' | 'gold' | 'muted';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
}

export function Spinner({
  size = 'md',
  color = 'primary',
  label = 'Loading...',
  className = '',
  ...props
}: SpinnerProps): ReactElement {
  return (
    <span
      role="status"
      aria-label={label}
      className={`${styles.spinner} ${styles[`size-${size}`]} ${styles[`color-${color}`]} ${className}`}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default Spinner;
