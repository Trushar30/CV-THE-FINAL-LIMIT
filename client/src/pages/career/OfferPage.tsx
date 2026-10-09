import { useState, useEffect, type ReactElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  careerApi,
  type ApplicationOfferData,
  type ApplicationListItem,
  type OfferNegotiationEntry,
} from '../../api/career';
import { useAuth } from '../../store/AuthContext';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import {
  ArrowLeftIcon,
  TrophyIcon,
  SendIcon,
  CheckCircle2Icon,
  BriefcaseIcon,
} from '../../components/ui/Icon';
import styles from './OfferPage.module.css';

export function OfferPage(): ReactElement {
  const { id: applicationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchCurrentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [appDetails, setAppDetails] = useState<ApplicationListItem | null>(null);
  const [offer, setOffer] = useState<ApplicationOfferData | null>(null);

  // Negotiation input state
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [requestedSalary, setRequestedSalary] = useState<string>('');
  const [negotiating, setNegotiating] = useState(false);

  // Modal actions
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [isAcceptedSuccess, setIsAcceptedSuccess] = useState(false);

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!applicationId) return;

    const fetchOfferData = async (): Promise<void> => {
      try {
        setLoading(true);
        const [appRes, offerRes] = await Promise.all([
          careerApi.getApplication(applicationId),
          careerApi.getOffer(applicationId),
        ]);
        setAppDetails(appRes.application);
        setOffer(offerRes.offer);
        if (offerRes.offer.status === 'ACCEPTED') {
          setIsAcceptedSuccess(true);
        }
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    };

    void fetchOfferData();
  }, [applicationId]);

  const handleNegotiate = async (): Promise<void> => {
    if (!applicationId || !negotiationMessage.trim() || negotiating) return;

    const salaryNumber = requestedSalary ? Number(requestedSalary) : undefined;
    try {
      setNegotiating(true);
      const res = await careerApi.negotiateOffer(
        applicationId,
        negotiationMessage.trim(),
        salaryNumber
      );
      setOffer(res.offer);
      setNegotiationMessage('');
      setRequestedSalary('');
    } catch {
      // Handle error
    } finally {
      setNegotiating(false);
    }
  };

  const handleAcceptOffer = async (): Promise<void> => {
    if (!applicationId || accepting) return;
    try {
      setAccepting(true);
      await careerApi.acceptOffer(applicationId);
      setIsAcceptedSuccess(true);
      setAcceptModalOpen(false);
      if (fetchCurrentUser) {
        await fetchCurrentUser();
      }
    } catch {
      // Handle error
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineOffer = async (): Promise<void> => {
    if (!applicationId || declining) return;
    try {
      setDeclining(true);
      await careerApi.declineOffer(applicationId, declineReason);
      setDeclineModalOpen(false);
      navigate('/applications');
    } catch {
      // Handle error
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 16px' }}>
        <h3>Offer Not Found</h3>
        <Button variant="secondary" onClick={() => navigate('/applications')}>
          Return to Applications
        </Button>
      </div>
    );
  }

  // Celebration state when accepted
  if (isAcceptedSuccess) {
    return (
      <div className={styles.container}>
        <div className={styles.celebrationCard} data-testid="offer-accepted-celebration">
          <TrophyIcon size={56} color="var(--cv-gold-400)" />
          <div>
            <h2>Congratulations! You are officially hired.</h2>
            <p style={{ color: 'var(--cv-text-secondary)', fontSize: 'var(--cv-text-sm)', maxWidth: '480px', margin: '8px auto 0' }}>
              You have accepted the offer for <strong>{offer.positionTitle}</strong> at{' '}
              <strong>{appDetails?.companyId?.name}</strong> at Level {offer.level} with an
              annual simulated salary of <strong>${offer.salarySimulated.toLocaleString()}</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/workplace')}
              data-testid="enter-workplace-btn"
            >
              <BriefcaseIcon size={18} />
              Enter Corporate Workplace
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/applications')}>
              View Applications
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const rangeSpan = Math.max(1, offer.salaryMax - offer.salaryMin);
  const salaryPercent = Math.min(
    100,
    Math.max(0, ((offer.salarySimulated - offer.salaryMin) / rangeSpan) * 100)
  );

  const canNegotiate =
    offer.status === 'OFFERED' && offer.negotiationRoundsLeft > 0;

  return (
    <div className={styles.container} data-testid="offer-page">
      {/* Top Navigation */}
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          color: 'var(--cv-text-secondary)',
          fontSize: 'var(--cv-text-xs)',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
        }}
        onClick={() => navigate('/applications')}
      >
        <ArrowLeftIcon size={14} />
        <span>Back to Applications</span>
      </button>

      {/* Executive Header Banner */}
      <div className={styles.executiveBanner}>
        <div className={styles.bannerTop}>
          <div className={styles.titleGroup}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Badge variant="success" size="md">
                Formal Employment Offer
              </Badge>
              <Badge variant="default" size="md">
                Status: {offer.status}
              </Badge>
            </div>
            <h1>{offer.positionTitle}</h1>
            <p className={styles.subtitle}>
              Extended by <strong>{appDetails?.companyId?.name}</strong> based on evaluated multi-stage performance.
            </p>
          </div>
        </div>

        {/* Offer Terms Summary Cards */}
        <div className={styles.termsGrid}>
          <div className={styles.termCard}>
            <span className={styles.termLabel}>Annual Simulated Salary</span>
            <span className={`${styles.termValue} ${styles.termValueHighlight}`}>
              ${offer.salarySimulated.toLocaleString()}
            </span>
            <div className={styles.salaryBandMeter}>
              <div className={styles.meterBar}>
                <div className={styles.meterFill} style={{ width: `${salaryPercent}%` }} />
              </div>
              <div className={styles.meterLabels}>
                <span>${offer.salaryMin.toLocaleString()}</span>
                <span>Band: Level {offer.level}</span>
                <span>${offer.salaryMax.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className={styles.termCard}>
            <span className={styles.termLabel}>Engineering Seniority Level</span>
            <span className={styles.termValue}>Level {offer.level}</span>
            <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
              Standard Tier Progression
            </span>
          </div>

          <div className={styles.termCard}>
            <span className={styles.termLabel}>Negotiation Rounds</span>
            <span className={styles.termValue}>
              {offer.negotiationRoundsLeft} / {offer.maxNegotiationRounds}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
              {offer.negotiationRoundsLeft > 0 ? 'Active AI Negotiator' : 'Rounds Exhausted'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Negotiation Section */}
      <div className={styles.negotiationSection} data-testid="negotiation-section">
        <div className={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
              Compensation Negotiation Dialogue
            </h3>
            <span className={styles.roundsPill} data-testid="rounds-left-pill">
              {offer.negotiationRoundsLeft} round{offer.negotiationRoundsLeft === 1 ? '' : 's'} remaining
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
            Strictly bounded by Level {offer.level} Band
          </span>
        </div>

        {/* Dialogue History */}
        <div className={styles.chatHistory} data-testid="negotiation-history">
          {(!offer.negotiationHistory || offer.negotiationHistory.length === 0) ? (
            <div className={styles.emptyNegotiation}>
              <p style={{ margin: 0, fontWeight: 600 }}>No negotiation turns submitted yet.</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--cv-text-muted)' }}>
                You may submit up to {offer.maxNegotiationRounds} counter-offers with justification to request salary adjustments within the authorized band.
              </p>
            </div>
          ) : (
            offer.negotiationHistory.map((turn: OfferNegotiationEntry, i: number) => (
              <div key={i} className={styles.negotiationTurn} data-testid={`negotiation-turn-${turn.round}`}>
                <div className={styles.turnHeader}>
                  <span>Round {turn.round}</span>
                  {turn.counterOfferSalary && (
                    <span style={{ color: 'var(--cv-brand-primary-500)', fontWeight: 700 }}>
                      Adjusted: ${turn.counterOfferSalary.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className={styles.candidateTurnBubble}>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>
                    You {turn.requestedSalary ? `(Requested: $${turn.requestedSalary.toLocaleString()})` : ''}:
                  </strong>
                  {turn.candidateMessage}
                </div>
                <div className={styles.aiCounterBubble}>
                  <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--cv-text-primary)' }}>
                    Hiring Manager:
                  </strong>
                  {turn.aiResponse}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Negotiation Input (if active and rounds left) */}
        {canNegotiate && (
          <div className={styles.negotiationComposer} data-testid="negotiation-composer">
            <div className={styles.composerInputs}>
              <textarea
                className={styles.negotiateTextarea}
                placeholder="State your compensation counter-offer and justification..."
                value={negotiationMessage}
                onChange={(e) => setNegotiationMessage(e.target.value)}
                disabled={negotiating}
                data-testid="negotiation-message-input"
              />
              <div className={styles.salaryInputGroup}>
                <label>Target Salary ($)</label>
                <input
                  type="number"
                  className={styles.salaryInput}
                  placeholder={`e.g. ${offer.salaryMax}`}
                  value={requestedSalary}
                  onChange={(e) => setRequestedSalary(e.target.value)}
                  disabled={negotiating}
                  data-testid="negotiation-salary-input"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleNegotiate()}
                disabled={negotiating || !negotiationMessage.trim()}
                data-testid="submit-negotiation-btn"
              >
                {negotiating ? <Spinner size="sm" color="white" /> : <SendIcon size={16} />}
                Submit Counter-Offer
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Decision Bottom Bar */}
      {offer.status === 'OFFERED' && (
        <div className={styles.decisionBar} data-testid="offer-decision-bar">
          <div className={styles.decisionInfo}>
            <h4>Ready to make a decision?</h4>
            <p>
              Accepting will transition your career role to Employee and withdraw any other active applications.
            </p>
          </div>

          <div className={styles.decisionButtons}>
            <Button
              variant="outline"
              size="md"
              onClick={() => setDeclineModalOpen(true)}
              data-testid="decline-offer-btn"
            >
              Decline Offer
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setAcceptModalOpen(true)}
              data-testid="accept-offer-btn"
            >
              <CheckCircle2Icon size={16} />
              Accept Employment Offer
            </Button>
          </div>
        </div>
      )}

      {/* Accept Confirmation Dialog */}
      {acceptModalOpen && (
        <div className={styles.withdrawModalOverlay} role="dialog" aria-modal="true">
          <div className={styles.withdrawModal}>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
              Confirm Offer Acceptance
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)', lineHeight: 1.5 }}>
              By accepting this offer, you will join <strong>{appDetails?.companyId?.name}</strong> as a{' '}
              <strong>{offer.positionTitle}</strong> at <strong>${offer.salarySimulated.toLocaleString()}</strong>.
              All other open applications will be automatically withdrawn.
            </p>
            <div className={styles.withdrawActions}>
              <Button variant="secondary" size="sm" onClick={() => setAcceptModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleAcceptOffer()}
                disabled={accepting}
                data-testid="confirm-accept-btn"
              >
                {accepting ? <Spinner size="sm" color="white" /> : 'Confirm Acceptance'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Confirmation Dialog */}
      {declineModalOpen && (
        <div className={styles.withdrawModalOverlay} role="dialog" aria-modal="true">
          <div className={styles.withdrawModal}>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
              Decline Employment Offer
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to decline this offer? This will close the application and free up your active application slot.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                Decline Reason (optional)
              </label>
              <textarea
                className={styles.withdrawTextarea}
                placeholder="Reason for declining..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
            <div className={styles.withdrawActions}>
              <Button variant="secondary" size="sm" onClick={() => setDeclineModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDeclineOffer()}
                disabled={declining}
                data-testid="confirm-decline-btn"
              >
                {declining ? <Spinner size="sm" color="white" /> : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OfferPage;
