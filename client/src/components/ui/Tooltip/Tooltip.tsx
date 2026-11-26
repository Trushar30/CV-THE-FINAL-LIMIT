import { useState, type ReactElement, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  className?: string;
}

export function Tooltip({
  content,
  position = 'top',
  children,
  className = '',
}: TooltipProps): ReactElement {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`${styles.wrapper} ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {content && (
        <div
          role="tooltip"
          aria-hidden={!isVisible}
          className={`${styles.tooltip} ${styles[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
