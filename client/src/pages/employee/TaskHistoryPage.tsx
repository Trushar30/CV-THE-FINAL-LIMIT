import { useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import {
  fetchTaskHistory,
  fetchExpLedger,
  type TaskHistoryItem,
  type ExpTransaction,
} from '../../api/employee';
import styles from './Employee.module.css';

export function TaskHistoryPage(): ReactElement {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tasks' | 'ledger'>('tasks');

  const [historyItems, setHistoryItems] = useState<TaskHistoryItem[]>([]);
  const [transactions, setTransactions] = useState<ExpTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        setIsLoading(true);
        setError(null);

        const [historyData, ledgerData] = await Promise.all([
          fetchTaskHistory().catch(() => []),
          fetchExpLedger().catch(() => []),
        ]);

        if (isMounted) {
          setHistoryItems(historyData);
          setTransactions(ledgerData);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load career history');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 0' }}>
        <Spinner size="lg" label="Loading task history and immutable EXP ledger..." />
        <p style={{ marginTop: '1rem', color: 'var(--cv-text-secondary)' }}>
          Loading task history and immutable EXP ledger...
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/workplace')}>
          ← Back to Workplace Dashboard
        </Button>
        <h1 className={styles.title} style={{ fontSize: 'var(--cv-text-2xl)' }}>
          Workplace History & Ledgers
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNav} data-testid="history-tabs">
        <button
          className={`${styles.tabButton} ${activeTab === 'tasks' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('tasks')}
          data-testid="tab-tasks"
        >
          Evaluated Tasks ({historyItems.length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'ledger' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('ledger')}
          data-testid="tab-ledger"
        >
          EXP Transaction Ledger ({transactions.length})
        </button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--cv-radius-md)' }}>
          {error}
        </div>
      )}

      {/* Evaluated Tasks Tab */}
      {activeTab === 'tasks' && (
        <Card title="Past Engineering Tasks" subtitle="Historical record of evaluated scenarios and rubric scores">
          {historyItems.length === 0 ? (
            <EmptyState
              title="No Evaluated Tasks"
              description="Complete and submit your daily tasks from the workplace dashboard to start building your career record."
              action={
                <Button variant="primary" onClick={() => navigate('/workplace')}>
                  Go to Tasks
                </Button>
              }
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.historyTable} data-testid="task-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Task Title</th>
                    <th>Kind / Tier</th>
                    <th>AI Score</th>
                    <th>EXP Awarded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map(({ record, task }) => (
                    <tr key={record._id}>
                      <td>{new Date(record.createdAt).toLocaleDateString()}</td>
                      <td>
                        <strong>{task?.title || 'Engineering Scenario'}</strong>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          <Badge variant={task?.kind === 'PRIMARY' ? 'primary' : 'default'} size="sm">
                            {task?.kind || 'PRIMARY'}
                          </Badge>
                          <Badge variant="default" size="sm">
                            {task?.difficulty || 'MEDIUM'}
                          </Badge>
                        </span>
                      </td>
                      <td>
                        <Badge
                          variant={
                            record.scoreBand === 'EXCELLENT' || record.scoreBand === 'GOOD'
                              ? 'success'
                              : record.scoreBand === 'ACCEPTABLE'
                              ? 'primary'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {record.aiScore} / 100 • {record.scoreBand}
                        </Badge>
                      </td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>
                        +{record.awardedExp} EXP
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/tasks/${record.taskId}`)}
                        >
                          View Rubric
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* EXP Ledger Tab */}
      {activeTab === 'ledger' && (
        <Card
          title="EXP Transaction Ledger"
          subtitle="Double-entry, immutable audit trail of all career experience credits"
        >
          {transactions.length === 0 ? (
            <EmptyState
              title="No Transactions"
              description="Your experience ledger is currently empty. Complete tasks to earn EXP."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.historyTable} data-testid="exp-ledger-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Transaction Type</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                    <th>Reason / Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id}>
                      <td>{new Date(tx.createdAt).toLocaleString()}</td>
                      <td>
                        <Badge variant="primary" size="sm">
                          {tx.type}
                        </Badge>
                      </td>
                      <td style={{ color: tx.amount >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} EXP
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.balanceAfter.toLocaleString()} EXP</td>
                      <td style={{ color: 'var(--cv-text-secondary)' }}>{tx.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
