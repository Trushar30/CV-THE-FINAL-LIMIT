import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { careerApi, type JobListItem, type CareerDomain } from '../api/career';
import { Badge } from '../components/ui/Badge/Badge';
import { Button } from '../components/ui/Button/Button';
import { Spinner } from '../components/ui/Spinner/Spinner';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import {
  BriefcaseIcon,
  SearchIcon,
  StarIcon,
  BuildingIcon,
  ChevronRightIcon,
} from '../components/ui/Icon';
import styles from './Career.module.css';

const DOMAIN_OPTIONS: Array<{ label: string; value: CareerDomain | 'ALL' }> = [
  { label: 'All Tracks', value: 'ALL' },
  { label: 'Software Engineering', value: 'SOFTWARE_ENGINEERING' },
  { label: 'Cloud Engineering', value: 'CLOUD_ENGINEERING' },
  { label: 'AI Engineering', value: 'AI_ENGINEERING' },
];

const LEVEL_PRESETS: Array<{ label: string; minLevel?: number; maxLevel?: number }> = [
  { label: 'All Seniorities' },
  { label: 'Junior (L1 - L3)', minLevel: 1, maxLevel: 3 },
  { label: 'Mid-Level (L4 - L6)', minLevel: 4, maxLevel: 6 },
  { label: 'Senior & Lead (L7 - L10)', minLevel: 7, maxLevel: 10 },
];

function formatDomainLabel(domain: CareerDomain): string {
  switch (domain) {
    case 'SOFTWARE_ENGINEERING':
      return 'Software';
    case 'CLOUD_ENGINEERING':
      return 'Cloud';
    case 'AI_ENGINEERING':
      return 'AI & ML';
    default:
      return domain;
  }
}

function getLevelTitle(level: number): string {
  const titles = [
    '',
    'Intern',
    'Junior',
    'Junior+',
    'Associate',
    'Mid',
    'Mid+',
    'Senior',
    'Senior+',
    'Lead',
    'Principal',
  ];
  return titles[level] || `L${level}`;
}

export function JobsPage(): ReactElement {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<CareerDomain | 'ALL'>('ALL');
  const [levelPresetIndex, setLevelPresetIndex] = useState(0);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const preset = LEVEL_PRESETS[levelPresetIndex];
      const params: {
        domain?: CareerDomain;
        search?: string;
        minLevel?: number;
        maxLevel?: number;
      } = {};

      if (selectedDomain !== 'ALL') {
        params.domain = selectedDomain;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (preset && preset.minLevel !== undefined) {
        params.minLevel = preset.minLevel;
      }
      if (preset && preset.maxLevel !== undefined) {
        params.maxLevel = preset.maxLevel;
      }

      const data = await careerApi.getJobs(params);
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve open job requisitions');
    } finally {
      setLoading(false);
    }
  }, [selectedDomain, levelPresetIndex, searchTerm]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDomain('ALL');
    setLevelPresetIndex(0);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Career Requisitions</h1>
            <p className={styles.subtitle}>
              Browse and discover open positions across enterprise employers. Prepare for AI-driven
              ATS evaluations and technical chat interviews.
            </p>
          </div>
          <Link to="/companies">
            <Button variant="secondary" size="md">
              <BuildingIcon size={16} />
              View Enterprises
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterControls}>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>
              <SearchIcon size={16} />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search positions by title, description, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search job requisitions"
            />
          </div>

          <select
            className={styles.selectInput}
            value={levelPresetIndex}
            onChange={(e) => setLevelPresetIndex(Number(e.target.value))}
            aria-label="Filter by seniority level"
          >
            {LEVEL_PRESETS.map((preset, idx) => (
              <option key={preset.label} value={idx}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Domain Filter Chips */}
        <div className={styles.chipGroup} role="group" aria-label="Filter by engineering domain">
          {DOMAIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.chip} ${selectedDomain === opt.value ? styles.chipActive : ''}`}
              onClick={() => setSelectedDomain(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Meta */}
      {!loading && !error && (
        <div className={styles.resultsMeta}>
          <span>
            Showing <strong>{jobs.length}</strong> open position
            {jobs.length === 1 ? '' : 's'}
          </span>
          {(searchTerm || selectedDomain !== 'ALL' || levelPresetIndex !== 0) && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset filters
            </Button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.centerContainer} data-testid="jobs-loading-state">
          <Spinner size="lg" />
          <p>Searching open requisitions...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className={styles.centerContainer} role="alert">
          <p style={{ color: 'var(--cv-feedback-error)' }}>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => fetchJobs()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && jobs.length === 0 && (
        <EmptyState
          title="No open positions found"
          description="We couldn't find any job requisitions matching your filter parameters. Try expanding your level range or clearing keywords."
          action={
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          }
        />
      )}

      {/* Jobs Grid */}
      {!loading && !error && jobs.length > 0 && (
        <div className={styles.cardsGrid} data-testid="jobs-grid">
          {jobs.map((job) => (
            <Link
              key={job._id}
              to={`/jobs/${job._id}`}
              className={styles.cardItem}
              data-testid={`job-card-${job._id}`}
            >
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.companyTitle}>{job.title}</h3>
                  <span
                    style={{ fontSize: '13px', color: 'var(--cv-text-secondary)', fontWeight: 500 }}
                  >
                    {job.companyId?.name || 'Enterprise'}
                  </span>
                </div>
                <Badge variant="info" size="sm">
                  L{job.minLevel} - L{job.maxLevel} ({getLevelTitle(job.maxLevel)})
                </Badge>
              </div>

              <p className={styles.cardDescription}>{job.description}</p>

              {/* Domain & Skills Tags */}
              <div className={styles.domainTags}>
                <span className={styles.domainTag} style={{ fontWeight: 600 }}>
                  {formatDomainLabel(job.domain)}
                </span>
                {job.requiredSkills?.slice(0, 3).map((skill) => (
                  <span key={skill} className={styles.domainTag}>
                    {skill}
                  </span>
                ))}
                {job.requiredSkills && job.requiredSkills.length > 3 && (
                  <span className={styles.domainTag} style={{ opacity: 0.7 }}>
                    +{job.requiredSkills.length - 3} more
                  </span>
                )}
              </div>

              {/* Stats Row */}
              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <BriefcaseIcon size={14} />
                  <span>
                    <strong className={styles.statHighlight}>{job.openings}</strong> opening
                    {job.openings === 1 ? '' : 's'}
                  </span>
                </div>

                {job.companyId?.companyRating && (
                  <div className={styles.statItem}>
                    <StarIcon size={14} color="var(--cv-gold-500)" />
                    <span>{job.companyId.companyRating.toFixed(1)}</span>
                  </div>
                )}

                <div className={styles.statItem} style={{ color: 'var(--cv-brand-primary-500)' }}>
                  <span>View Position</span>
                  <ChevronRightIcon size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
