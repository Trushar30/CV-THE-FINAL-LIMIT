import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { Table, type Column } from '../../components/ui/Table/Table';
import styles from './Founder.module.css';

interface CompanyData {
  _id: string;
  name: string;
  domain: string;
  status: 'ACTIVE' | 'BANKRUPT' | 'SUSPENDED';
  isOpenForHiring: boolean;
  financialHealth: number;
  companyRating: number;
  employeeSatisfaction?: number;
  retentionRate?: number;
  employeeCount: number;
  maxEmployees: number;
  operatingDays?: number;
  cumulativeRevenue?: number;
  cumulativeProfit?: number;
}

interface FinancialSnapshot {
  _id: string;
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
  financialHealth: number;
  companyRating: number;
  employeeSatisfaction: number;
  employeeRetentionRate: number;
  employeeCount: number;
  recordedAt: string;
}

interface EmployeeItem {
  _id: string;
  userId: {
    _id: string;
    email: string;
    displayName?: string;
  } | string;
  domain: string;
  level: number;
  positionTitle: string;
  status: string;
  startedAt: string;
}

export function FounderDashboardPage(): ReactElement {
  const navigate = useNavigate();
  const { error } = useToast();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [financials, setFinancials] = useState<FinancialSnapshot[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  const loadDashboard = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const companyRes = await apiClient.get<CompanyData>('/founder/company');
      setCompany(companyRes);

      if (companyRes.status === 'BANKRUPT') {
        navigate('/founder/bankrupt');
        return;
      }

      // Fetch financial history snapshots & employee roster in parallel
      const [finRes, empRes] = await Promise.allSettled([
        apiClient.get<FinancialSnapshot[]>('/founder/simulation/financials?limit=15'),
        apiClient.get<{ employees: EmployeeItem[] }>('/founder/employees'),
      ]);

      if (finRes.status === 'fulfilled') {
        setFinancials(finRes.value);
      }
      if (empRes.status === 'fulfilled') {
        setEmployees(empRes.value.employees || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No active company found for this founder';
      // If 404, user needs to create a company
      if (msg.includes('No active company') || msg.includes('404')) {
        setCompany(null);
      } else {
        error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, error]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Loading Corporate Executive Command...</p>
      </div>
    );
  }

  // If user has not created a company yet
  if (!company) {
    return (
      <div className={styles.container} data-testid="no-company-state">
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span>🏢</span> Corporate Command Center
          </h1>
          <p className={styles.subtitle}>You hold Founder Mode privileges, but do not yet own an active enterprise.</p>
        </div>

        <div className={styles.sectionCard} style={{ textAlign: 'center', padding: 'var(--cv-space-8) var(--cv-space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏗️</div>
          <h2 style={{ margin: 0, fontSize: 'var(--cv-text-xl)', color: 'var(--cv-text-primary)' }}>Establish Your Corporation</h2>
          <p style={{ maxWidth: 540, margin: '0.5rem auto 1.5rem', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
            Founders receive starter capital to establish a new corporation and acquire an autonomous AI bot workforce.
          </p>
          <div>
            <Button variant="gold" size="lg" onClick={() => navigate('/founder/company/new')} data-testid="start-company-btn">
              Create New Company (100 CC) 🚀
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const health = company.financialHealth ?? 0;
  // Bankruptcy threshold is -1000
  // Gauge scale: from -1000 (0%) to +1000 (100%)
  const gaugePercent = Math.max(0, Math.min(100, Math.round(((health + 1000) / 2000) * 100)));

  let healthColorClass = styles.healthSafe;
  let healthLabel = 'Solvent & Stable';
  if (health <= -1000) {
    healthColorClass = styles.healthInsolvent;
    healthLabel = 'Insolvent (Liquidation Threshold)';
  } else if (health <= -500) {
    healthColorClass = styles.healthCritical;
    healthLabel = 'Critical Insolvency Danger';
  } else if (health <= 0) {
    healthColorClass = styles.healthWarning;
    healthLabel = 'Operating Under Deficit';
  }

  const employeeColumns: Column<EmployeeItem>[] = [
    {
      key: 'employee',
      header: 'Staff Member',
      render: (emp) => {
        const email = typeof emp.userId === 'object' && emp.userId !== null ? emp.userId.email : 'Employee';
        const name = typeof emp.userId === 'object' && emp.userId !== null ? emp.userId.displayName || email : email;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--cv-text-primary)' }}>{name}</span>
            <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>{email}</span>
          </div>
        );
      },
    },
    {
      key: 'position',
      header: 'Role & Domain',
      render: (emp) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: 'var(--cv-text-secondary)' }}>{emp.positionTitle}</span>
          <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>{emp.domain}</span>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Seniority',
      render: (emp) => <Badge variant="default">Level {emp.level}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (emp) => {
        const variant = emp.status === 'ACTIVE' ? 'success' : emp.status === 'ON_PROBATION' ? 'warning' : 'default';
        return <Badge variant={variant}>{emp.status}</Badge>;
      },
    },
    {
      key: 'joined',
      header: 'Start Date',
      render: (emp) => (
        <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
          {new Date(emp.startedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.container} data-testid="founder-dashboard-page">
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className={styles.title}>
              <span>🏛️</span> {company.name}
            </h1>
            <Badge variant="cyan">{company.domain.replace('_', ' ')}</Badge>
            {company.isOpenForHiring ? (
              <Badge variant="success">Open for Hiring</Badge>
            ) : (
              <Badge variant="default">Hiring Paused</Badge>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/founder/simulation')}>
              ⚡ Daily Dilemma
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/founder/bots')}>
              🛒 Bot Fleet
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/founder/jobs')}>
              📋 Open Requisitions
            </Button>
          </div>
        </div>
        <p className={styles.subtitle}>
          Day {company.operatingDays ?? 1} of corporate operations • {company.employeeCount} / {company.maxEmployees} employees deployed.
        </p>

        {/* Tab Navigation */}
        <div className={styles.navTabs}>
          <Link to="/founder" className={`${styles.navTab} ${styles.navTabActive}`}>Command Overview</Link>
          <Link to="/founder/simulation" className={styles.navTab}>Daily Dilemma & Tick</Link>
          <Link to="/founder/bots" className={styles.navTab}>Bot Fleet ({company.isOpenForHiring ? 'Active' : 'Setup'})</Link>
          <Link to="/founder/jobs" className={styles.navTab}>Job Openings</Link>
          <Link to="/founder/applicants" className={styles.navTab}>Applicant Pipeline</Link>
          <Link to="/founder/ledger" className={styles.navTab}>CorpCoin Ledger</Link>
        </div>
      </div>

      {/* Financial Health Gauge Card */}
      <div className={styles.healthGaugeCard} data-testid="health-gauge-card">
        <div className={styles.healthGaugeHeader}>
          <div>
            <span className={styles.statLabel}>Company Financial Health (Solvency Meter)</span>
            <div className={`${styles.healthValue} ${healthColorClass}`}>
              {health.toLocaleString()} CC
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Badge variant={health > 0 ? 'success' : health > -500 ? 'warning' : 'danger'}>
              {healthLabel}
            </Badge>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>
              Insolvency Liquidation: &le; -1,000 CC
            </p>
          </div>
        </div>

        <div className={styles.gaugeBarTrack}>
          <div
            className={styles.gaugeBarFill}
            style={{
              width: `${gaugePercent}%`,
              backgroundColor: health > 0 ? 'var(--cv-accent-emerald-400)' : health > -500 ? 'var(--cv-gold-400)' : 'var(--cv-status-danger-text)',
            }}
          />
        </div>

        <div className={styles.gaugeScaleMarkers}>
          <span style={{ color: 'var(--cv-status-danger-text)' }}>-1,000 CC (Bankruptcy)</span>
          <span>-500 CC (Warning)</span>
          <span>0 CC (Breakeven)</span>
          <span style={{ color: 'var(--cv-accent-emerald-400)' }}>+1,000 CC (Thriving)</span>
        </div>
      </div>

      {/* Primary Financial & Operational Stats Grid */}
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Cumulative Revenue</span>
          <div className={styles.statValue}>
            🪙 {(company.cumulativeRevenue ?? 0).toLocaleString()}
          </div>
          <span className={styles.statSubtext}>Total earned across operations</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Cumulative Net Profit</span>
          <div className={`${styles.statValue} ${(company.cumulativeProfit ?? 0) >= 0 ? styles.statValueProfit : styles.statValueLoss}`}>
            🪙 {(company.cumulativeProfit ?? 0).toLocaleString()}
          </div>
          <span className={styles.statSubtext}>Historical earnings minus expenses</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Reputation Score (Q)</span>
          <div className={styles.statValue} style={{ color: 'var(--cv-accent-cyan-400)' }}>
            {company.companyRating} / 100
          </div>
          <span className={styles.statSubtext}>Directly boosts revenue multiplier</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Employee Satisfaction (S)</span>
          <div className={styles.statValue} style={{ color: 'var(--cv-violet-400)' }}>
            {company.employeeSatisfaction ?? 70} / 100
          </div>
          <span className={styles.statSubtext}>Affects retention rate (&lt;60 triggers decay)</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Retention Rate (T)</span>
          <div className={styles.statValue}>
            {company.retentionRate ?? 100}%
          </div>
          <span className={styles.statSubtext}>Staff stability indicator</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Workforce Headcount</span>
          <div className={styles.statValue}>
            {company.employeeCount} / {company.maxEmployees}
          </div>
          <span className={styles.statSubtext}>Engineers producing daily value</span>
        </div>
      </div>

      {/* Employee Roster Section */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>👥</span> Corporate Workforce Roster ({employees.length} Engineers)
          </h2>
          <Button variant="secondary" size="sm" onClick={() => navigate('/founder/jobs')}>
            + Hire More Staff
          </Button>
        </div>

        {employees.length === 0 ? (
          <div className={styles.emptyState}>
            <span>👤</span>
            <h3 className={styles.emptyStateTitle}>No Employees Hired Yet</h3>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-sm)' }}>
              Open a job requisition to recruit talent into your engineering workforce.
            </p>
          </div>
        ) : (
          <Table<EmployeeItem>
            data={employees}
            columns={employeeColumns}
            keyExtractor={(emp) => emp._id}
            emptyText="No employees found"
          />
        )}
      </div>

      {/* Historical Financial Snapshots Section */}
      {financials.length > 0 && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span>📈</span> Daily Financial History Snapshots
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--cv-text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--cv-border-default)', color: 'var(--cv-text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Revenue</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Expenses</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Net Profit</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Financial Health</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reputation</th>
                </tr>
              </thead>
              <tbody>
                {financials.map((snap) => (
                  <tr key={snap._id} style={{ borderBottom: '1px solid var(--cv-border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--cv-text-primary)' }}>{snap.date}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--cv-accent-emerald-400)' }}>+{snap.revenue} CC</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--cv-status-danger-text)' }}>-{snap.expenses} CC</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: snap.profit >= 0 ? 'var(--cv-accent-emerald-400)' : 'var(--cv-status-danger-text)' }}>
                      {snap.profit >= 0 ? `+${snap.profit}` : snap.profit} CC
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{snap.financialHealth} CC</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{snap.companyRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
