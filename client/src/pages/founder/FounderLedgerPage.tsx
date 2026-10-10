import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { Table, type Column } from '../../components/ui/Table/Table';
import styles from './Founder.module.css';

interface LedgerTransaction {
  _id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  createdAt: string;
}

export function FounderLedgerPage(): ReactElement {
  const { user } = useAuth();
  const { error } = useToast();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);

  const loadLedger = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ transactions: LedgerTransaction[] }>('/founder/ledger?limit=50');
      setTransactions(res.transactions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch CorpCoin transaction ledger';
      error(msg);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Querying Immutable Economic Ledgers...</p>
      </div>
    );
  }

  const columns: Column<LedgerTransaction>[] = [
    {
      key: 'date',
      header: 'Timestamp',
      render: (tx) => (
        <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
          {new Date(tx.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Transaction Type',
      render: (tx) => {
        const isGrant = tx.type === 'FOUNDER_STARTER_GRANT';
        const isCost = tx.type === 'COMPANY_CREATION' || tx.type === 'BOT_PURCHASE';
        const variant = isGrant ? 'gold' : isCost ? 'cyan' : 'default';
        return <Badge variant={variant}>{tx.type.replace(/_/g, ' ')}</Badge>;
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (tx) => {
        const isCredit = tx.amount > 0;
        return (
          <span style={{ fontWeight: 700, color: isCredit ? 'var(--cv-accent-emerald-400)' : 'var(--cv-status-danger-text)' }}>
            {isCredit ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} CC
          </span>
        );
      },
    },
    {
      key: 'balanceAfter',
      header: 'Balance After',
      render: (tx) => (
        <span style={{ fontWeight: 600, color: 'var(--cv-text-primary)' }}>
          🪙 {tx.balanceAfter.toLocaleString()} CC
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason & Context',
      render: (tx) => (
        <span style={{ fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
          {tx.reason}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.container} data-testid="founder-ledger-page">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>🪙</span> Immutable CorpCoin Ledger
          </h1>
          <Badge variant="gold">
            Current Balance: {(user?.corpCoinBalanceCached ?? 0).toLocaleString()} CC
          </Badge>
        </div>
        <p className={styles.subtitle}>
          Authoritative, append-only double-entry ledger tracking all founder startup capital, corporate formation fees, and AI bot purchases.
        </p>

        {/* Navigation Tabs */}
        <div className={styles.navTabs}>
          <Link to="/founder" className={styles.navTab}>Command Overview</Link>
          <Link to="/founder/simulation" className={styles.navTab}>Daily Dilemma & Tick</Link>
          <Link to="/founder/bots" className={styles.navTab}>Bot Fleet</Link>
          <Link to="/founder/jobs" className={styles.navTab}>Job Openings</Link>
          <Link to="/founder/applicants" className={styles.navTab}>Applicant Pipeline</Link>
          <Link to="/founder/ledger" className={`${styles.navTab} ${styles.navTabActive}`}>CorpCoin Ledger</Link>
        </div>
      </div>

      {/* Ledger Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>📜</span> Transaction History ({transactions.length})
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <span>🪙</span>
            <h3 className={styles.emptyStateTitle}>No Transactions Recorded</h3>
            <p style={{ margin: 0, fontSize: 'var(--cv-text-sm)' }}>
              Transactions appear here when starter capital is granted or company expenses are incurred.
            </p>
          </div>
        ) : (
          <Table<LedgerTransaction>
            data={transactions}
            columns={columns}
            keyExtractor={(tx) => tx._id}
            emptyText="No ledger transactions found"
          />
        )}
      </div>
    </div>
  );
}
