import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button/Button';
import { AlertCircleIcon } from '../ui/Icon';
import styles from './TypedConfirmationModal.module.css';

export interface TypedConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  description: string;
  expectedToken: string;
  confirmButtonText?: string;
  loading?: boolean;
}

export const TypedConfirmationModal: React.FC<TypedConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  expectedToken,
  confirmButtonText = 'Confirm Destructive Action',
  loading = false,
}) => {
  const [typedToken, setTypedToken] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedToken('');
      setReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTokenMatch = typedToken.trim() === expectedToken;
  const isReasonValid = reason.trim().length >= 10;
  const canConfirm = isTokenMatch && isReasonValid && !loading;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm(reason.trim());
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" data-testid="typed-confirmation-modal">
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div className={styles.dangerIcon}>
            <AlertCircleIcon size={20} color="#ef4444" />
          </div>
          <h3 className={styles.modalTitle}>{title}</h3>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.warningText}>{description}</p>

          <div className={styles.instructionBox}>
            To proceed, type the exact confirmation phrase <span className={styles.targetToken}>{expectedToken}</span> below.
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="typed-confirmation-input">
              Confirmation Phrase
            </label>
            <input
              id="typed-confirmation-input"
              type="text"
              className={styles.inputControl}
              value={typedToken}
              onChange={(e) => setTypedToken(e.target.value)}
              placeholder={expectedToken}
              autoFocus
              data-testid="confirmation-token-input"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="mandatory-audit-reason-input">
              Mandatory Justification Reason (min 10 characters)
            </label>
            <textarea
              id="mandatory-audit-reason-input"
              className={`${styles.inputControl} ${styles.textareaControl}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear, detailed audit rationale for this dangerous operation..."
              data-testid="confirmation-reason-input"
            />
            <span className={styles.charCount}>
              {reason.trim().length} / 10 characters required
            </span>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <button
            type="button"
            className={`${styles.dangerButton} ${styles.pageButton || ''}`}
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
            data-testid="confirm-destructive-action-btn"
          >
            {loading ? 'Processing...' : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TypedConfirmationModal;
