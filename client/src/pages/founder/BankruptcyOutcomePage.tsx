import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { AlertTriangleIcon, ScaleIcon, CoinIcon, ZapIcon, BriefcaseIcon } from '../../components/ui/Icon';
import styles from './Founder.module.css';

export function BankruptcyOutcomePage(): ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className={styles.container} data-testid="bankruptcy-outcome-page">
      {/* Red Danger Liquidation Banner */}
      <div className={styles.dangerBanner}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--cv-text-xl)', color: 'var(--cv-status-danger-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangleIcon size={20} color="var(--cv-status-danger-text)" /> Company Insolvent: Bankruptcy Liquidation Complete
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
          <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ScaleIcon size={18} color="var(--cv-brand-500)" /> Liquidation Invariants & Asset Preservation
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--cv-space-4)' }}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Career Experience</span>
            <div className={styles.statValue} style={{ color: 'var(--cv-status-success-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ZapIcon size={16} color="var(--cv-status-success-text)" />
              <span className="tabular-nums">{(user?.totalExpCached ?? 0).toLocaleString()} EXP</span>
            </div>
            <span className={styles.statSubtext}>100% of lifelong career EXP is preserved</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Personal CorpCoin</span>
            <div className={styles.statValue} style={{ color: 'var(--cv-gold-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CoinIcon size={16} color="var(--cv-gold-400)" />
              <span className="tabular-nums">{(user?.corpCoinBalanceCached ?? 0).toLocaleString()} CC</span>
            </div>
            <span className={styles.statSubtext}>Personal liquidity untouched; company debt liquidated</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Current Track</span>
            <div className={styles.statValue} style={{ fontSize: 'var(--cv-text-lg)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BriefcaseIcon size={16} color="var(--cv-brand-500)" />
              <span>JOB SEEKER</span>
            </div>
            <span className={styles.statSubtext}>Eligible to apply for engineering openings immediately</span>
          </div>
        </div>

        <div style={{ marginTop: 'var(--cv-space-6)', padding: 'var(--cv-space-4)', background: 'var(--cv-bg-surface-elevated)', borderRadius: 'var(--cv-radius-md)', border: '1px solid var(--cv-border-default)' }}>
          <h4 style={{ margin: '0 0 var(--cv-space-2)', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-primary)' }}>
            Corporate State Dissolution Summary
          </h4>
          <ul style={{ margin: 0, paddingLeft: 'var(--cv-space-5)', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)', lineHeight: 1.8 }}>
            <li>The insolvent company record was terminated and marked INACTIVE.</li>
            <li>All open job requisitions were automatically cancelled.</li>
            <li>Active employees received severance notification and reverted to open market.</li>
            <li>Your user role was restored to <strong>JOB_SEEKER</strong>. You retain all accumulated career EXP.</li>
          </ul>
        </div>

        <div style={{ marginTop: 'var(--cv-space-6)', display: 'flex', gap: 'var(--cv-space-3)' }}>
          <Button variant="primary" onClick={() => navigate('/jobs')} data-testid="reentry-jobs-btn">
            Browse Open Job Requisitions →
          </Button>
          <Button variant="outline" onClick={() => navigate('/career')}>
            View Career Hub
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BankruptcyOutcomePage;
