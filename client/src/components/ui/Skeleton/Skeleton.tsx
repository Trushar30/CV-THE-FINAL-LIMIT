import type { ReactElement, HTMLAttributes, CSSProperties } from 'react';
import styles from './Skeleton.module.css';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  animated?: boolean;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  animated = true,
  className = '',
  style,
  ...props
}: SkeletonProps): ReactElement {
  const customStyle: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={styles.stack} role="status" aria-label="Loading..." {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <span
            key={index}
            className={`
              ${styles.skeleton}
              ${styles['variant-text']}
              ${animated ? styles.animated : ''}
              ${className}
            `}
            style={{
              ...customStyle,
              // Give the last line a natural shorter length for paragraph realism
              ...(index === lines - 1 && lines > 1 ? { width: width || '70%' } : {}),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading..."
      className={`
        ${styles.skeleton}
        ${styles[`variant-${variant}`]}
        ${animated ? styles.animated : ''}
        ${className}
      `}
      style={customStyle}
      {...props}
    />
  );
}

export default Skeleton;
