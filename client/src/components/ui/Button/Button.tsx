import type { ReactElement, ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { Spinner } from '../Spinner/Spinner';
import { SPRING_FAST } from '../Motion/motionTokens';
import styles from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
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
  type = 'button',
  ...props
}: ButtonProps): ReactElement {
  const spinnerColor =
    variant === 'primary' || variant === 'danger' || variant === 'cyan'
      ? 'white'
      : variant === 'gold'
        ? 'muted'
        : 'primary';

  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={SPRING_FAST}
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
      <span className={styles.content}>{children}</span>
      {!loading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
    </motion.button>
  );
}

export default Button;
