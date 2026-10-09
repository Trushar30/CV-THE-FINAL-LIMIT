import { useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  careerApi,
  type ApplicationListItem,
  type ApplicationStage,
  type RejectionFeedback,
} from '../../api/career';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import {
  BriefcaseIcon,
  CheckIcon,
  CloseIcon,
  SparklesIcon,
  EmptyApplicationIllustration,
} from '../../components/ui/Icon';
import { FeedbackModal } from '../../components/career/FeedbackModal';
import styles from './ApplicationsTrackerPage.module.css';

const PIPELINE_STAGES: Array<{ key: ApplicationStage; label: string }> = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'ATS_SCREENING', label: 'ATS' },
  { key: 'SCREENING', label: 'Screening' },
  { key: 'ASSESSMENT', label: 'Assessment' },
  { key: 'INTERVIEW', label: 'Interview' },
  { key: 'FINAL_REVIEW', label: 'Final Review' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'ACCEPTED', label: 'Hired' },
];

function getStageIndex(stage: ApplicationStage): number {
  return PIPELINE_STAGES.findIndex((s) => s.key === stage);
}

function getStatusBadge(status: string): ReactElement {
  switch (status) {
    case 'ACTIVE':
      return <Badge variant="info" size="sm">Active</Badge>;
    case 'ACCEPTED':
      return <Badge variant="success" size="sm">Accepted</Badge>;
    case 'REJECTED':
      return <Badge variant="danger" size="sm">Rejected</Badge>;
    case 'WITHDRAWN':
      return <Badge variant="default" size="sm">Withdrawn</Badge>;
    case 'EXPIRED':
      return <Badge variant="warning" size="sm">Expired</Badge>;
    default:
      return <Badge variant="default" size="sm">{status}</Badge>;
  }
}

export function ApplicationsTrackerPage(): ReactElement {
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  
  // Feedback Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<RejectionFeedback | null>(null);
  const [feedbackLoadingAppId, setFeedbackLoadingAppId] = useState<string | null>(null);
  const [feedbackAppMeta, setFeedbackAppMeta] = useState<{ company: string; job: string }>({
    company: '',
    job: '',
  });

  // Withdraw Modal State
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAppId, setWithdrawAppId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const navigate = useNavigate();

  const fetchApplications = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await careerApi.getApplications({ limit: 50 });
      setApplications(res.applications || []);
    } catch {
      // Keep empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
  }, []);

  const activeApplications = applications.filter((app) => app.status === 'ACTIVE');
  const activeCount = activeApplications.length;
  const maxQuota = 5;

  const filteredApplications = applications.filter((app) => {
    if (filterTab === 'ACTIVE') return app.status === 'ACTIVE';
    if (filterTab === 'ARCHIVED') return app.status !== 'ACTIVE';
    return true;
  });

  const handleOpenFeedback = async (app: ApplicationListItem): Promise<void> => {
    try {
      setFeedbackLoadingAppId(app._id);
      setFeedbackAppMeta({
        company: app.companyId?.name || '',
        job: app.jobId?.title || '',
      });
      const res = await careerApi.getApplicationFeedback(app._id);
      setSelectedFeedback(res.feedback);
      setFeedbackModalOpen(true);
    } catch {
      // Failed to load feedback
    } finally {
      setFeedbackLoadingAppId(null);
    }
  };

  const handleOpenWithdraw = (appId: string): void => {
    setWithdrawAppId(appId);
    setWithdrawReason('');
    setWithdrawModalOpen(true);
  };

  const handleConfirmWithdraw = async (): Promise<void> => {
    if (!withdrawAppId) return;
    try {
      setWithdrawing(true);
      await careerApi.withdrawApplication(withdrawAppId, withdrawReason);
      setWithdrawModalOpen(false);
      setWithdrawAppId(null);
      await fetchApplications();
    } catch {
      // Handle error
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className={styles.pageContainer} data-testid="applications-tracker-page">
      {/* Header Banner */}
      <div className={styles.headerBanner}>
        <div className={styles.bannerTop}>
          <div className={styles.titleArea}>
            <h1>Hiring Journey & Applications</h1>
            <p className={styles.subtitle}>
              Monitor ATS evaluations, technical interviews, and salary offers across partner companies.
            </p>
          </div>

          {/* Active Applications Quota Meter */}
          <div className={styles.quotaWidget} data-testid="active-quota-widget">
            <div className={styles.quotaHeader}>
              <span>Active Applications</span>
              <span className={styles.quotaCount} data-testid="quota-counter">
                {activeCount} / {maxQuota}
              </span>
            </div>
            <div className={styles.quotaBar}>
              <div
                className={styles.quotaFill}
                style={{ width: `${Math.min(100, (activeCount / maxQuota) * 100)}%` }}
              />
            </div>
            <span style={{ fontSize: '10px', color: 'var(--cv-text-muted)' }}>
              Max 5 concurrent active pipelines allowed
            </span>
          </div>
        </div>

        {/* Filter Tabs & Job Explorer CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div className={styles.filterTabs} role="tablist">
            <button
              type="button"
              className={`${styles.filterTab} ${filterTab === 'ALL' ? styles.filterTabActive : ''}`}
              onClick={() => setFilterTab('ALL')}
            >
              All Applications ({applications.length})
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${filterTab === 'ACTIVE' ? styles.filterTabActive : ''}`}
              onClick={() => setFilterTab('ACTIVE')}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${filterTab === 'ARCHIVED' ? styles.filterTabActive : ''}`}
              onClick={() => setFilterTab('ARCHIVED')}
            >
              Archived ({applications.length - activeCount})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/jobs')}
          >
            <BriefcaseIcon size={14} />
            Browse Open Jobs
          </Button>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : filteredApplications.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 16px',
            background: 'var(--cv-bg-surface-elevated)',
            borderRadius: 'var(--cv-radius-xl)',
            border: '1px solid var(--cv-border-subtle)',
            textAlign: 'center',
            gap: '16px',
          }}
          data-testid="applications-empty-state"
        >
          <EmptyApplicationIllustration size={96} />
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 'var(--cv-text-lg)', fontWeight: 700 }}>
              {filterTab === 'ACTIVE' ? 'No Active Applications' : 'No Applications Found'}
            </h3>
            <p style={{ margin: 0, color: 'var(--cv-text-secondary)', fontSize: 'var(--cv-text-sm)', maxWidth: '420px' }}>
              Explore partner enterprise requisitions and submit an application to begin AI-driven ATS screening.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => navigate('/jobs')}>
            <BriefcaseIcon size={16} />
            Explore Job Openings
          </Button>
        </div>
      ) : (
        <div className={styles.applicationsList}>
          {filteredApplications.map((app) => {
            const currentIdx = getStageIndex(app.currentStage);
            const isChatStage = ['SCREENING', 'ASSESSMENT', 'INTERVIEW'].includes(app.currentStage);
            const isOfferStage = app.currentStage === 'OFFER';
            const isRejected = app.status === 'REJECTED';
            const isAccepted = app.status === 'ACCEPTED';
            const isActive = app.status === 'ACTIVE';

            return (
              <div
                key={app._id}
                className={styles.applicationCard}
                data-testid={`application-card-${app._id}`}
              >
                {/* Header Information */}
                <div className={styles.cardHeader}>
                  <div className={styles.jobInfo}>
                    <h3 className={styles.jobTitle}>
                      {app.jobId?.title || 'Engineering Role'}
                    </h3>
                    <div className={styles.jobMeta}>
                      <span className={styles.companyName}>
                        {app.companyId?.name || 'Partner Corporation'}
                      </span>
                      <span>•</span>
                      <span>L{app.jobId?.minLevel ?? 1} - L{app.jobId?.maxLevel ?? 4}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>
                        {app.jobId?.domain?.replace(/_/g, ' ').toLowerCase() || 'Software'}
                      </span>
                      {app.atsScore !== undefined && (
                        <>
                          <span>•</span>
                          <span style={{ fontWeight: 600, color: 'var(--cv-brand-primary-500)' }}>
                            ATS Score: {app.atsScore}/100
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={styles.statusGroup}>
                    {getStatusBadge(app.status)}
                  </div>
                </div>

                {/* 8-Stage Visual Pipeline Stepper */}
                <div className={styles.stepperContainer} data-testid="stepper-pipeline">
                  <span className={styles.stepperLabel}>Application Pipeline</span>
                  <div className={styles.pipeline}>
                    <div className={styles.stepLine} />
                    {PIPELINE_STAGES.map((stage, idx) => {
                      let isCompleted = false;
                      let isCurrent = false;
                      let isFailed = false;

                      if (isAccepted) {
                        isCompleted = true;
                      } else if (idx < currentIdx) {
                        isCompleted = true;
                      } else if (idx === currentIdx) {
                        if (isRejected) {
                          isFailed = true;
                        } else {
                          isCurrent = true;
                        }
                      }

                      let circleClass = styles.stepCircle;
                      if (isCompleted) circleClass += ` ${styles.completed}`;
                      else if (isFailed) circleClass += ` ${styles.rejected}`;
                      else if (isCurrent) circleClass += ` ${styles.current}`;

                      return (
                        <div key={stage.key} className={styles.stepItem}>
                          <div className={circleClass}>
                            {isCompleted ? (
                              <CheckIcon size={14} color="#ffffff" />
                            ) : isFailed ? (
                              <CloseIcon size={14} color="#ffffff" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span
                            className={`${styles.stepName} ${
                              isCurrent || isCompleted ? styles.active : ''
                            }`}
                          >
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className={styles.cardFooter}>
                  <div className={styles.footerMeta}>
                    Applied {new Date(app.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>

                  <div className={styles.actionButtons}>
                    {/* Active Chat Stage */}
                    {isActive && isChatStage && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/applications/${app._id}/stage`)}
                        data-testid="continue-interview-btn"
                      >
                        <SparklesIcon size={14} />
                        Enter {stageFormattedLabel(app.currentStage)}
                      </Button>
                    )}

                    {/* Active Offer Stage */}
                    {isActive && isOfferStage && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/applications/${app._id}/offer`)}
                        data-testid="review-offer-btn"
                      >
                        <SparklesIcon size={14} />
                        Review Offer & Negotiate
                      </Button>
                    )}

                    {/* Active In-Progress Banner (ATS or Final Review) */}
                    {isActive && !isChatStage && !isOfferStage && (
                      <Badge variant="warning" size="sm">
                        AI Processing Stage
                      </Badge>
                    )}

                    {/* Rejection Feedback CTA */}
                    {isRejected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleOpenFeedback(app)}
                        disabled={feedbackLoadingAppId === app._id}
                        data-testid="view-feedback-btn"
                      >
                        {feedbackLoadingAppId === app._id ? (
                          <Spinner size="sm" />
                        ) : (
                          'View Rejection Feedback'
                        )}
                      </Button>
                    )}

                    {/* Accepted Celebration CTA */}
                    {isAccepted && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/workplace')}
                        data-testid="go-workplace-btn"
                      >
                        Go to Workplace
                      </Button>
                    )}

                    {/* Active Application Withdrawal Action */}
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenWithdraw(app._id)}
                        data-testid="withdraw-btn"
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        feedback={selectedFeedback}
        companyName={feedbackAppMeta.company}
        jobTitle={feedbackAppMeta.job}
      />

      {/* Withdraw Confirmation Modal */}
      {withdrawModalOpen && (
        <div
          className={styles.withdrawModalOverlay}
          role="dialog"
          aria-modal="true"
          data-testid="withdraw-modal"
        >
          <div className={styles.withdrawModal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
                Withdraw Application
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-text-muted)' }}
                onClick={() => setWithdrawModalOpen(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
              Are you sure you want to withdraw this active application? This action cannot be undone,
              and will free up one of your 5 active application slots.
            </p>
            <div>
              <label
                style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--cv-text-secondary)' }}
              >
                Reason (optional)
              </label>
              <textarea
                className={styles.withdrawTextarea}
                placeholder="Brief reason for withdrawing..."
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
              />
            </div>
            <div className={styles.withdrawActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWithdrawModalOpen(false)}
                disabled={withdrawing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleConfirmWithdraw()}
                disabled={withdrawing}
                data-testid="confirm-withdraw-btn"
              >
                {withdrawing ? <Spinner size="sm" color="white" /> : 'Confirm Withdrawal'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function stageFormattedLabel(stage: ApplicationStage): string {
  switch (stage) {
    case 'SCREENING':
      return 'Screening Interview';
    case 'ASSESSMENT':
      return 'Technical Assessment';
    case 'INTERVIEW':
      return 'System Interview';
    default:
      return stage.replace(/_/g, ' ');
  }
}

export default ApplicationsTrackerPage;
