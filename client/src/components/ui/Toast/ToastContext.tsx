import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  CheckIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  CloseIcon,
} from '../Icon';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function renderToastIcon(type: ToastType): ReactElement {
  switch (type) {
    case 'success':
      return <CheckIcon size={16} color="var(--cv-accent-emerald-400)" />;
    case 'error':
      return <AlertCircleIcon size={16} color="var(--cv-status-danger-text)" />;
    case 'warning':
      return <AlertTriangleIcon size={16} color="var(--cv-accent-amber-400)" />;
    case 'info':
    default:
      return <AlertCircleIcon size={16} color="var(--cv-brand-400)" />;
  }
}

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, item]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast('success', message, title, duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast('error', message, title, duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast('warning', message, title, duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast('info', message, title, duration),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismissToast }}>
      {children}
      <aside aria-label="Notifications" className={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`${styles.toast} ${styles[`type-${t.type}`]}`}>
            <span className={styles.icon}>{renderToastIcon(t.type)}</span>
            <div className={styles.content}>
              {t.title && <div className={styles.title}>{t.title}</div>}
              <div className={styles.message}>{t.message}</div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastProvider;
