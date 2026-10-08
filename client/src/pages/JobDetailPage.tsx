import { useState, useEffect, type ReactElement } from 'react';
import { useParams, Link } from 'react-router-dom';
import { careerApi, type JobDetails, type CareerDomain } from '../api/career';
import { Badge } from '../components/ui/Badge/Badge';
import { Button } from '../components/ui/Button/Button';
import { Spinner } from '../components/ui/Spinner/Spinner';
import {
  BriefcaseIcon,
  StarIcon,
  BuildingIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '../components/ui/Icon';
import styles from './Career.module.css';

function formatDomainLabel(domain: CareerDomain): string {
  switch (domain) {
    case 'SOFTWARE_ENGINEERING':
      return 'Software Engineering';
    case 'CLOUD_ENGINEERING':
      return 'Cloud Engineering';
    case 'AI_ENGINEERING':
      return 'AI & Machine Learning';
    default:
      return domain;
  }
}

function getLevelTitle(level: number): string {
  const titles = [
    '',
    'Intern (L1)',
    'Junior (L2)',
    'Junior+ (L3)',
    'Associate (L4)',
    'Mid (L5)',
    'Mid+ (L6)',
    'Senior (L7)',
    'Senior+ (L8)',
    'Lead (L9)',
    'Principal (L10)',
  ];
  return titles[level] || `Level ${level}`;
}

export function JobDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active applications count (0/5 default for candidate until P6.1 application engine integration)
  const activeApplicationsCount = 0;
  const maxApplicationsQuota = 5;

  useEffect(() => {
    async function fetchJobDetails() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await careerApi.getJob(id);
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve job details');
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetails();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerContainer} data-testid="job-detail-loading">
          <Spinner size="lg" />
          <p>Loading position details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className={styles.container}>
        <Link to="/jobs" className={styles.backNav}>
          ← Back to Career Requisitions
        </Link>
        <div className={styles.centerContainer} role="alert">
          <p style={{ color: 'var(--cv-feedback-error)' }}>{error || 'Position not found'}</p>
          <Link to="/jobs">
            <Button variant="secondary" size="sm">
              Return to Job Board
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { companyId: company } = job;

  return (
    <div className={styles.container}>
      {/* Back Navigation */}
      <Link to="/jobs" className={styles.backNav}>
        ← Back to Career Requisitions
      </Link>

      {/* Position Header Banner */}
      <div className={styles.detailBanner}>
        <div className={styles.bannerTop}>
          <div>
            <h1 className={styles.bannerTitle}>{job.title}</h1>
            <p className={styles.bannerSubhead}>
              Posted by{' '}
              <Link
                to={`/companies/${company._id}`}
                style={{
                  color: 'var(--cv-brand-primary-500)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {company.name}
              </Link>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant="info" size="md">
              {formatDomainLabel(job.domain)}
            </Badge>
            <Badge variant="default" size="md">
              L{job.minLevel} - L{job.maxLevel}
            </Badge>
            <Badge variant="success" size="md">
              {job.openings} Opening{job.openings === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>

        {/* Overview Stats */}
        <div className={styles.ratingBreakdownGrid}>
          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Track Domain</span>
            <div className={styles.ratingScore} style={{ fontSize: '15px' }}>
              <BriefcaseIcon size={16} />
              <span>{formatDomainLabel(job.domain)}</span>
            </div>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Seniority Target</span>
            <div className={styles.ratingScore} style={{ fontSize: '15px' }}>
              <span>
                {getLevelTitle(job.minLevel)} to {getLevelTitle(job.maxLevel)}
              </span>
            </div>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Employer Rating</span>
            <div className={styles.ratingScore}>
              <StarIcon size={16} color="var(--cv-gold-500)" />
              <span>{(company.companyRating || 5.0).toFixed(1)}</span>
            </div>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Position Status</span>
            <div
              className={styles.ratingScore}
              style={{ fontSize: '15px', color: 'var(--cv-feedback-success)' }}
            >
              <ShieldCheckIcon size={16} />
              <span>Actively Hiring</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main & Sidebar Layout */}
      <div className={styles.jobDetailLayout}>
        {/* Left Column: Description & Requirements */}
        <div className={styles.mainSection}>
          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Role Description & Responsibilities</h2>
            <p style={{ lineHeight: 1.6, color: 'var(--cv-text-secondary)', margin: 0 }}>
              {job.description}
            </p>
          </div>

          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Required Technical Competencies</h2>
            <p style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)', margin: 0 }}>
              Candidates will be evaluated against these core capabilities during automated ATS
              screening and technical simulation interviews.
            </p>
            <div className={styles.skillsContainer}>
              {job.requiredSkills?.map((skill) => (
                <span key={skill} className={styles.skillChip}>
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Career Progression & Rewards</h2>
            <p style={{ lineHeight: 1.6, color: 'var(--cv-text-secondary)', margin: 0 }}>
              Engineers at <strong>{company.name}</strong> receive daily primary and bonus
              simulation tasks yielding up to 100 EXP per task based on evaluated quality. Sustained
              top-tier performance leads to promotion reviews and leadership opportunities.
            </p>
          </div>
        </div>

        {/* Right Column: Apply CTA & Company Profile Card */}
        <div className={styles.sideSection}>
          {/* Apply Card */}
          <div className={styles.applyCtaCard} data-testid="apply-cta-card">
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 'var(--cv-text-lg)', fontWeight: 600 }}>
                Candidate Application
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--cv-text-xs)',
                  color: 'var(--cv-text-secondary)',
                }}
              >
                Authoritative hiring pipeline with AI-driven ATS screening.
              </p>
            </div>

            {/* Application Quota Widget */}
            <div className={styles.quotaCounter} data-testid="application-quota-counter">
              <span className={styles.quotaLabel}>Active Application Quota:</span>
              <span className={styles.quotaValue} data-testid="quota-count">
                {activeApplicationsCount} / {maxApplicationsQuota}
              </span>
            </div>

            {/* Apply Button (Disabled until P6.1) */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={true}
              data-testid="apply-button"
            >
              <SparklesIcon size={18} />
              Apply for Position
            </Button>

            <div className={styles.applyDisabledNotice} data-testid="apply-notice">
              <p
                style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--cv-text-secondary)' }}
              >
                Application submission unlocks in Phase 6.1
              </p>
              <p style={{ margin: 0 }}>
                Candidates may maintain up to 5 concurrent active applications across the platform.
              </p>
            </div>
          </div>

          {/* Company Summary Card */}
          <div className={styles.sectionBlock}>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-base)', fontWeight: 600 }}>
              About the Organization
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--cv-text-sm)',
                color: 'var(--cv-text-secondary)',
              }}
            >
              {company.description || 'Verified enterprise employer.'}
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid var(--cv-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--cv-text-muted)' }}>Organization Type</span>
                <span style={{ fontWeight: 500 }}>
                  {company.type === 'PLATFORM' ? 'Platform Enterprise' : 'Founder Startup'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--cv-text-muted)' }}>Company Rating</span>
                <span
                  style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <StarIcon size={14} color="var(--cv-gold-500)" />
                  {(company.companyRating || 5.0).toFixed(1)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--cv-text-muted)' }}>Employee Roster</span>
                <span style={{ fontWeight: 500 }}>
                  {company.employeeCount || 0} / {company.maxEmployees || 20}
                </span>
              </div>
            </div>

            <Link
              to={`/companies/${company._id}`}
              style={{ textDecoration: 'none', marginTop: '4px' }}
            >
              <Button variant="secondary" size="sm" fullWidth>
                <BuildingIcon size={14} />
                View Full Company Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
