import { useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar/ProgressBar';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import styles from './Founder.module.css';

interface EligibilityData {
  eligible: boolean;
  currentExp: number;
  requiredExp: number;
  expDeficit: number;
  careerRole: string;
  isCurrentFounder: boolean;
  starterCoinAmount: number;
  starterCoinAvailable: boolean;
  hasUnlockedBefore: boolean;
  reason?: string;
}

export function FounderUnlockPage(): ReactElement {
  const navigate = useNavigate();
  const { user, fetchCurrentUser } = useAuth();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkEligibility(): Promise<void> {
      try {
        setLoading(true);
        const res = await apiClient.get<EligibilityData>('/founder/eligibility');
        if (isMounted) {
          setEligibility(res);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve Founder Mode eligibility';
          error(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkEligibility();

    return () => {
      isMounted = false;
    };
  }, [error]);

  const handleUnlockConfirm = async (): Promise<void> => {
    try {
      setSubmitting(true);
      await apiClient.post('/founder/unlock', { confirm: true });
      success('Founder Mode Unlocked! Welcome to Executive Command.');
      await fetchCurrentUser();
      setShowConfirmModal(false);
      navigate('/founder/company/new');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unlock Founder Mode';
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Evaluating Founder Mode telemetry...</p>
      </div>
    );
  }

  const currentExp = eligibility?.currentExp ?? user?.totalExpCached ?? 0;
  const requiredExp = eligibility?.requiredExp ?? 12000;
  const isEligible = eligibility?.eligible ?? false;
  const starterAvailable = eligibility?.starterCoinAvailable ?? false;
  const starterAmount = eligibility?.starterCoinAmount ?? 1000;

  return (
    <div className={styles.container} data-testid="founder-unlock-page">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>🚀</span> Unlock Founder Mode
          </h1>
          {user?.careerRole === 'FOUNDER' ? (
            <Badge variant="gold">Active Founder</Badge>
          ) : isEligible ? (
            <Badge variant="success">Eligible to Launch</Badge>
          ) : (
            <Badge variant="default">Level 9 Required</Badge>
          )}
        </div>
        <p className={styles.subtitle}>
          Transition from an employee to an executive founder. Form your own engineering corporation, purchase an AI workforce, and guide daily business operations.
        </p>
      </div>

      {/* Gold Starter Capital Banner */}
      <div className={styles.goldBanner}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--cv-text-lg)', color: 'var(--cv-gold-400)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🪙</span> Starter Capital Grant: {starterAmount.toLocaleString()} CorpCoin
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
            {starterAvailable
              ? 'First-time founders receive 1,000 CorpCoin in seed capital to establish a company and acquire basic bots.'
              : 'You previously unlocked Founder Mode. No additional starter CorpCoin will be granted upon re-entry.'}
          </p>
        </div>
        <div>
          {starterAvailable ? (
            <span style={{ background: 'var(--cv-gold-500)', color: '#111827', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: 'var(--cv-radius-full)', fontSize: 'var(--cv-text-xs)' }}>
              1,000 CC Available
            </span>
          ) : (
            <Badge variant="default">Already Granted</Badge>
          )}
        </div>
      </div>

      {/* EXP Progression Meter Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>⚡</span> Progression Requirement (Level 9 Lead)
          </h2>
          <span style={{ fontSize: 'var(--cv-text-sm)', fontWeight: 600, color: isEligible ? 'var(--cv-accent-emerald-400)' : 'var(--cv-text-secondary)' }}>
            {currentExp.toLocaleString()} / {requiredExp.toLocaleString()} EXP
          </span>
        </div>

        <ProgressBar
          value={Math.min(currentExp, requiredExp)}
          max={requiredExp}
          colorVariant={isEligible ? 'gold' : 'violet'}
          size="md"
          showPercentage
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>
          <span>L1 Intern (0 EXP)</span>
          <span>L5 Mid (3,000 EXP)</span>
          <span>L7 Senior (6,500 EXP)</span>
          <span style={{ color: 'var(--cv-gold-400)', fontWeight: 700 }}>L9 Lead (12,000 EXP — Unlock)</span>
        </div>
      </div>

      {/* Rules & Requirements Grid */}
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Current Track</span>
          <div className={styles.statValue} style={{ fontSize: 'var(--cv-text-lg)' }}>
            {user?.careerRole ?? 'EMPLOYEE'}
          </div>
          <span className={styles.statSubtext}>
            {user?.careerRole === 'EMPLOYEE'
              ? 'Active employee status satisfies initial unlock requirements'
              : eligibility?.hasUnlockedBefore
              ? 'Returning founder re-entry permitted'
              : 'Must reach Employee track'}
          </span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>EXP Deficit</span>
          <div className={styles.statValue} style={{ color: isEligible ? 'var(--cv-accent-emerald-400)' : 'var(--cv-status-warning-text)' }}>
            {eligibility?.expDeficit ? `${eligibility.expDeficit.toLocaleString()} EXP` : 'Ready to Unlock'}
          </div>
          <span className={styles.statSubtext}>
            {isEligible ? 'Experience threshold exceeded' : 'Complete daily engineering tasks to gain EXP'}
          </span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Company Setup Budget</span>
          <div className={styles.statValue} style={{ color: 'var(--cv-gold-400)' }}>
            850 CorpCoin
          </div>
          <span className={styles.statSubtext}>
            100 CC Company + 750 CC (3 Bots) = 850 CC. 150 CC buffer remaining.
          </span>
        </div>
      </div>

      {/* Call to Action Panel */}
      <div className={styles.sectionCard} style={{ background: 'linear-gradient(180deg, var(--cv-bg-surface) 0%, rgba(39, 62, 65, 0.15) 100%)' }}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-lg)', fontWeight: 700, color: 'var(--cv-text-primary)' }}>
              {isEligible ? 'Ready to Launch Your Corporation?' : 'Founder Mode Locked'}
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
              {isEligible
                ? 'Unlocking Founder Mode transitions your role to FOUNDER and terminates current employment.'
                : eligibility?.reason || 'You must accumulate 12,000 total career EXP to unlock company ownership.'}
            </p>
          </div>

          <Button
            variant="gold"
            size="lg"
            disabled={!isEligible}
            onClick={() => setShowConfirmModal(true)}
            data-testid="unlock-founder-button"
          >
            Launch Founder Mode ⚡
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className={styles.modalOverlay} data-testid="unlock-confirm-modal">
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Confirm Executive Transition</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)', lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>
                Please review the permanent rules for entering Founder Mode:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <strong>Prior Employment:</strong> Your active position at your current employer will be formally terminated.
                </li>
                <li>
                  <strong>Lifelong EXP Preserved:</strong> All your accumulated experience ({currentExp.toLocaleString()} EXP) is lifetime capital and remains permanently with your profile.
                </li>
                <li>
                  <strong>Starter Capital:</strong> {starterAvailable ? 'You will be credited with 1,000 CorpCoin in startup capital.' : 'No new starter coins will be granted (previously received).'}
                </li>
                <li>
                  <strong>Solvency Accountability:</strong> If company financial health falls to or below -1,000 CC, the firm will undergo bankruptcy liquidation.
                </li>
              </ul>
            </div>

            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                size="md"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="gold"
                size="md"
                loading={submitting}
                onClick={handleUnlockConfirm}
                data-testid="confirm-unlock-button"
              >
                Confirm & Unlock Founder Mode
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
