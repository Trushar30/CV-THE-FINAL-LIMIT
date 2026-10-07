import { forwardRef, type ReactElement, type ReactNode, type InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    id,
    required,
    disabled,
    className = '',
    ...props
  },
  ref
): ReactElement {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={styles.container}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.inputWrapper}>
        {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          className={`
            ${styles.input}
            ${leftIcon ? styles.hasLeftIcon : ''}
            ${rightIcon ? styles.hasRightIcon : ''}
            ${error ? styles.hasError : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
      </div>
      {error && (
        <p id={`${inputId}-error`} className={styles.errorMessage}>
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className={styles.helperText}>
          {helperText}
        </p>
      )}
    </div>
  );
});

export default Input;
