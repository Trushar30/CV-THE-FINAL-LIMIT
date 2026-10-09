import { useEffect, type ReactElement } from 'react';
import type { RejectionFeedback } from '../../api/career';
import { Badge } from '../ui/Badge/Badge';
import { Button } from '../ui/Button/Button';
import {
  CloseIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  SparklesIcon,
} from '../ui/Icon';
import styles from './FeedbackModal.module.css';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedback: RejectionFeedback | null;
  companyName?: string;
  jobTitle?: string;
}

export function FeedbackModal({
  isOpen,
  onClose,
  feedback,
  companyName,
  jobTitle,
}: FeedbackModalProps): ReactElement | null {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !feedback) {
    return null;
  }

  const stageFormatted = feedback.rejectionStage.replace(/_/g, ' ');

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
      data-testid="feedback-modal"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 id="feedback-dialog-title" className={styles.title}>
                Stage Diagnostic Feedback
              </h2>
              <Badge variant="danger" size="sm">
                {stageFormatted}
              </Badge>
            </div>
            {(jobTitle || companyName) && (
              <p className={styles.subtitle}>
                {jobTitle} {companyName ? `at ${companyName}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close feedback modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Missing Skills Tag Cloud (if present) */}
          {feedback.missingSkills && feedback.missingSkills.length > 0 && (
            <div className={styles.section} data-testid="feedback-missing-skills">
              <div className={`${styles.sectionHeader} ${styles.sectionHeaderMissing}`}>
                <AlertCircleIcon size={14} color="var(--cv-feedback-error)" />
                <span>Missing Requisition Competencies</span>
              </div>
              <div className={styles.skillCloud}>
                {feedback.missingSkills.map((skill) => (
                  <span key={skill} className={styles.skillPill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Strengths */}
          {feedback.strengths && feedback.strengths.length > 0 && (
            <div className={styles.section} data-testid="feedback-strengths">
              <div className={`${styles.sectionHeader} ${styles.sectionHeaderPositive}`}>
                <CheckCircle2Icon size={14} color="var(--cv-feedback-success)" />
                <span>Demonstrated Strengths</span>
              </div>
              <ul className={styles.list}>
                {feedback.strengths.map((str, i) => (
                  <li key={i} className={styles.listItem}>
                    <span>•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {feedback.weaknesses && feedback.weaknesses.length > 0 && (
            <div className={styles.section} data-testid="feedback-weaknesses">
              <div className={`${styles.sectionHeader} ${styles.sectionHeaderWarning}`}>
                <AlertCircleIcon size={14} color="var(--cv-feedback-warning)" />
                <span>Identified Improvement Areas</span>
              </div>
              <ul className={styles.list}>
                {feedback.weaknesses.map((weakness, i) => (
                  <li key={i} className={styles.listItem}>
                    <span>•</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actionable Suggestions */}
          {feedback.actionableSuggestions && feedback.actionableSuggestions.length > 0 && (
            <div className={styles.section} data-testid="feedback-improvements">
              <div className={`${styles.sectionHeader} ${styles.sectionHeaderAction}`}>
                <SparklesIcon size={14} color="var(--cv-brand-primary-500)" />
                <span>Actionable Recommendations</span>
              </div>
              <ul className={styles.list}>
                {feedback.actionableSuggestions.map((rec, i) => (
                  <li key={i} className={styles.listItem}>
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;
