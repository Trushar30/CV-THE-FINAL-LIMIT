import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  closeOnBackdropClick?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  closeOnBackdropClick = true,
}: ModalProps): ReactElement | null {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-desc' : undefined}
        className={`${styles.modal} ${styles[`size-${size}`]}`}
      >
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id="modal-desc" className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
