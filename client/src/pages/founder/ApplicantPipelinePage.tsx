import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { Table, type Column } from '../../components/ui/Table/Table';
import styles from './Founder.module.css';

interface ApplicantSummary {
  _id: string;
  candidateId: {
    _id: string;
    email: string;
    displayName?: string;
  } | string;
  jobId: {
    _id: string;
    title: string;
    seniorityLevel: number;
  } | string;
  currentStage: string;
  status: string;
  createdAt: string;
}

interface ApplicationDetail {
  application: {
    _id: string;
    currentStage: string;
    status: string;
  };
  evaluations: Array<{
    _id: string;
    stage: string;
    score: number;
    decision: string;
    notes?: string;
  }>;
  feedbacks: Array<{
    _id: string;
    content: string;
    strengths: string[];
    improvements: string[];
  }>;
}

export function ApplicantPipelinePage(): ReactElement {
  const { error } = useToast();

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ApplicantSummary[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadApplications = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ applications: ApplicantSummary[] }>('/founder/applications');
      setApplications(res.applications || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch candidate pipeline';
      error(msg);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleOpenDetail = async (appId: string): Promise<void> => {
    try {
      setSelectedAppId(appId);
      setDetailLoading(true);
      const res = await apiClient.get<ApplicationDetail>(`/founder/applications/${appId}`);
      setDetailData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load application evaluation history';
      error(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Loading Candidate Pipeline...</p>
      </div>
    );
  }

  const columns: Column<ApplicantSummary>[] = [
    {
      key: 'candidate',
      header: 'Applicant',
      render: (app) => {
        const email = typeof app.candidateId === 'object' && app.candidateId !== null ? app.candidateId.email : 'Candidate';
        const name = typeof app.candidateId === 'object' && app.candidateId !== null ? app.candidateId.displayName || email : email;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--cv-text-primary)' }}>{name}</span>
            <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>{email}</span>
          </div>
        );
      },
    },
    {
      key: 'job',
      header: 'Applied Position',
      render: (app) => {
        const title = typeof app.jobId === 'object' && app.jobId !== null ? app.jobId.title : 'Engineering Role';
        return <span style={{ fontWeight: 600, color: 'var(--cv-text-secondary)' }}>{title}</span>;
      },
    },
    {
      key: 'stage',
      header: 'Current Stage',
      render: (app) => <Badge variant="cyan">{app.currentStage.replace('_', ' ')}</Badge>,
    },
    {
      key: 'status',
      header: 'Outcome Status',
      render: (app) => {
        const variant = app.status === 'ACCEPTED' ? 'success' : app.status === 'REJECTED' ? 'danger' : 'gold';
        return <Badge variant={variant}>{app.status}</Badge>;
      },
    },
    {
      key: 'date',
      header: 'Applied Date',
      render: (app) => (
        <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
          {new Date(app.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Review',
      render: (app) => (
        <Button variant="secondary" size="sm" onClick={() => handleOpenDetail(app._id)}>
          View Evaluation
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.container} data-testid="applicant-pipeline-page">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>👥</span> Candidate Intake & Evaluation Pipeline
          </h1>
          <Badge variant="cyan">{applications.length} Candidates Tracked</Badge>
        </div>
        <p className={styles.subtitle}>
          Track applicants through ATS screening, technical assessments, and AI interview rounds. Evaluations are generated by company bots via the AI Gateway.
        </p>

        {/* Navigation Tabs */}
        <div className={styles.navTabs}>
          <Link to="/founder" className={styles.navTab}>Command Overview</Link>
          <Link to="/founder/simulation" className={styles.navTab}>Daily Dilemma & Tick</Link>
          <Link to="/founder/bots" className={styles.navTab}>Bot Fleet</Link>
          <Link to="/founder/jobs" className={styles.navTab}>Job Openings</Link>
          <Link to="/founder/applicants" className={`${styles.navTab} ${styles.navTabActive}`}>Applicant Pipeline</Link>
          <Link to="/founder/ledger" className={styles.navTab}>CorpCoin Ledger</Link>
        </div>
      </div>

      {/* Applications Table Card */}
      <div className={styles.sectionCard}>
        {applications.length === 0 ? (
          <div className={styles.emptyState}>
            <span>📋</span>
            <h3 className={styles.emptyStateTitle}>No Applicants in Pipeline</h3>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-sm)' }}>
              Open a job opening or ensure all 3 bots are acquired so job seekers can discover your listings.
            </p>
          </div>
        ) : (
          <Table<ApplicantSummary>
            data={applications}
            columns={columns}
            keyExtractor={(app) => app._id}
            emptyText="No applicants found"
          />
        )}
      </div>

      {/* Evaluation Outcomes Modal */}
      {selectedAppId && (
        <div className={styles.modalOverlay} data-testid="application-detail-modal">
          <div className={styles.modalContent} style={{ maxWidth: 640 }}>
            <h3 className={styles.modalTitle}>Candidate Evaluation Summary</h3>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <Spinner size="md" />
                <p style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)', marginTop: '0.5rem' }}>
                  Loading bot evaluation sheets...
                </p>
              </div>
            ) : detailData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 420, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--cv-bg-canvas)', borderRadius: 'var(--cv-radius-md)' }}>
                  <span>Stage: <strong>{detailData.application.currentStage}</strong></span>
                  <Badge variant={detailData.application.status === 'ACCEPTED' ? 'success' : 'default'}>
                    {detailData.application.status}
                  </Badge>
                </div>

                {/* Stage Evaluations */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
                    Bot Assessments ({Array.isArray(detailData.evaluations) ? detailData.evaluations.length : 0})
                  </h4>
                  {!Array.isArray(detailData.evaluations) || detailData.evaluations.length === 0 ? (
                    <p style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>No round evaluations recorded yet.</p>
                  ) : (
                    detailData.evaluations.map((ev) => (
                      <div key={ev._id} style={{ padding: '0.75rem', border: '1px solid var(--cv-border-subtle)', borderRadius: 'var(--cv-radius-md)', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{ev.stage}</span>
                          <Badge variant="cyan">Score: {ev.score}/100</Badge>
                        </div>
                        {ev.notes && <p style={{ margin: '0.4rem 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>{ev.notes}</p>}
                      </div>
                    ))
                  )}
                </div>

                {/* Candidate Feedbacks */}
                {Array.isArray(detailData.feedbacks) && detailData.feedbacks.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
                      Actionable Feedback
                    </h4>
                    {detailData.feedbacks.map((fb) => (
                      <div key={fb._id} style={{ padding: '0.75rem', background: 'rgba(56, 176, 185, 0.05)', border: '1px solid rgba(56, 176, 185, 0.2)', borderRadius: 'var(--cv-radius-md)' }}>
                        <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-primary)' }}>{fb.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <Button variant="secondary" size="md" onClick={() => setSelectedAppId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
