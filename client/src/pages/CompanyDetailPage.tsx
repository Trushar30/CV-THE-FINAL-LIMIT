import { useState, useEffect, type ReactElement } from 'react';
import { useParams, Link } from 'react-router-dom';
import { careerApi, type CompanyWithJobsResponse, type CareerDomain } from '../api/career';
import { Badge } from '../components/ui/Badge/Badge';
import { Button } from '../components/ui/Button/Button';
import { Spinner } from '../components/ui/Spinner/Spinner';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import { StarIcon, UsersIcon, BriefcaseIcon, ChevronRightIcon } from '../components/ui/Icon';
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

export function CompanyDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CompanyWithJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanyDetails() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const result = await careerApi.getCompany(id);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve company details');
      } finally {
        setLoading(false);
      }
    }

    fetchCompanyDetails();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerContainer} data-testid="company-detail-loading">
          <Spinner size="lg" />
          <p>Loading enterprise profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <Link to="/companies" className={styles.backNav}>
          ← Back to Enterprise Directory
        </Link>
        <div className={styles.centerContainer} role="alert">
          <p style={{ color: 'var(--cv-feedback-error)' }}>{error || 'Enterprise not found'}</p>
          <Link to="/companies">
            <Button variant="secondary" size="sm">
              Return to Directory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { company, openJobs } = data;

  return (
    <div className={styles.container}>
      {/* Back Navigation */}
      <Link to="/companies" className={styles.backNav}>
        ← Back to Enterprise Directory
      </Link>

      {/* Detail Banner */}
      <div className={styles.detailBanner}>
        <div className={styles.bannerTop}>
          <div>
            <h1 className={styles.bannerTitle}>{company.name}</h1>
            <p className={styles.bannerSubhead}>
              {company.description || 'Verified enterprise employer on CorpVerse platform.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Badge variant={company.type === 'PLATFORM' ? 'info' : 'warning'} size="md">
              {company.type === 'PLATFORM' ? 'Platform Enterprise' : 'Founder Startup'}
            </Badge>
            <Badge variant="success" size="md">
              {company.status}
            </Badge>
          </div>
        </div>

        {/* Domain Chips */}
        <div className={styles.domainTags}>
          {company.domainsHired?.map((d) => (
            <span
              key={d}
              className={styles.domainTag}
              style={{ fontSize: '13px', padding: '4px 10px' }}
            >
              {formatDomainLabel(d)}
            </span>
          ))}
        </div>

        {/* Ratings Breakdown Grid */}
        <div className={styles.ratingBreakdownGrid}>
          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Overall Rating</span>
            <div className={styles.ratingScore}>
              <StarIcon size={18} color="var(--cv-gold-500)" />
              <span>{(company.companyRating || company.ratings?.overall || 5.0).toFixed(1)}</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
              Based on {company.ratings?.reviewCount || 0} evaluations
            </span>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Engineering Culture</span>
            <div className={styles.ratingScore}>
              <span>{(company.ratings?.culture || 5.0).toFixed(1)}</span>
              <span style={{ fontSize: '13px', color: 'var(--cv-text-muted)' }}>/ 5.0</span>
            </div>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Work-Life Balance</span>
            <div className={styles.ratingScore}>
              <span>{(company.ratings?.workLife || 5.0).toFixed(1)}</span>
              <span style={{ fontSize: '13px', color: 'var(--cv-text-muted)' }}>/ 5.0</span>
            </div>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Technical Excellence</span>
            <div className={styles.ratingScore}>
              <span>{(company.ratings?.technicalExcellence || 5.0).toFixed(1)}</span>
              <span style={{ fontSize: '13px', color: 'var(--cv-text-muted)' }}>/ 5.0</span>
            </div>
          </div>

          <div className={styles.ratingCard}>
            <span className={styles.ratingLabel}>Team Roster</span>
            <div className={styles.ratingScore}>
              <UsersIcon size={18} />
              <span>
                {company.employeeCount || 0} / {company.maxEmployees || 20}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
              Active employees
            </span>
          </div>
        </div>
      </div>

      {/* Open Requisitions Section */}
      <div className={styles.sectionBlock}>
        <div className={styles.titleRow}>
          <div>
            <h2 className={styles.sectionTitle}>Active Job Requisitions ({openJobs.length})</h2>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--cv-text-sm)',
                color: 'var(--cv-text-secondary)',
              }}
            >
              Open simulation engineering positions currently seeking candidates.
            </p>
          </div>
          <Link to="/jobs">
            <Button variant="ghost" size="sm">
              View All Platform Jobs
            </Button>
          </Link>
        </div>

        {openJobs.length === 0 ? (
          <EmptyState
            title="No active requisitions"
            description="This organization does not currently have any open job positions listed."
          />
        ) : (
          <div className={styles.cardsGrid} style={{ marginTop: 'var(--cv-space-2)' }}>
            {openJobs.map((job) => (
              <Link
                key={job._id}
                to={`/jobs/${job._id}`}
                className={styles.cardItem}
                data-testid={`company-job-card-${job._id}`}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.companyTitle}>{job.title}</h3>
                  <Badge variant="info" size="sm">
                    L{job.minLevel} - L{job.maxLevel}
                  </Badge>
                </div>

                <p className={styles.cardDescription}>{job.description}</p>

                <div className={styles.domainTags}>
                  <span className={styles.domainTag}>{formatDomainLabel(job.domain)}</span>
                  {job.requiredSkills?.slice(0, 3).map((skill) => (
                    <span key={skill} className={styles.domainTag} style={{ opacity: 0.8 }}>
                      {skill}
                    </span>
                  ))}
                  {job.requiredSkills && job.requiredSkills.length > 3 && (
                    <span className={styles.domainTag} style={{ opacity: 0.6 }}>
                      +{job.requiredSkills.length - 3} more
                    </span>
                  )}
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <BriefcaseIcon size={14} />
                    <span>
                      <strong className={styles.statHighlight}>{job.openings}</strong> opening
                      {job.openings === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className={styles.statItem} style={{ color: 'var(--cv-brand-primary-500)' }}>
                    <span>View Details</span>
                    <ChevronRightIcon size={14} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
