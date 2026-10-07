import type { ReactElement, ReactNode, ButtonHTMLAttributes } from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps): ReactElement {
  const spinnerColor =
    variant === 'primary' || variant === 'danger' || variant === 'cyan'
      ? 'white'
      : variant === 'gold'
        ? 'muted'
        : 'primary';

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`
        ${styles.button}
        ${styles[`variant-${variant}`]}
        ${styles[`size-${size}`]}
        ${fullWidth ? styles.fullWidth : ''}
        ${loading ? styles.loading : ''}
        ${className}
      `}
      {...props}
    >
      {loading && <Spinner size={size === 'lg' ? 'md' : 'sm'} color={spinnerColor} />}
      {!loading && leftIcon && <span className={styles.icon}>{leftIcon}</span>}
      <span>{children}</span>
      {!loading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
    </button>
  );
}

export default Button;
