import { useState, type ReactElement, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import styles from './Founder.module.css';

const CREATION_COST = 100;

export function CreateCompanyPage(): ReactElement {
  const navigate = useNavigate();
  const { user, fetchCurrentUser } = useAuth();
  const { success, error, warning } = useToast();

  const [name, setName] = useState('');
  const [domain, setDomain] = useState<'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING'>(
    user?.domain || 'SOFTWARE_ENGINEERING'
  );
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentBalance = user?.corpCoinBalanceCached ?? 0;
  const balanceAfter = currentBalance - CREATION_COST;
  const hasSufficientFunds = currentBalance >= CREATION_COST;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!name.trim()) {
      warning('Company name is required');
      return;
    }

    if (!hasSufficientFunds) {
      error(`Insufficient CorpCoin balance (${currentBalance} CC). Required: ${CREATION_COST} CC`);
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/founder/company', {
        name: name.trim(),
        domain,
        description: description.trim() || undefined,
      });

      success(`Company "${name.trim()}" established successfully!`);
      await fetchCurrentUser();
      navigate('/founder/bots');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create company';
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container} data-testid="create-company-page">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>🏢</span> Establish Your Corporation
          </h1>
          <Badge variant="gold">Founder Mode Active</Badge>
        </div>
        <p className={styles.subtitle}>
          Incorporate your engineering enterprise. Setup costs are debited from your personal CorpCoin balance with an immutable ledger entry.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--cv-space-6)' }}>
        {/* Company Creation Form */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span>📝</span> Company Registration Details
            </h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="company-name">
                Company Name *
              </label>
              <input
                id="company-name"
                className={styles.formInput}
                type="text"
                placeholder="e.g. Apex Synthetics Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                data-testid="company-name-input"
              />
              <span className={styles.formHint}>Must be a unique name across the platform.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="company-domain">
                Primary Engineering Domain *
              </label>
              <select
                id="company-domain"
                className={styles.formSelect}
                value={domain}
                onChange={(e) =>
                  setDomain(
                    e.target.value as 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING'
                  )
                }
                data-testid="company-domain-select"
              >
                <option value="SOFTWARE_ENGINEERING">Software Engineering</option>
                <option value="CLOUD_ENGINEERING">Cloud Engineering</option>
                <option value="AI_ENGINEERING">AI Engineering</option>
              </select>
              <span className={styles.formHint}>Specializes the focus of company bots and client contracts.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="company-description">
                Corporate Mission / Brief (Optional)
              </label>
              <textarea
                id="company-description"
                className={styles.formTextarea}
                rows={3}
                placeholder="Briefly describe your firm's engineering mission..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>

            <div style={{ marginTop: 'var(--cv-space-2)' }}>
              <Button
                variant="gold"
                size="lg"
                type="submit"
                loading={submitting}
                disabled={!hasSufficientFunds || !name.trim()}
                data-testid="submit-create-company"
              >
                Incorporate Company ({CREATION_COST} CC)
              </Button>
            </div>
          </form>
        </div>

        {/* Cost & Balance Summary Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span>🪙</span> Incorporation Fee Breakdown
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
                <span>Registration Fee</span>
                <span style={{ fontWeight: 700, color: 'var(--cv-gold-400)' }}>{CREATION_COST} CorpCoin</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
                <span>Available Personal Balance</span>
                <span>{currentBalance.toLocaleString()} CorpCoin</span>
              </div>
              <div style={{ height: '1px', background: 'var(--cv-border-subtle)', margin: 'var(--cv-space-1) 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--cv-text-base)', fontWeight: 700, color: balanceAfter >= 0 ? 'var(--cv-text-primary)' : 'var(--cv-status-danger-text)' }}>
                <span>Estimated Balance After</span>
                <span>{balanceAfter.toLocaleString()} CorpCoin</span>
              </div>
            </div>

            {!hasSufficientFunds && (
              <div style={{ padding: 'var(--cv-space-3)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--cv-radius-md)', color: 'var(--cv-status-danger-text)', fontSize: 'var(--cv-text-xs)' }}>
                ⚠️ You require at least {CREATION_COST} CorpCoin to establish a company.
              </div>
            )}
          </div>

          {/* Operating Rules Card */}
          <div className={styles.sectionCard} style={{ background: 'var(--cv-bg-canvas)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--cv-text-sm)', fontWeight: 700, color: 'var(--cv-text-primary)' }}>
              Operating Invariants (Spec §12.3)
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', lineHeight: 1.5 }}>
              <li><strong>1 Active Company:</strong> Founders can own exactly one active company in v1.</li>
              <li><strong>Capacity Limit:</strong> Max 20 employees per company.</li>
              <li><strong>Workforce Setup:</strong> Company starts in closed hiring status until all 3 basic AI bots are purchased.</li>
              <li><strong>Bankruptcy Risk:</strong> Drops below -1,000 CC financial health trigger full liquidation.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
