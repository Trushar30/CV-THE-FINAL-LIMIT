import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  careerApi,
  type CompanyListItem,
  type CareerDomain,
  type CompanyType,
} from '../api/career';
import { Badge } from '../components/ui/Badge/Badge';
import { Button } from '../components/ui/Button/Button';
import { Spinner } from '../components/ui/Spinner/Spinner';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import {
  SearchIcon,
  StarIcon,
  UsersIcon,
  BriefcaseIcon,
  ChevronRightIcon,
} from '../components/ui/Icon';
import styles from './Career.module.css';

const DOMAIN_OPTIONS: Array<{ label: string; value: CareerDomain | 'ALL' }> = [
  { label: 'All Domains', value: 'ALL' },
  { label: 'Software Engineering', value: 'SOFTWARE_ENGINEERING' },
  { label: 'Cloud Engineering', value: 'CLOUD_ENGINEERING' },
  { label: 'AI Engineering', value: 'AI_ENGINEERING' },
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

export function CompaniesPage(): ReactElement {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<CareerDomain | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<CompanyType | 'ALL'>('ALL');

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: {
        domain?: CareerDomain;
        type?: CompanyType;
        search?: string;
      } = {};

      if (selectedDomain !== 'ALL') {
        params.domain = selectedDomain;
      }
      if (selectedType !== 'ALL') {
        params.type = selectedType;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const data = await careerApi.getCompanies(params);
      setCompanies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enterprise directories');
    } finally {
      setLoading(false);
    }
  }, [selectedDomain, selectedType, searchTerm]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDomain('ALL');
    setSelectedType('ALL');
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Enterprise Organizations</h1>
            <p className={styles.subtitle}>
              Explore verified AI and tech corporations offering simulation engineering positions,
              competitive career tracks, and immersive tasks.
            </p>
          </div>
          <Link to="/jobs">
            <Button variant="secondary" size="md">
              <BriefcaseIcon size={16} />
              Browse Open Positions
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterControls}>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>
              <SearchIcon size={16} />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search companies by name or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search companies"
            />
          </div>

          <select
            className={styles.selectInput}
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as CompanyType | 'ALL')}
            aria-label="Filter by organization type"
          >
            <option value="ALL">All Types</option>
            <option value="PLATFORM">Platform Enterprise</option>
            <option value="FOUNDER">Founder Startup</option>
          </select>
        </div>

        {/* Domain Filter Chips */}
        <div className={styles.chipGroup} role="group" aria-label="Filter by career domain">
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
            Showing <strong>{companies.length}</strong> organization
            {companies.length === 1 ? '' : 's'}
          </span>
          {(searchTerm || selectedDomain !== 'ALL' || selectedType !== 'ALL') && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset filters
            </Button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.centerContainer} data-testid="loading-state">
          <Spinner size="lg" />
          <p>Loading enterprise directory...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className={styles.centerContainer} role="alert">
          <p style={{ color: 'var(--cv-feedback-error)' }}>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => fetchCompanies()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && companies.length === 0 && (
        <EmptyState
          title="No companies found"
          description="No enterprise organizations match your current search criteria. Try modifying your search keywords or clearing domain filters."
          action={
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          }
        />
      )}

      {/* Companies Grid */}
      {!loading && !error && companies.length > 0 && (
        <div className={styles.cardsGrid} data-testid="companies-grid">
          {companies.map((company) => (
            <Link
              key={company._id}
              to={`/companies/${company._id}`}
              className={styles.cardItem}
              data-testid={`company-card-${company._id}`}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.companyTitle}>{company.name}</h3>
                <Badge variant={company.type === 'PLATFORM' ? 'info' : 'warning'} size="sm">
                  {company.type === 'PLATFORM' ? 'Platform' : 'Founder'}
                </Badge>
              </div>

              {company.description && (
                <p className={styles.cardDescription}>{company.description}</p>
              )}

              {/* Domain Tags */}
              <div className={styles.domainTags}>
                {company.domainsHired?.map((domain) => (
                  <span key={domain} className={styles.domainTag}>
                    {formatDomainLabel(domain)}
                  </span>
                ))}
              </div>

              {/* Stats Footer Row */}
              <div className={styles.statsRow}>
                <div className={styles.statItem} title="Employee roster count">
                  <UsersIcon size={14} />
                  <span>
                    <strong className={styles.statHighlight}>{company.employeeCount || 0}</strong>/
                    {company.maxEmployees || 20}
                  </span>
                </div>

                <div className={styles.statItem} title="Overall company rating">
                  <StarIcon size={14} color="var(--cv-gold-500)" />
                  <span className={styles.statHighlight}>
                    {(company.companyRating || company.ratings?.overall || 5.0).toFixed(1)}
                  </span>
                </div>

                <div className={styles.statItem}>
                  <Badge variant="default" size="sm">
                    {company.openJobCount || 0} Open Position
                    {company.openJobCount === 1 ? '' : 's'}
                  </Badge>
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
