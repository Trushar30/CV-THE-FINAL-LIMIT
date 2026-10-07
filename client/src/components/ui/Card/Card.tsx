import type { ReactElement, ReactNode, HTMLAttributes } from 'react';
import styles from './Card.module.css';

export type CardVariant = 'default' | 'glass' | 'elevated' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
  header?: ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  header,
  title,
  subtitle,
  headerAction,
  footer,
  children,
  className = '',
  ...props
}: CardProps): ReactElement {
  const hasCustomHeader = Boolean(header);
  const hasTitleHeader = Boolean(title || subtitle || headerAction);

  return (
    <div
      className={`
        ${styles.card}
        ${styles[`variant-${variant}`]}
        ${styles[`padding-${padding}`]}
        ${hoverable ? styles.hoverable : ''}
        ${className}
      `}
      {...props}
    >
      {hasCustomHeader && <div className={styles.header}>{header}</div>}
      {!hasCustomHeader && hasTitleHeader && (
        <div className={styles.header}>
          <div>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

export default Card;
