import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import styles from './Founder.module.css';

export function BankruptcyOutcomePage(): ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className={styles.container} data-testid="bankruptcy-outcome-page">
      {/* Red Danger Liquidation Banner */}
      <div className={styles.dangerBanner}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 'var(--cv-text-xl)', color: 'var(--cv-status-danger-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span> Company Insolvent: Bankruptcy Liquidation Complete
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)', lineHeight: 1.5 }}>
            Your company's financial health crossed the insolvency threshold (&le; -1,000 CC). In accordance with Platform Governance (Spec §12, 14, 21), full liquidation was executed.
          </p>
        </div>
        <Badge variant="danger">STATUS: BANKRUPT</Badge>
      </div>

      {/* Liquidation Audit Details Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>⚖️</span> Liquidation Invariants & Asset Preservation
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--cv-space-4)' }}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Career Experience</span>
            <div className={styles.statValue} style={{ color: 'var(--cv-accent-emerald-400)' }}>
              {(user?.totalExpCached ?? 0).toLocaleString()} EXP
            </div>
            <span className={styles.statSubtext}>100% of lifelong career EXP is preserved</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Personal CorpCoin</span>
            <div className={styles.statValue} style={{ color: 'var(--cv-gold-400)' }}>
              🪙 {(user?.corpCoinBalanceCached ?? 0).toLocaleString()} CC
            </div>
            <span className={styles.statSubtext}>Personal liquidity untouched; company debt liquidated</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Current Track</span>
            <div className={styles.statValue} style={{ fontSize: 'var(--cv-text-lg)' }}>
              JOB SEEKER
            </div>
            <span className={styles.statSubtext}>Eligible to apply for engineering openings immediately</span>
          </div>
        </div>

        <div style={{ marginTop: 'var(--cv-space-2)', padding: 'var(--cv-space-4)', background: 'var(--cv-bg-canvas)', borderRadius: 'var(--cv-radius-md)', border: '1px solid var(--cv-border-subtle)', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)', lineHeight: 1.6 }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--cv-text-primary)', fontSize: 'var(--cv-text-base)' }}>
            What happened to your firm and staff:
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li><strong>Company State:</strong> Company marked <code>BANKRUPT</code>, hiring deactivated, and open job requisitions archived.</li>
            <li><strong>Employees Released:</strong> All staff members received liquidation notices and were released back to Job Seeker status with their accumulated EXP preserved.</li>
            <li><strong>Debt Absorption:</strong> Accumulated deficit was wiped with the liquidated enterprise. No personal debt follows the founder.</li>
            <li><strong>Future Re-entry:</strong> You may re-unlock Founder Mode later. Note that starter capital (1,000 CC) is granted once ever and will not be re-credited.</li>
          </ul>
        </div>
      </div>

      {/* Talent Market Re-entry Actions */}
      <div className={styles.sectionCard} style={{ background: 'linear-gradient(180deg, var(--cv-bg-surface) 0%, rgba(39, 62, 65, 0.15) 100%)' }}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-lg)', fontWeight: 700, color: 'var(--cv-text-primary)' }}>
              Re-enter the Talent Market
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
              Your career EXP and history qualify you for senior engineering positions across platform companies.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/career')}
            >
              Career Hub
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/jobs')}
              data-testid="reentry-jobs-btn"
            >
              Browse Open Positions 🚀
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
