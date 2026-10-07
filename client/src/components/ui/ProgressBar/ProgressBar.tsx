import type { ReactElement, HTMLAttributes } from 'react';
import styles from './ProgressBar.module.css';

export type ProgressColorVariant = 'primary' | 'cyan' | 'emerald' | 'gold' | 'violet' | 'rose';
export type ProgressSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: ProgressSize;
  colorVariant?: ProgressColorVariant;
  animated?: boolean;
  glow?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = 'md',
  colorVariant = 'primary',
  animated = false,
  glow = false,
  className = '',
  ...props
}: ProgressBarProps): ReactElement {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div
      className={`
        ${styles.container}
        ${styles[`size-${size}`]}
        ${styles[`variant-${colorVariant}`]}
        ${animated ? styles.animated : ''}
        ${glow ? styles.glow : ''}
        ${className}
      `}
      {...props}
    >
      {(label || showPercentage) && (
        <div className={styles.labelRow}>
          {label && <span>{label}</span>}
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={styles.bar} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default ProgressBar;
