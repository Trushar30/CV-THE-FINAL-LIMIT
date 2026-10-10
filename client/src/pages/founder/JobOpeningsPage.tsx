import { useState, useEffect, useCallback, type ReactElement, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { Table, type Column } from '../../components/ui/Table/Table';
import styles from './Founder.module.css';

interface JobPosting {
  _id: string;
  title: string;
  domain: string;
  seniorityLevel: number;
  isOpen: boolean;
  status: 'ACTIVE' | 'CLOSED';
  description?: string;
  requiredSkills: string[];
  applicantCount?: number;
  createdAt: string;
}

interface CompanyData {
  _id: string;
  name: string;
  domain: string;
  isOpenForHiring: boolean;
  employeeCount: number;
  maxEmployees: number;
}

export function JobOpeningsPage(): ReactElement {
  const { success, error, warning, info } = useToast();

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING'>('SOFTWARE_ENGINEERING');
  const [seniorityLevel, setSeniorityLevel] = useState<number>(3);
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('TypeScript, Node.js');

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const [jobsRes, companyRes] = await Promise.all([
        apiClient.get<{ jobs: JobPosting[] }>('/founder/jobs'),
        apiClient.get<CompanyData>('/founder/company'),
      ]);
      setJobs(jobsRes.jobs || []);
      setCompany(companyRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load job openings';
      error(msg);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateJob = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) {
      warning('Position title is required');
      return;
    }

    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (skills.length === 0) {
      warning('At least one required skill must be specified');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/founder/jobs', {
        title: title.trim(),
        domain,
        seniorityLevel: Number(seniorityLevel),
        description: description.trim() || undefined,
        requiredSkills: skills,
      });

      success(`Job requisition "${title.trim()}" published successfully!`);
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create job opening';
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseJob = async (jobId: string): Promise<void> => {
    try {
      await apiClient.patch(`/founder/jobs/${jobId}/close`);
      info('Job opening closed successfully');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to close job opening';
      error(msg);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Loading Job Requisitions...</p>
      </div>
    );
  }

  const columns: Column<JobPosting>[] = [
    {
      key: 'title',
      header: 'Requisition Title',
      render: (job) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, color: 'var(--cv-text-primary)' }}>{job.title}</span>
          <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>
            Domain: {job.domain.replace('_', ' ')}
          </span>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Target Level',
      render: (job) => <Badge variant="default">Level {job.seniorityLevel}</Badge>,
    },
    {
      key: 'skills',
      header: 'Required Skills',
      render: (job) => (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {job.requiredSkills.map((s, idx) => (
            <span key={idx} className={styles.modifierTag}>
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (job) => (
        <Badge variant={job.isOpen ? 'success' : 'default'}>
          {job.isOpen ? 'OPEN' : 'CLOSED'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (job) =>
        job.isOpen ? (
          <Button variant="secondary" size="sm" onClick={() => handleCloseJob(job._id)}>
            Close Requisition
          </Button>
        ) : (
          <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>Archived</span>
        ),
    },
  ];

  return (
    <div className={styles.container} data-testid="job-openings-page">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>📋</span> Corporate Job Requisitions
          </h1>
          <Button
            variant="gold"
            size="md"
            onClick={() => setShowCreateModal(true)}
            disabled={!company?.isOpenForHiring}
            data-testid="create-job-button"
          >
            + Create New Requisition
          </Button>
        </div>
        <p className={styles.subtitle}>
          Publish engineering requisitions for candidate intake. Basic Hiring Bot and Evaluation Bot screen, assess, and evaluate applicants.
        </p>

        {/* Navigation Tabs */}
        <div className={styles.navTabs}>
          <Link to="/founder" className={styles.navTab}>Command Overview</Link>
          <Link to="/founder/simulation" className={styles.navTab}>Daily Dilemma & Tick</Link>
          <Link to="/founder/bots" className={styles.navTab}>Bot Fleet</Link>
          <Link to="/founder/jobs" className={`${styles.navTab} ${styles.navTabActive}`}>Job Openings</Link>
          <Link to="/founder/applicants" className={styles.navTab}>Applicant Pipeline</Link>
          <Link to="/founder/ledger" className={styles.navTab}>CorpCoin Ledger</Link>
        </div>
      </div>

      {!company?.isOpenForHiring && (
        <div className={styles.goldBanner}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--cv-gold-400)' }}>
              Workforce Setup Required Before Hiring
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
              Acquire all 3 basic bots in the Bot Fleet marketplace to activate candidate intake.
            </p>
          </div>
          <Link to="/founder/bots">
            <Button variant="secondary" size="sm">Go to Bot Shop</Button>
          </Link>
        </div>
      )}

      {/* Jobs Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>💼</span> Active & Historical Openings ({jobs.length})
          </h2>
          <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>
            Company Capacity: {company?.employeeCount ?? 0} / {company?.maxEmployees ?? 20}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className={styles.emptyState}>
            <span>📋</span>
            <h3 className={styles.emptyStateTitle}>No Requisitions Created</h3>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-sm)' }}>
              Publish a job opening to attract candidate talent.
            </p>
          </div>
        ) : (
          <Table<JobPosting>
            data={jobs}
            columns={columns}
            keyExtractor={(job) => job._id}
            emptyText="No job openings found"
          />
        )}
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} data-testid="create-job-modal">
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Publish Job Requisition</h3>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="job-title">Position Title *</label>
                <input
                  id="job-title"
                  className={styles.formInput}
                  type="text"
                  placeholder="e.g. Senior Distributed Systems Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cv-space-3)' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="job-domain">Engineering Domain</label>
                  <select
                    id="job-domain"
                    className={styles.formSelect}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING')}
                  >
                    <option value="SOFTWARE_ENGINEERING">Software Engineering</option>
                    <option value="CLOUD_ENGINEERING">Cloud Engineering</option>
                    <option value="AI_ENGINEERING">AI Engineering</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="job-level">Target Seniority (Level)</label>
                  <select
                    id="job-level"
                    className={styles.formSelect}
                    value={seniorityLevel}
                    onChange={(e) => setSeniorityLevel(Number(e.target.value))}
                  >
                    <option value={1}>Level 1 (Intern)</option>
                    <option value={2}>Level 2 (Junior)</option>
                    <option value={3}>Level 3 (Junior+)</option>
                    <option value={4}>Level 4 (Associate)</option>
                    <option value={5}>Level 5 (Mid-Level)</option>
                    <option value={6}>Level 6 (Mid+)</option>
                    <option value={7}>Level 7 (Senior)</option>
                    <option value={8}>Level 8 (Senior+)</option>
                    <option value={9}>Level 9 (Lead)</option>
                    <option value={10}>Level 10 (Principal)</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="job-skills">Required Skills (Comma separated) *</label>
                <input
                  id="job-skills"
                  className={styles.formInput}
                  type="text"
                  placeholder="TypeScript, Docker, MongoDB"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="job-desc">Position Description (Optional)</label>
                <textarea
                  id="job-desc"
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Outline the core responsibilities and technical expectations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={submitting}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="gold"
                  size="md"
                  type="submit"
                  loading={submitting}
                >
                  Publish Requisition
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
