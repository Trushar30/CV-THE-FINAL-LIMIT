import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { aiOpsApi, type HealthAndUsageDto, type AIPool, type ProviderDto } from '../api/aiOps';
import { Button } from '../components/ui/Button/Button';
import { Card } from '../components/ui/Card/Card';
import { Badge } from '../components/ui/Badge/Badge';
import { Spinner } from '../components/ui/Spinner/Spinner';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import styles from './AiOps.module.css';

export function AdminAiHealthPage(): ReactElement {
  const [pool, setPool] = useState<AIPool>('PIPELINE');
  const [data, setData] = useState<HealthAndUsageDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await aiOpsApi.getHealthAndUsage(pool);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI health diagnostics');
    } finally {
      setIsLoading(false);
    }
  }, [pool]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusBadgeVariant = (
    status: ProviderDto['status']
  ): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'HEALTHY':
        return 'success';
      case 'DEGRADED':
      case 'RATE_LIMITED':
        return 'warning';
      case 'TEMPORARILY_FAILED':
        return 'danger';
      case 'DISABLED':
      default:
        return 'default';
    }
  };

  const providers = data?.providers || [];
  const queueStats = data?.queueStats || {
    depth: 0,
    pending: 0,
    retrying: 0,
    processing: 0,
    waitingForProvider: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };
  const healthLogs = data?.recentHealthLogs || [];
  const responseLogs = data?.recentResponses || [];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>🛡️</span>
            <span>Platform AI Health & Observability</span>
          </h1>
          <p className={styles.subtitle}>
            Read-only platform oversight of multi-provider connectivity, circuit breaker health,
            queue backpressure, and runtime telemetry.
          </p>
        </div>

        <div className={styles.actions}>
          <div className={styles.poolSelector}>
            <button
              className={`${styles.poolTab} ${pool === 'PIPELINE' ? styles.poolTabActive : ''}`}
              onClick={() => setPool('PIPELINE')}
            >
              Pipeline Pool (DB)
            </button>
            <button
              className={`${styles.poolTab} ${pool === 'DEMO' ? styles.poolTabActive : ''}`}
              onClick={() => setPool('DEMO')}
            >
              Demo Pool (ENV)
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : '🔄 Refresh'}
          </Button>
        </div>
      </header>

      {/* Admin Read-Only Notice */}
      <div className={styles.readOnlyBanner}>
        <span className={styles.readOnlyIcon}>ℹ️</span>
        <div>
          <strong>Read-Only Administrative Overview:</strong> Provider configuration, API key vault
          mutation, and priority reorganization are restricted exclusively to the{' '}
          <code>AI_MANAGER</code> platform role.
        </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className={styles.errorCard}>
          <div className={styles.errorTitle}>Telemetry Unreachable</div>
          <p className={styles.errorMessage}>{error}</p>
          <Button variant="primary" size="sm" onClick={loadData}>
            Retry Diagnostics
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <Card>
          <div
            style={{
              padding: '3rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <Spinner size="lg" />
            <p style={{ color: 'var(--cv-text-secondary)', fontSize: '0.9375rem' }}>
              Querying provider statuses and queue health metrics...
            </p>
          </div>
        </Card>
      )}

      {/* Data View */}
      {data && (
        <>
          {/* Telemetry Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Queue Depth</span>
              <span className={styles.statValue}>{queueStats.depth}</span>
              <span className={styles.statMeta}>
                <span>{queueStats.pending} pending</span>
                <span>•</span>
                <span>{queueStats.processing} processing</span>
              </span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Waiting for Provider</span>
              <span
                className={styles.statValue}
                style={{
                  color: queueStats.waitingForProvider > 0 ? 'var(--cv-warning-400)' : 'inherit',
                }}
              >
                {queueStats.waitingForProvider}
              </span>
              <span className={styles.statMeta}>
                {queueStats.waitingForProvider > 0 ? (
                  <Badge variant="warning" size="sm" dot>
                    All Providers Down
                  </Badge>
                ) : (
                  <span>Optimal Flow</span>
                )}
              </span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Healthy Providers</span>
              <span className={styles.statValue}>
                {providers.filter((p) => p.status === 'HEALTHY').length}
                <span style={{ fontSize: '1rem', color: 'var(--cv-text-muted)' }}>
                  /{providers.length}
                </span>
              </span>
              <span className={styles.statMeta}>
                <span>
                  {
                    providers.filter((p) => p.status === 'DEGRADED' || p.status === 'RATE_LIMITED')
                      .length
                  }{' '}
                  degraded
                </span>
              </span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total Jobs Finished</span>
              <span className={styles.statValue}>{queueStats.completed}</span>
              <span className={styles.statMeta}>
                <span style={{ color: 'var(--cv-danger-400)' }}>{queueStats.failed} failed</span>
              </span>
            </div>
          </div>

          {/* Providers Table (Read-Only) */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>🔌</span>
              <span>Active Provider Health Matrix ({pool} Pool)</span>
            </h2>

            {providers.length === 0 ? (
              <EmptyState
                title={`No providers configured in ${pool} pool`}
                description="Zero provider adapters currently active in this environment pool."
              />
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Priority</th>
                        <th className={styles.th}>Provider</th>
                        <th className={styles.th}>Model</th>
                        <th className={styles.th}>Key Vault</th>
                        <th className={styles.th}>Health Status</th>
                        <th className={styles.th}>Avg Latency</th>
                        <th className={styles.th}>Success / Failure</th>
                        <th className={styles.th}>Last Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.map((p) => (
                        <tr key={p.id || p.code} className={styles.tr}>
                          <td className={styles.td}>
                            <span className={styles.priorityBadge}>{p.priority}</span>
                          </td>
                          <td className={styles.td}>
                            <div className={styles.providerInfo}>
                              <span className={styles.providerName}>{p.name}</span>
                              <span className={styles.providerCode}>{p.code.toUpperCase()}</span>
                            </div>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                              {p.modelId || 'config default'}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <span className={styles.keyMask}>
                              {p.maskedApiKey || '••••••••••••'}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <Badge variant={getStatusBadgeVariant(p.status)} size="sm" dot>
                              {p.status}
                            </Badge>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace' }}>
                              {p.averageLatencyMs ? `${Math.round(p.averageLatencyMs)}ms` : '—'}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <span>
                              {p.totalRequests} reqs (
                              <span
                                style={{
                                  color: p.totalFailures > 0 ? 'var(--cv-danger-400)' : 'inherit',
                                }}
                              >
                                {p.totalFailures} errs
                              </span>
                              )
                            </span>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                              {p.lastCheckedAt
                                ? new Date(p.lastCheckedAt).toLocaleTimeString()
                                : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Recent Diagnostics & Circuit Breaker Logs */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>📜</span>
              <span>Recent Diagnostic & Health Incidents</span>
            </h2>

            {healthLogs.length === 0 ? (
              <Card>
                <div
                  style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--cv-text-muted)' }}
                >
                  No recent circuit breaker incidents or health state changes recorded.
                </div>
              </Card>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Timestamp</th>
                        <th className={styles.th}>Provider</th>
                        <th className={styles.th}>Status Transition</th>
                        <th className={styles.th}>Latency</th>
                        <th className={styles.th}>Incident Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthLogs.slice(0, 15).map((log) => (
                        <tr key={log._id} className={styles.tr}>
                          <td className={styles.td}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <strong>{log.provider.toUpperCase()}</strong>
                          </td>
                          <td className={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {log.previousStatus && (
                                <>
                                  <Badge
                                    variant={getStatusBadgeVariant(log.previousStatus)}
                                    size="sm"
                                  >
                                    {log.previousStatus}
                                  </Badge>
                                  <span>→</span>
                                </>
                              )}
                              <Badge variant={getStatusBadgeVariant(log.status)} size="sm">
                                {log.status}
                              </Badge>
                            </div>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                              {log.latencyMs}ms
                            </span>
                          </td>
                          <td className={styles.td}>
                            <span
                              style={{
                                color: log.errorMessage
                                  ? 'var(--cv-danger-400)'
                                  : 'var(--cv-text-secondary)',
                                fontSize: '0.8125rem',
                              }}
                            >
                              {log.errorMessage || 'Health verification check passed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Recent Generation Logs */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>⚡</span>
              <span>Recent Inference Executions</span>
            </h2>

            {responseLogs.length === 0 ? (
              <Card>
                <div
                  style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--cv-text-muted)' }}
                >
                  No recent inference executions recorded in this environment.
                </div>
              </Card>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Time</th>
                        <th className={styles.th}>Provider</th>
                        <th className={styles.th}>Model</th>
                        <th className={styles.th}>Execution Latency</th>
                        <th className={styles.th}>Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responseLogs.slice(0, 10).map((r) => (
                        <tr key={r._id} className={styles.tr}>
                          <td className={styles.td}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                              {new Date(r.createdAt).toLocaleTimeString()}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <strong>{r.provider.toUpperCase()}</strong>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                              {r.model}
                            </span>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace' }}>{r.durationMs}ms</span>
                          </td>
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace' }}>
                              {r.tokensTotal !== undefined ? `${r.tokensTotal} tok` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default AdminAiHealthPage;
