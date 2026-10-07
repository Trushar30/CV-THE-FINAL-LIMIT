import { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  aiOpsApi,
  type ProviderDto,
  type HealthAndUsageDto,
  type AIPool,
  type AIProvider,
  type CreateProviderPayload,
  type UpdateProviderPayload,
  type TestResultDto,
} from '../api/aiOps';
import { Button } from '../components/ui/Button/Button';
import { Card } from '../components/ui/Card/Card';
import { Badge } from '../components/ui/Badge/Badge';
import { Input } from '../components/ui/Input/Input';
import { Modal } from '../components/ui/Modal/Modal';
import { Spinner } from '../components/ui/Spinner/Spinner';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import { useToast } from '../components/ui/Toast/ToastContext';
import styles from './AiOps.module.css';

export function AiManagerPage(): ReactElement {
  const {
    error: toastError,
    success: toastSuccess,
    warning: toastWarning,
    info: toastInfo,
  } = useToast();

  const [pool, setPool] = useState<AIPool>('PIPELINE');
  const [data, setData] = useState<HealthAndUsageDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isTestResultOpen, setIsTestResultOpen] = useState<boolean>(false);

  // Active provider for edit or action
  const [selectedProvider, setSelectedProvider] = useState<ProviderDto | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    'ENABLE' | 'DISABLE' | 'DELETE' | 'REORDER' | null
  >(null);
  const [confirmReason, setConfirmReason] = useState<string>('');
  const [newPriorityValue, setNewPriorityValue] = useState<number>(1);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Testing provider state
  const [testingCode, setTestingCode] = useState<AIProvider | null>(null);
  const [testResult, setTestResult] = useState<TestResultDto | null>(null);

  // Add Provider form state
  const [addForm, setAddForm] = useState<CreateProviderPayload>({
    code: 'gemini',
    name: 'Google Gemini Pro',
    priority: 1,
    pool: 'PIPELINE',
    modelId: 'gemini-1.5-pro',
    apiKey: '',
    rateLimitRpm: 60,
    dailyLimit: 5000,
    reason: '',
  });

  // Edit Provider form state
  const [editForm, setEditForm] = useState<UpdateProviderPayload>({
    priority: 1,
    modelId: '',
    apiKey: '',
    rateLimitRpm: 60,
    dailyLimit: 5000,
    reason: '',
  });

  // Load health, usage and providers
  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await aiOpsApi.getHealthAndUsage(pool);
      setData(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load AI operations data';
      setError(msg);
      toastError(msg, 'Data Load Failure');
    } finally {
      setIsLoading(false);
    }
  }, [pool, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit Modal
  const handleOpenEdit = (p: ProviderDto): void => {
    setSelectedProvider(p);
    setEditForm({
      priority: p.priority,
      modelId: p.modelId || '',
      apiKey: '',
      rateLimitRpm: p.rateLimitRpm,
      dailyLimit: p.dailyLimit || undefined,
      reason: '',
    });
    setIsEditOpen(true);
  };

  // Submit Add Provider
  const handleCreateSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!addForm.reason || addForm.reason.trim().length < 3) {
      toastWarning(
        'A descriptive audit reason of at least 3 characters is required',
        'Validation Error'
      );
      return;
    }

    setIsSubmittingAction(true);
    try {
      await aiOpsApi.createProvider({
        ...addForm,
        pool,
      });
      toastSuccess(
        `Provider ${addForm.code.toUpperCase()} successfully registered in ${pool} pool`,
        'Provider Added'
      );
      setIsAddOpen(false);
      setAddForm({
        code: 'gemini',
        name: 'Google Gemini Pro',
        priority: 1,
        pool,
        modelId: 'gemini-1.5-pro',
        apiKey: '',
        rateLimitRpm: 60,
        dailyLimit: 5000,
        reason: '',
      });
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create provider';
      toastError(msg, 'Creation Failed');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit Edit Provider
  const handleEditSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedProvider) return;
    if (!editForm.reason || editForm.reason.trim().length < 3) {
      toastWarning(
        'A descriptive audit reason of at least 3 characters is required',
        'Validation Error'
      );
      return;
    }

    setIsSubmittingAction(true);
    try {
      const payload: UpdateProviderPayload = {
        priority: editForm.priority,
        modelId: editForm.modelId || undefined,
        rateLimitRpm: editForm.rateLimitRpm,
        dailyLimit: editForm.dailyLimit,
        reason: editForm.reason,
      };
      if (editForm.apiKey && editForm.apiKey.trim().length > 0) {
        payload.apiKey = editForm.apiKey.trim();
      }

      await aiOpsApi.updateProvider(selectedProvider.code, payload, selectedProvider.pool);
      toastSuccess(
        `Successfully updated configuration for ${selectedProvider.code.toUpperCase()}`,
        'Provider Updated'
      );
      setIsEditOpen(false);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update provider';
      toastError(msg, 'Update Failed');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Trigger priority reorder confirmation
  const handleRequestPriorityChange = (provider: ProviderDto, newPriority: number): void => {
    setSelectedProvider(provider);
    setNewPriorityValue(newPriority);
    setConfirmAction('REORDER');
    setConfirmReason(`Adjusting priority routing from ${provider.priority} to ${newPriority}`);
    setIsConfirmOpen(true);
  };

  // Trigger Enable / Disable / Delete confirmation
  const handleOpenActionConfirm = (
    provider: ProviderDto,
    action: 'ENABLE' | 'DISABLE' | 'DELETE'
  ): void => {
    setSelectedProvider(provider);
    setConfirmAction(action);
    setConfirmReason('');
    setIsConfirmOpen(true);
  };

  // Execute confirmed action (Enable, Disable, Delete, Reorder)
  const handleExecuteConfirmedAction = async (): Promise<void> => {
    if (!selectedProvider || !confirmAction) return;
    if (!confirmReason || confirmReason.trim().length < 3) {
      toastWarning(
        'A valid audit reason is mandatory for all provider modifications',
        'Validation Error'
      );
      return;
    }

    setIsSubmittingAction(true);
    try {
      if (confirmAction === 'ENABLE') {
        await aiOpsApi.enableProvider(selectedProvider.code, confirmReason, selectedProvider.pool);
        toastSuccess(
          `${selectedProvider.name} is now ACTIVE and eligible for routing`,
          'Provider Enabled'
        );
      } else if (confirmAction === 'DISABLE') {
        await aiOpsApi.disableProvider(selectedProvider.code, confirmReason, selectedProvider.pool);
        toastWarning(
          `${selectedProvider.name} is now DISABLED and will be skipped in routing`,
          'Provider Disabled'
        );
      } else if (confirmAction === 'DELETE') {
        await aiOpsApi.removeProvider(selectedProvider.code, confirmReason, selectedProvider.pool);
        toastInfo(
          `${selectedProvider.name} was cleanly removed from ${selectedProvider.pool} pool`,
          'Provider Removed'
        );
      } else if (confirmAction === 'REORDER') {
        await aiOpsApi.updateProvider(
          selectedProvider.code,
          {
            priority: newPriorityValue,
            reason: confirmReason,
          },
          selectedProvider.pool
        );
        toastSuccess(
          `${selectedProvider.name} priority set to ${newPriorityValue}`,
          'Priority Updated'
        );
      }

      setIsConfirmOpen(false);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action execution failed';
      toastError(msg, 'Operation Failed');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Run live diagnostic test ping
  const handleTestProvider = async (provider: ProviderDto): Promise<void> => {
    setTestingCode(provider.code);
    try {
      const res = await aiOpsApi.testProvider(provider.code, provider.pool);
      setTestResult(res);
      setIsTestResultOpen(true);
      if (res.success) {
        toastSuccess(
          `${provider.code.toUpperCase()} responded in ${res.latencyMs}ms (${res.status})`,
          'Health Ping Successful'
        );
      } else {
        toastError(res.errorMessage || 'Provider failed diagnostic probe', 'Health Ping Degraded');
      }
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test request failed';
      toastError(msg, 'Test Failed');
    } finally {
      setTestingCode(null);
    }
  };

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

  // Calculate usage totals for charts
  const totalRequestsAcrossAll = providers.reduce((acc, p) => acc + (p.totalRequests || 0), 0);
  const totalFailuresAcrossAll = providers.reduce((acc, p) => acc + (p.totalFailures || 0), 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>🧠</span>
            <span>AI Operations & Infrastructure Console</span>
          </h1>
          <p className={styles.subtitle}>
            Multi-provider routing, priority reordering, AES-256-GCM key vault protection, and
            asynchronous queue reliability.
          </p>
        </div>

        <div className={styles.actions}>
          {/* Pool Selector */}
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

          <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
            + Add Provider
          </Button>
        </div>
      </header>

      {/* Error state */}
      {error && !isLoading && (
        <div className={styles.errorCard}>
          <div className={styles.errorTitle}>Error Loading Infrastructure Telemetry</div>
          <p className={styles.errorMessage}>{error}</p>
          <Button variant="primary" size="sm" onClick={loadData}>
            Retry Request
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
              Fetching real-time provider matrix, queue depths, and telemetry...
            </p>
          </div>
        </Card>
      )}

      {/* Loaded view */}
      {data && (
        <>
          {/* Stat Cards / Queue Telemetry */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Queue Depth</span>
              <span className={styles.statValue}>{queueStats.depth}</span>
              <span className={styles.statMeta}>
                <span>{queueStats.pending} pending</span>
                <span>•</span>
                <span>{queueStats.processing} in-flight</span>
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
                    Providers Exhausted
                  </Badge>
                ) : (
                  <span>Auto-resumes on recovery</span>
                )}
              </span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total Executions</span>
              <span className={styles.statValue}>{queueStats.completed + queueStats.failed}</span>
              <span className={styles.statMeta}>
                <span style={{ color: 'var(--cv-success-400)' }}>
                  {queueStats.completed} completed
                </span>
                <span>•</span>
                <span style={{ color: 'var(--cv-danger-400)' }}>{queueStats.failed} failed</span>
              </span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Active Providers</span>
              <span className={styles.statValue}>
                {providers.filter((p) => p.status === 'HEALTHY').length}
                <span style={{ fontSize: '1rem', color: 'var(--cv-text-muted)' }}>
                  /{providers.length}
                </span>
              </span>
              <span className={styles.statMeta}>
                <span>
                  {providers.filter((p) => p.status === 'DISABLED').length} disabled in {pool}
                </span>
              </span>
            </div>
          </div>

          {/* Provider List & Priority Reorder */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span>⚙️</span>
                <span>Provider Routing Hierarchy ({pool} Pool)</span>
              </h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--cv-text-muted)' }}>
                Sorted by priority (lowest number evaluated first). Disabled providers are skipped.
              </span>
            </div>

            {providers.length === 0 ? (
              <EmptyState
                title={`No providers configured in ${pool} pool`}
                description="Add an external LLM provider adapter to activate generative pipelines."
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
                    Add First Provider
                  </Button>
                }
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
                        <th className={styles.th}>Failures</th>
                        <th className={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.map((p) => (
                        <tr key={p.id || p.code} className={styles.tr}>
                          {/* Priority */}
                          <td className={styles.td}>
                            <div className={styles.priorityCell}>
                              <span className={styles.priorityBadge}>{p.priority}</span>
                              <div className={styles.priorityButtons}>
                                <button
                                  className={styles.pBtn}
                                  title="Increase priority (evaluate earlier)"
                                  disabled={p.priority <= 1}
                                  onClick={() =>
                                    handleRequestPriorityChange(p, Math.max(1, p.priority - 1))
                                  }
                                >
                                  ▲
                                </button>
                                <button
                                  className={styles.pBtn}
                                  title="Decrease priority (evaluate later)"
                                  onClick={() => handleRequestPriorityChange(p, p.priority + 1)}
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Provider Info */}
                          <td className={styles.td}>
                            <div className={styles.providerInfo}>
                              <span className={styles.providerName}>{p.name}</span>
                              <span className={styles.providerCode}>{p.code.toUpperCase()}</span>
                            </div>
                          </td>

                          {/* Model */}
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                              {p.modelId || 'config default'}
                            </span>
                          </td>

                          {/* Key Mask */}
                          <td className={styles.td}>
                            <span className={styles.keyMask}>
                              {p.maskedApiKey || '••••••••••••'}
                            </span>
                          </td>

                          {/* Health Status */}
                          <td className={styles.td}>
                            <Badge variant={getStatusBadgeVariant(p.status)} size="sm" dot>
                              {p.status}
                            </Badge>
                          </td>

                          {/* Avg Latency */}
                          <td className={styles.td}>
                            <span style={{ fontFamily: 'monospace' }}>
                              {p.averageLatencyMs ? `${Math.round(p.averageLatencyMs)}ms` : '—'}
                            </span>
                          </td>

                          {/* Failures */}
                          <td className={styles.td}>
                            <span
                              style={{
                                color:
                                  p.consecutiveFailures > 0
                                    ? 'var(--cv-danger-400)'
                                    : 'var(--cv-text-muted)',
                                fontWeight: p.consecutiveFailures > 0 ? 700 : 400,
                              }}
                            >
                              {p.consecutiveFailures} streak ({p.totalFailures} total)
                            </span>
                          </td>

                          {/* Actions */}
                          <td className={styles.td}>
                            <div className={styles.actionGroup}>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={testingCode === p.code}
                                onClick={() => handleTestProvider(p)}
                              >
                                {testingCode === p.code ? 'Testing...' : 'Ping Test'}
                              </Button>

                              <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(p)}>
                                Edit
                              </Button>

                              {p.status === 'DISABLED' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenActionConfirm(p, 'ENABLE')}
                                >
                                  Enable
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenActionConfirm(p, 'DISABLE')}
                                >
                                  Disable
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                style={{ color: 'var(--cv-danger-400)' }}
                                onClick={() => handleOpenActionConfirm(p, 'DELETE')}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Usage & Failure Charts */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>📊</span>
              <span>Telemetry & Failure Distribution</span>
            </h2>

            <div className={styles.chartsGrid}>
              {/* Traffic Distribution */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartTitle}>Traffic Volume by Provider</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    {totalRequestsAcrossAll} Total Requests
                  </span>
                </div>

                <div className={styles.barList}>
                  {providers.map((p) => {
                    const pct =
                      totalRequestsAcrossAll > 0
                        ? Math.round((p.totalRequests / totalRequestsAcrossAll) * 100)
                        : 0;
                    return (
                      <div key={p.id || p.code} className={styles.barItem}>
                        <div className={styles.barMeta}>
                          <span className={styles.barName}>{p.name}</span>
                          <span className={styles.barValue}>
                            {p.totalRequests} reqs ({pct}%)
                          </span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${styles.barPrimary}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Failure Breakdown */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartTitle}>Error Rate & Circuit Status</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    {totalFailuresAcrossAll} Total Errors
                  </span>
                </div>

                <div className={styles.barList}>
                  {providers.map((p) => {
                    const errorPct =
                      p.totalRequests > 0
                        ? Math.min(100, Math.round((p.totalFailures / p.totalRequests) * 100))
                        : 0;
                    return (
                      <div key={p.id || p.code} className={styles.barItem}>
                        <div className={styles.barMeta}>
                          <span className={styles.barName}>
                            {p.name} ({p.status})
                          </span>
                          <span
                            className={styles.barValue}
                            style={{
                              color: errorPct > 10 ? 'var(--cv-danger-400)' : 'inherit',
                            }}
                          >
                            {p.totalFailures} errors ({errorPct}%)
                          </span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${errorPct > 25 ? styles.barDanger : styles.barCyan}`}
                            style={{ width: `${Math.max(2, errorPct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ADD PROVIDER MODAL */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register AI Provider Adapter"
        description={`Securely add and configure an external LLM provider in the ${pool} pool.`}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Provider Platform</label>
              <select
                className={styles.select}
                value={addForm.code}
                onChange={(e) => {
                  const code = e.target.value as AIProvider;
                  setAddForm((prev) => ({
                    ...prev,
                    code,
                    name:
                      code === 'gemini'
                        ? 'Google Gemini Pro'
                        : code === 'openai'
                          ? 'OpenAI GPT-4o'
                          : 'Groq LPU Engine',
                    modelId:
                      code === 'gemini'
                        ? 'gemini-1.5-pro'
                        : code === 'openai'
                          ? 'gpt-4o-mini'
                          : 'llama-3.3-70b-versatile',
                  }));
                }}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq Cloud</option>
              </select>
            </div>

            <Input
              label="Display Name"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGrid}>
            <Input
              label="Priority (1 = Highest)"
              type="number"
              min={1}
              max={100}
              value={addForm.priority}
              onChange={(e) => setAddForm({ ...addForm, priority: Number(e.target.value) })}
              required
            />

            <Input
              label="Model ID"
              value={addForm.modelId || ''}
              onChange={(e) => setAddForm({ ...addForm, modelId: e.target.value })}
              helperText="e.g. gemini-1.5-pro, gpt-4o-mini, llama-3.3-70b-versatile"
            />
          </div>

          <div className={styles.formGroup}>
            <Input
              label="Provider API Key"
              type="password"
              value={addForm.apiKey || ''}
              onChange={(e) => setAddForm({ ...addForm, apiKey: e.target.value })}
              helperText="Encrypted with AES-256-GCM before database storage. Plaintext is never logged or returned."
              placeholder="sk-..."
            />
          </div>

          <div className={styles.formGrid}>
            <Input
              label="Rate Limit (RPM)"
              type="number"
              min={1}
              value={addForm.rateLimitRpm || 60}
              onChange={(e) => setAddForm({ ...addForm, rateLimitRpm: Number(e.target.value) })}
            />

            <Input
              label="Daily Request Limit"
              type="number"
              min={1}
              value={addForm.dailyLimit || 5000}
              onChange={(e) => setAddForm({ ...addForm, dailyLimit: Number(e.target.value) })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Audit Reason (Mandatory)</label>
            <textarea
              className={styles.textarea}
              placeholder="Why are you registering this provider adapter?"
              value={addForm.reason}
              onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
              required
            />
            <span className={styles.formHint}>
              Every change records an append-only audit trail in accordance with CorpVerse
              governance.
            </span>
          </div>

          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingAction}>
              Save Provider
            </Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* EDIT PROVIDER MODAL */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit ${selectedProvider?.name || 'Provider'}`}
        description="Update routing priority, rate limits, or replace stored credentials."
        size="md"
      >
        <form onSubmit={handleEditSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <Input
              label="Priority"
              type="number"
              min={1}
              max={100}
              value={editForm.priority || 1}
              onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
              required
            />

            <Input
              label="Model ID"
              value={editForm.modelId || ''}
              onChange={(e) => setEditForm({ ...editForm, modelId: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <Input
              label="Update API Key (Leave empty to keep existing)"
              type="password"
              value={editForm.apiKey || ''}
              onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
              placeholder={selectedProvider?.maskedApiKey || 'Current key encrypted'}
            />
          </div>

          <div className={styles.formGrid}>
            <Input
              label="Rate Limit (RPM)"
              type="number"
              min={1}
              value={editForm.rateLimitRpm || 60}
              onChange={(e) => setEditForm({ ...editForm, rateLimitRpm: Number(e.target.value) })}
            />

            <Input
              label="Daily Limit"
              type="number"
              min={1}
              value={editForm.dailyLimit || 5000}
              onChange={(e) => setEditForm({ ...editForm, dailyLimit: Number(e.target.value) })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Audit Reason (Mandatory)</label>
            <textarea
              className={styles.textarea}
              placeholder="Reason for modifying this provider configuration..."
              value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              required
            />
          </div>

          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingAction}>
              Apply Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* CONFIRM ACTION MODAL */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={
          confirmAction === 'DELETE'
            ? 'Confirm Provider Deletion'
            : confirmAction === 'DISABLE'
              ? 'Disable Provider'
              : confirmAction === 'ENABLE'
                ? 'Enable Provider'
                : 'Confirm Priority Reorder'
        }
        description={
          confirmAction === 'DELETE'
            ? `Are you sure you want to permanently remove ${selectedProvider?.name}? This action cannot be undone.`
            : `Confirm state change for ${selectedProvider?.name} in pool ${selectedProvider?.pool}.`
        }
        size="sm"
      >
        <div className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Audit Reason (Mandatory)</label>
            <textarea
              className={styles.textarea}
              placeholder="State the reason for this action for compliance audit logs..."
              value={confirmReason}
              onChange={(e) => setConfirmReason(e.target.value)}
              required
            />
          </div>

          <div className={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'DELETE' ? 'danger' : 'primary'}
              onClick={handleExecuteConfirmedAction}
              loading={isSubmittingAction}
            >
              Confirm Action
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* TEST RESULT MODAL */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isTestResultOpen}
        onClose={() => setIsTestResultOpen(false)}
        title="Diagnostic Health Ping Result"
        description="Live zero-token connectivity verification with upstream provider."
        size="sm"
      >
        {testResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: 'var(--cv-radius-md)',
                background: testResult.success
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {testResult.success ? 'HEALTHY' : 'UNHEALTHY'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--cv-text-secondary)' }}>
                  Round-trip latency: {testResult.latencyMs}ms
                </div>
              </div>
              <Badge variant={testResult.success ? 'success' : 'danger'}>{testResult.status}</Badge>
            </div>

            {testResult.errorMessage && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--cv-radius-sm)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--cv-danger-400)',
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                }}
              >
                {testResult.errorMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="primary" onClick={() => setIsTestResultOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AiManagerPage;
