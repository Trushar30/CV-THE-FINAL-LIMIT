import React, { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  type AdminUserListItem,
  type AdminUserAnalytics,
  type AdminApplicationAnalytics,
  type AdminTaskAnalytics,
  type AdminEconomyAnalytics,
  type AdminCompanyAnalytics,
  type AdminAiAnalytics,
  type AuditLogItem,
  type AiQueueItem,
  type AdminCompanyItem,
  type AdminJobItem,
} from '../../api/admin';
import { useToast } from '../../components/ui/Toast/ToastContext';
import { Button, Spinner, Badge } from '../../components/ui';
import { TypedConfirmationModal } from '../../components/admin/TypedConfirmationModal';
import styles from './AdminConsole.module.css';

type AdminTab = 'USERS' | 'CONFIG' | 'COMPANIES_JOBS' | 'ANALYTICS' | 'AUDIT' | 'QUEUE' | 'ECONOMY';

const CONFIG_SECTIONS = [
  { id: 'founder', label: 'Founder & Startup' },
  { id: 'employee', label: 'Employee Tasks & Warnings' },
  { id: 'company', label: 'Company Limits & Bankruptcy' },
  { id: 'applications', label: 'Applications & Quotas' },
  { id: 'ai', label: 'AI Gateway & Pools' },
  { id: 'career', label: 'Career Domains & Levels' },
  { id: 'bots', label: 'AI Bot Pricing' },
  { id: 'ats', label: 'ATS Screening Scoring' },
  { id: 'security', label: 'Security & Auth Windows' },
];

export const AdminConsolePage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');

  // =========================================================================
  // 1. Users Management State
  // =========================================================================
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Edit / Suspend / Delete Modal states
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editCareerRole, setEditCareerRole] = useState('');
  const [editPlatformRole, setEditPlatformRole] = useState('');
  const [editReason, setEditReason] = useState('');

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // =========================================================================
  // 2. PlatformConfig Editor State
  // =========================================================================
  const [selectedConfigSection, setSelectedConfigSection] = useState('founder');
  const [configJsonText, setConfigJsonText] = useState('');
  const [configReason, setConfigReason] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // =========================================================================
  // 3. Companies & Jobs State
  // =========================================================================
  const [companies, setCompanies] = useState<AdminCompanyItem[]>([]);
  const [jobs, setJobs] = useState<AdminJobItem[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<AdminCompanyItem | null>(null);
  const [deleteCompModalOpen, setDeleteCompModalOpen] = useState(false);

  // =========================================================================
  // 4. Analytics State
  // =========================================================================
  const [analyticsDays, setAnalyticsDays] = useState<'7' | '30' | '90'>('30');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [userAnalytics, setUserAnalytics] = useState<AdminUserAnalytics | null>(null);
  const [appAnalytics, setAppAnalytics] = useState<AdminApplicationAnalytics | null>(null);
  const [taskAnalytics, setTaskAnalytics] = useState<AdminTaskAnalytics | null>(null);
  const [econAnalytics, setEconAnalytics] = useState<AdminEconomyAnalytics | null>(null);
  const [compAnalytics, setCompAnalytics] = useState<AdminCompanyAnalytics | null>(null);
  const [aiAnalytics, setAiAnalytics] = useState<AdminAiAnalytics | null>(null);

  // =========================================================================
  // 5. Audit Log Viewer State
  // =========================================================================
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [inspectAuditLog, setInspectAuditLog] = useState<AuditLogItem | null>(null);

  // =========================================================================
  // 6. AI Queue Viewer State
  // =========================================================================
  const [aiQueueJobs, setAiQueueJobs] = useState<AiQueueItem[]>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [queueStatusFilter, setQueueStatusFilter] = useState('');
  const [queueLoading, setQueueLoading] = useState(false);

  // =========================================================================
  // 7. Economy Reset State
  // =========================================================================
  const [econResetScope, setEconResetScope] = useState<'ALL' | 'USER'>('ALL');
  const [econTargetUserId, setEconTargetUserId] = useState('');
  const [resetEconModalOpen, setResetEconModalOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch Functions
  // -------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await adminApi.listUsers({
        page: userPage,
        limit: 15,
        search: userSearch.trim() || undefined,
        careerRole: userRoleFilter || undefined,
        status: userStatusFilter || undefined,
      });
      setUsers(res.users);
      setUserTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userSearch, userRoleFilter, userStatusFilter, toastError]);

  const fetchConfigSection = useCallback(async (section: string) => {
    setConfigLoading(true);
    try {
      const res = await adminApi.getConfigSection(section);
      setConfigJsonText(JSON.stringify(res, null, 2));
      setConfigReason('');
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to load config section');
    } finally {
      setConfigLoading(false);
    }
  }, [toastError]);

  const fetchCompaniesAndJobs = useCallback(async () => {
    setCompLoading(true);
    try {
      const [cRes, jRes] = await Promise.all([
        adminApi.getCompanies({ limit: 50 }),
        adminApi.getJobs({ limit: 50 }),
      ]);
      setCompanies(cRes);
      setJobs(jRes);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to load companies & jobs');
    } finally {
      setCompLoading(false);
    }
  }, [toastError]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - Number(analyticsDays) * 24 * 60 * 60 * 1000);
    const query = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };

    try {
      const [u, a, t, e, c, ai] = await Promise.all([
        adminApi.getUserAnalytics(query),
        adminApi.getApplicationAnalytics(query),
        adminApi.getTaskAnalytics(query),
        adminApi.getEconomyAnalytics(query),
        adminApi.getCompanyAnalytics(query),
        adminApi.getAiAnalytics(query),
      ]);
      setUserAnalytics(u);
      setAppAnalytics(a);
      setTaskAnalytics(t);
      setEconAnalytics(e);
      setCompAnalytics(c);
      setAiAnalytics(ai);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDays, toastError]);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await adminApi.getAuditLogs({
        page: auditPage,
        limit: 15,
        action: auditActionFilter || undefined,
      });
      setAuditLogs(res.logs);
      setAuditTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditActionFilter, toastError]);

  const fetchAiQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await adminApi.getAiQueue({
        page: queuePage,
        limit: 15,
        status: queueStatusFilter || undefined,
      });
      setAiQueueJobs(res.jobs);
      setQueueTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setQueueLoading(false);
    }
  }, [queuePage, queueStatusFilter, toastError]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'USERS') fetchUsers();
    else if (activeTab === 'CONFIG') fetchConfigSection(selectedConfigSection);
    else if (activeTab === 'COMPANIES_JOBS') fetchCompaniesAndJobs();
    else if (activeTab === 'ANALYTICS') fetchAnalytics();
    else if (activeTab === 'AUDIT') fetchAuditLogs();
    else if (activeTab === 'QUEUE') fetchAiQueue();
  }, [activeTab, fetchUsers, fetchConfigSection, selectedConfigSection, fetchCompaniesAndJobs, fetchAnalytics, fetchAuditLogs, fetchAiQueue]);

  // -------------------------------------------------------------------------
  // Handlers for User Actions
  // -------------------------------------------------------------------------
  const handleOpenEditUser = (u: AdminUserListItem) => {
    setSelectedUser(u);
    setEditDisplayName(u.profile?.displayName || '');
    setEditCareerRole(u.careerRole);
    setEditPlatformRole(u.platformRole);
    setEditReason('');
    setEditUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    if (editReason.trim().length < 10) {
      toastError('Mandatory justification reason must be at least 10 characters');
      return;
    }
    setActionLoading(true);
    try {
      await adminApi.updateUser(selectedUser._id, {
        displayName: editDisplayName.trim() || undefined,
        careerRole: editCareerRole || undefined,
        platformRole: editPlatformRole || undefined,
        reason: editReason.trim(),
      });
      toastSuccess(`User ${selectedUser.email} updated successfully`);
      setEditUserModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSuspend = async (u: AdminUserListItem) => {
    setSelectedUser(u);
    setSuspendReason('');
    setSuspendModalOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!selectedUser) return;
    if (suspendReason.trim().length < 10) {
      toastError('Reason must be at least 10 characters');
      return;
    }
    setActionLoading(true);
    try {
      if (selectedUser.isSuspended || selectedUser.status === 'SUSPENDED') {
        await adminApi.restoreUser(selectedUser._id, suspendReason.trim());
        toastSuccess(`User ${selectedUser.email} restored successfully`);
      } else {
        await adminApi.suspendUser(selectedUser._id, suspendReason.trim());
        toastSuccess(`User ${selectedUser.email} suspended`);
      }
      setSuspendModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Suspension action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteUser = async (reason: string) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await adminApi.deleteUser(selectedUser._id, 'CONFIRM_DELETE_USER', reason);
      toastSuccess(`User account ${selectedUser.email} deleted`);
      setDeleteUserModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers for PlatformConfig
  // -------------------------------------------------------------------------
  const handleSaveConfigSection = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJsonText);
    } catch {
      toastError('Invalid JSON format. Please correct syntax before submitting.');
      return;
    }
    if (configReason.trim().length < 10) {
      toastError('Audit justification reason must be at least 10 characters.');
      return;
    }
    setConfigSaving(true);
    try {
      await adminApi.updateConfigSection(selectedConfigSection, parsed, configReason.trim());
      toastSuccess(`Section "${selectedConfigSection}" updated and version bumped.`);
      fetchConfigSection(selectedConfigSection);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Config section update rejected');
    } finally {
      setConfigSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers for Companies & Jobs
  // -------------------------------------------------------------------------
  const handleConfirmDeleteCompany = async (reason: string) => {
    if (!selectedCompany) return;
    setActionLoading(true);
    try {
      await adminApi.deleteCompany(selectedCompany._id, 'CONFIRM_DELETE_COMPANY', reason);
      toastSuccess(`Company ${selectedCompany.name} deleted and employees released.`);
      setDeleteCompModalOpen(false);
      fetchCompaniesAndJobs();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete company');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleJobStatus = async (job: AdminJobItem) => {
    const nextStatus = job.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      await adminApi.updateJob(job._id, {
        status: nextStatus,
        reason: `Admin toggled job status to ${nextStatus}`,
      });
      toastSuccess(`Job posting marked as ${nextStatus}`);
      fetchCompaniesAndJobs();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Job update failed');
    }
  };

  // -------------------------------------------------------------------------
  // Handlers for Economy Reset
  // -------------------------------------------------------------------------
  const handleConfirmResetEconomy = async (reason: string) => {
    setActionLoading(true);
    try {
      await adminApi.resetEconomy({
        confirmation: 'CONFIRM_RESET_ECONOMY',
        scope: econResetScope,
        targetUserId: econResetScope === 'USER' ? econTargetUserId.trim() : undefined,
        reason,
      });
      toastSuccess(`Economy reset executed (${econResetScope} scope)`);
      setResetEconModalOpen(false);
      if (activeTab === 'USERS') fetchUsers();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Economy reset rejected');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={styles.adminContainer} data-testid="admin-console-page">
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitles}>
          <h1>Platform Administration</h1>
          <p>Authoritative system governance, telemetry metrics, and immutable audit logs.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNavigation}>
        {(
          [
            { id: 'USERS', label: 'Users Roster' },
            { id: 'CONFIG', label: 'Config Editor' },
            { id: 'COMPANIES_JOBS', label: 'Companies & Jobs' },
            { id: 'ANALYTICS', label: 'Analytics Dashboard' },
            { id: 'AUDIT', label: 'Audit Log Explorer' },
            { id: 'QUEUE', label: 'AI Background Queue' },
            { id: 'ECONOMY', label: 'Economy Reset' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.navTab} ${activeTab === t.id ? styles.navTabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
            data-testid={`admin-nav-${t.id.toLowerCase()}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: USERS ROSTER
          ===================================================================== */}
      {activeTab === 'USERS' && (
        <div className={styles.contentCard} data-testid="admin-users-section">
          <div className={styles.cardHeader}>
            <h3>User Accounts & Identities</h3>
            <div className={styles.filterControls}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search email or display name..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                data-testid="admin-user-search-input"
              />
              <select
                className={styles.selectControl}
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUserPage(1);
                }}
                data-testid="admin-user-role-filter"
              >
                <option value="">All Career Roles</option>
                <option value="JOB_SEEKER">Job Seeker</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="FOUNDER">Founder</option>
                <option value="NONE">None</option>
              </select>
              <select
                className={styles.selectControl}
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setUserPage(1);
                }}
                data-testid="admin-user-status-filter"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          {usersLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>User / Email</th>
                    <th>Career Role</th>
                    <th>Platform Role</th>
                    <th>Level & EXP</th>
                    <th>CorpCoin</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} data-testid={`user-row-${u._id}`}>
                      <td>
                        <strong>{u.profile?.displayName || 'Unnamed'}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                      </td>
                      <td>
                        <Badge variant="cyan" size="sm">
                          {u.careerRole}
                        </Badge>
                      </td>
                      <td>
                        <Badge variant={u.platformRole === 'ADMIN' ? 'gold' : 'default'} size="sm">
                          {u.platformRole}
                        </Badge>
                      </td>
                      <td>{u.totalExpCached?.toLocaleString()} EXP</td>
                      <td>{u.corpCoinBalanceCached?.toLocaleString()} CC</td>
                      <td>
                        <Badge
                          variant={u.isSuspended || u.status === 'SUSPENDED' ? 'danger' : 'success'}
                          size="sm"
                        >
                          {u.isSuspended ? 'SUSPENDED' : u.status}
                        </Badge>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => handleOpenEditUser(u)}
                            data-testid={`edit-user-btn-${u._id}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => handleToggleSuspend(u)}
                            data-testid={`suspend-user-btn-${u._id}`}
                          >
                            {u.isSuspended ? 'Restore' : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                            onClick={() => {
                              setSelectedUser(u);
                              setDeleteUserModalOpen(true);
                            }}
                            data-testid={`delete-user-btn-${u._id}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* User Pagination */}
          <div className={styles.paginationBar}>
            <span className={styles.paginationInfo}>Page {userPage} of {userTotalPages}</span>
            <div className={styles.paginationButtons}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                disabled={userPage <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                disabled={userPage >= userTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: CONFIG EDITOR
          ===================================================================== */}
      {activeTab === 'CONFIG' && (
        <div className={styles.contentCard} data-testid="admin-config-section">
          <div className={styles.cardHeader}>
            <h3>PlatformConfig Section Editor</h3>
            <div className={styles.filterControls}>
              <select
                className={styles.selectControl}
                value={selectedConfigSection}
                onChange={(e) => {
                  setSelectedConfigSection(e.target.value);
                  fetchConfigSection(e.target.value);
                }}
                data-testid="config-section-select"
              >
                {CONFIG_SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {configLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea
                className={styles.jsonEditorArea}
                value={configJsonText}
                onChange={(e) => setConfigJsonText(e.target.value)}
                placeholder="Editable JSON section configuration..."
                data-testid="config-json-textarea"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                  Mandatory Audit Justification Reason (min 10 characters)
                </label>
                <input
                  type="text"
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                  placeholder="Reason for modifying this configuration section..."
                  value={configReason}
                  onChange={(e) => setConfigReason(e.target.value)}
                  data-testid="config-reason-input"
                />
              </div>
              <div>
                <Button
                  variant="primary"
                  onClick={handleSaveConfigSection}
                  disabled={configSaving || configReason.trim().length < 10}
                >
                  {configSaving ? 'Saving...' : 'Patch Config Section & Bump Version'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: COMPANIES & JOBS
          ===================================================================== */}
      {activeTab === 'COMPANIES_JOBS' && (
        <div className={styles.contentCard} data-testid="admin-companies-jobs-section">
          <div className={styles.cardHeader}>
            <h3>Corporate Entities & Job Postings</h3>
            <Button variant="secondary" size="sm" onClick={fetchCompaniesAndJobs} disabled={compLoading}>
              ↻ Refresh
            </Button>
          </div>

          {compLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <>
              <h4>Companies Roster</h4>
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Type</th>
                      <th>Workforce</th>
                      <th>Rating</th>
                      <th>Financial Health</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c._id} data-testid={`company-row-${c._id}`}>
                        <td>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {c.domainsHired?.join(', ')}
                          </div>
                        </td>
                        <td>
                          <Badge variant={c.type === 'PLATFORM' ? 'gold' : 'cyan'} size="sm">
                            {c.type}
                          </Badge>
                        </td>
                        <td>{c.employeeCount} / {c.maxEmployees}</td>
                        <td>★ {c.companyRating?.toFixed(1) || '0.0'}</td>
                        <td style={{ color: c.financialHealth < 0 ? '#ef4444' : '#10b981' }}>
                          {c.financialHealth}
                        </td>
                        <td>
                          <Badge variant={c.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                            {c.status}
                          </Badge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                            onClick={() => {
                              setSelectedCompany(c);
                              setDeleteCompModalOpen(true);
                            }}
                            data-testid={`delete-company-btn-${c._id}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{ marginTop: '24px' }}>Open & Closed Job Requisitions</h4>
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Domain</th>
                      <th>Level Range</th>
                      <th>Openings</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j._id} data-testid={`job-row-${j._id}`}>
                        <td>
                          <strong>{j.title}</strong>
                        </td>
                        <td>
                          <Badge variant="default" size="sm">
                            {j.domain}
                          </Badge>
                        </td>
                        <td>L{j.minLevel} - L{j.maxLevel}</td>
                        <td>{j.openings}</td>
                        <td>
                          <Badge variant={j.status === 'OPEN' ? 'success' : 'default'} size="sm">
                            {j.status}
                          </Badge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => handleToggleJobStatus(j)}
                            data-testid={`toggle-job-btn-${j._id}`}
                          >
                            {j.status === 'OPEN' ? 'Close Job' : 'Open Job'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: ANALYTICS DASHBOARD
          ===================================================================== */}
      {activeTab === 'ANALYTICS' && (
        <div className={styles.contentCard} data-testid="admin-analytics-section">
          <div className={styles.cardHeader}>
            <h3>Bounded Analytics & Telemetry</h3>
            <div className={styles.filterControls}>
              <span>Window:</span>
              {(['7', '30', '90'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.actionButton} ${analyticsDays === d ? styles.navTabActive : ''}`}
                  onClick={() => setAnalyticsDays(d)}
                  data-testid={`analytics-days-${d}`}
                >
                  Past {d} Days
                </button>
              ))}
            </div>
          </div>

          {analyticsLoading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Spinner size="lg" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* KPIs Grid */}
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Total Users</span>
                  <span className={styles.kpiValue}>{userAnalytics?.totals.totalUsers || 0}</span>
                  <span className={styles.kpiSub}>
                    {userAnalytics?.totals.activeUsers || 0} active • {userAnalytics?.totals.suspendedUsers || 0} suspended
                  </span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Job Applications</span>
                  <span className={styles.kpiValue}>{appAnalytics?.totalApplications || 0}</span>
                  <span className={styles.kpiSub}>Funnel submissions</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Tasks Submitted</span>
                  <span className={styles.kpiValue}>{taskAnalytics?.totalSubmissions || 0}</span>
                  <span className={styles.kpiSub}>
                    Avg Score: {taskAnalytics?.averageScore || 0}%
                  </span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>EXP in Circulation</span>
                  <span className={styles.kpiValue} style={{ color: '#a78bfa' }}>
                    {econAnalytics?.circulation?.totalExpCirculation?.toLocaleString() || 0}
                  </span>
                  <span className={styles.kpiSub}>Lifetime talent progress</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>CorpCoin in Circulation</span>
                  <span className={styles.kpiValue} style={{ color: '#fbbf24' }}>
                    {econAnalytics?.circulation?.totalCorpCoinCirculation?.toLocaleString() || 0} CC
                  </span>
                  <span className={styles.kpiSub}>Liquid economy balance</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>AI Avg Latency</span>
                  <span className={styles.kpiValue} style={{ color: '#38bdf8' }}>
                    {aiAnalytics?.telemetry?.avgLatencyMs || 0} ms
                  </span>
                  <span className={styles.kpiSub}>
                    Failure Rate: {aiAnalytics?.telemetry?.failureRate || 0}%
                  </span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Active Workforce</span>
                  <span className={styles.kpiValue} style={{ color: '#10b981' }}>
                    {compAnalytics?.totalActiveWorkforce || 0}
                  </span>
                  <span className={styles.kpiSub}>
                    Net Profit: {compAnalytics?.financialOutcomes?.totalProfit?.toLocaleString() || 0} CC
                  </span>
                </div>
              </div>

              {/* Task Score Bands */}
              <div className={styles.distSection}>
                <h4>Task Performance Score Bands (Spec Section 11/12)</h4>
                {taskAnalytics?.byScoreBand?.map((b) => (
                  <div key={b.band} className={styles.distBarWrapper}>
                    <div className={styles.distBarHeader}>
                      <span>{b.band}</span>
                      <strong>{b.count} submissions</strong>
                    </div>
                    <div className={styles.distBarTrack}>
                      <div
                        className={styles.distBarFill}
                        style={{
                          width: `${Math.min(100, (b.count / (taskAnalytics.totalSubmissions || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Application Funnel Breakdown */}
              <div className={styles.distSection}>
                <h4>Application Pipeline Funnel Stages</h4>
                {appAnalytics?.byStage?.map((s) => (
                  <div key={s.stage} className={styles.distBarWrapper}>
                    <div className={styles.distBarHeader}>
                      <span>{s.stage}</span>
                      <strong>{s.count} candidates</strong>
                    </div>
                    <div className={styles.distBarTrack}>
                      <div
                        className={styles.distBarFill}
                        style={{
                          background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                          width: `${Math.min(100, (s.count / (appAnalytics.totalApplications || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: AUDIT LOG EXPLORER
          ===================================================================== */}
      {activeTab === 'AUDIT' && (
        <div className={styles.contentCard} data-testid="admin-audit-section">
          <div className={styles.cardHeader}>
            <h3>Append-Only Audit Log Explorer</h3>
            <div className={styles.filterControls}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Filter by action name (e.g. USER_SUSPENDED)..."
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(1);
                }}
                data-testid="audit-action-filter-input"
              />
            </div>
          </div>

          {auditLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Target Type</th>
                    <th>Justification Reason</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id} data-testid={`audit-row-${log._id}`}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        <Badge variant="cyan" size="sm">
                          {log.actorRole}
                        </Badge>
                      </td>
                      <td>
                        <strong>{log.action}</strong>
                      </td>
                      <td>{log.targetType}</td>
                      <td>{log.reason}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => setInspectAuditLog(log)}
                        >
                          Inspect Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.paginationBar}>
            <span className={styles.paginationInfo}>Page {auditPage} of {auditTotalPages}</span>
            <div className={styles.paginationButtons}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                disabled={auditPage >= auditTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: AI BACKGROUND QUEUE
          ===================================================================== */}
      {activeTab === 'QUEUE' && (
        <div className={styles.contentCard} data-testid="admin-queue-section">
          <div className={styles.cardHeader}>
            <h3>AI Background Execution Queue</h3>
            <div className={styles.filterControls}>
              <select
                className={styles.selectControl}
                value={queueStatusFilter}
                onChange={(e) => {
                  setQueueStatusFilter(e.target.value);
                  setQueuePage(1);
                }}
                data-testid="queue-status-filter"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="WAITING_FOR_PROVIDER">WAITING_FOR_PROVIDER</option>
                <option value="FAILED">FAILED</option>
              </select>
              <Button variant="secondary" size="sm" onClick={fetchAiQueue} disabled={queueLoading}>
                ↻ Refresh
              </Button>
            </div>
          </div>

          {queueLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Task Type</th>
                    <th>Pool</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {aiQueueJobs.map((j) => (
                    <tr key={j._id} data-testid={`queue-row-${j._id}`}>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                          {j._id.slice(-8)}
                        </span>
                      </td>
                      <td>
                        <strong>{j.taskType}</strong>
                      </td>
                      <td>
                        <Badge variant={j.pool === 'PIPELINE' ? 'cyan' : 'default'} size="sm">
                          {j.pool}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          variant={
                            j.status === 'COMPLETED'
                              ? 'success'
                              : j.status === 'FAILED'
                              ? 'danger'
                              : j.status === 'PROCESSING'
                              ? 'gold'
                              : 'cyan'
                          }
                          size="sm"
                        >
                          {j.status}
                        </Badge>
                      </td>
                      <td>{j.attempts}</td>
                      <td>{new Date(j.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.paginationBar}>
            <span className={styles.paginationInfo}>Page {queuePage} of {queueTotalPages}</span>
            <div className={styles.paginationButtons}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                disabled={queuePage <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
                disabled={queuePage >= queueTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: ECONOMY RESET
          ===================================================================== */}
      {activeTab === 'ECONOMY' && (
        <div className={styles.contentCard} data-testid="admin-economy-section">
          <div className={styles.cardHeader}>
            <h3 style={{ color: '#ef4444' }}>Dangerous Economy Reset Tool</h3>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.5 }}>
            Resetting the economy zeroes out accumulated EXP and CorpCoin balances. This operation writes
            immutable audit logs and requires a strict typed confirmation safety challenge.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Scope</label>
              <select
                className={styles.selectControl}
                value={econResetScope}
                onChange={(e) => setEconResetScope(e.target.value as 'ALL' | 'USER')}
                data-testid="economy-reset-scope-select"
              >
                <option value="ALL">Global (All Users & Entities)</option>
                <option value="USER">Targeted User ID</option>
              </select>
            </div>

            {econResetScope === 'USER' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Target User ID</label>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="24-char MongoDB ObjectId..."
                  value={econTargetUserId}
                  onChange={(e) => setEconTargetUserId(e.target.value)}
                  data-testid="economy-target-user-input"
                />
              </div>
            )}

            <div>
              <Button
                variant="danger"
                onClick={() => setResetEconModalOpen(true)}
                data-testid="trigger-reset-economy-btn"
              >
                Launch Economy Reset Challenge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS & CHALLENGES
          ===================================================================== */}

      {/* 1. Edit User Modal */}
      {editUserModalOpen && selectedUser && (
        <div className={styles.modalOverlay || ''} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>Edit User: {selectedUser.email}</h3>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Display Name</label>
              <input
                type="text"
                className={styles.searchInput}
                style={{ width: '100%' }}
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Career Role</label>
              <select
                className={styles.selectControl}
                style={{ width: '100%' }}
                value={editCareerRole}
                onChange={(e) => setEditCareerRole(e.target.value)}
              >
                <option value="JOB_SEEKER">JOB_SEEKER</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="FOUNDER">FOUNDER</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Platform Role</label>
              <select
                className={styles.selectControl}
                style={{ width: '100%' }}
                value={editPlatformRole}
                onChange={(e) => setEditPlatformRole(e.target.value)}
              >
                <option value="NONE">NONE</option>
                <option value="ADMIN">ADMIN</option>
                <option value="AI_MANAGER">AI_MANAGER</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Mandatory Justification Reason (min 10 chars)</label>
              <input
                type="text"
                className={styles.searchInput}
                style={{ width: '100%' }}
                placeholder="Reason for modifying this user..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setEditUserModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveUser} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Suspend / Restore Modal */}
      {suspendModalOpen && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>
              {selectedUser.isSuspended ? 'Restore' : 'Suspend'} User Account: {selectedUser.email}
            </h3>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Mandatory Justification Reason (min 10 chars)</label>
              <input
                type="text"
                className={styles.searchInput}
                style={{ width: '100%' }}
                placeholder="Audit reason for account suspension/restoration..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setSuspendModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={selectedUser.isSuspended ? 'primary' : 'danger'}
                onClick={handleConfirmSuspend}
                disabled={actionLoading || suspendReason.trim().length < 10}
              >
                {actionLoading ? 'Processing...' : selectedUser.isSuspended ? 'Restore Account' : 'Suspend Account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Delete User Typed Confirmation Modal */}
      <TypedConfirmationModal
        isOpen={deleteUserModalOpen}
        onClose={() => setDeleteUserModalOpen(false)}
        onConfirm={handleConfirmDeleteUser}
        title={`Delete User: ${selectedUser?.email || ''}`}
        description="Permanently deletes user identity, profile, and active tokens. This action is irreversible."
        expectedToken="CONFIRM_DELETE_USER"
        confirmButtonText="Delete Account"
        loading={actionLoading}
      />

      {/* 4. Delete Company Typed Confirmation Modal */}
      <TypedConfirmationModal
        isOpen={deleteCompModalOpen}
        onClose={() => setDeleteCompModalOpen(false)}
        onConfirm={handleConfirmDeleteCompany}
        title={`Delete Company: ${selectedCompany?.name || ''}`}
        description="Marks company suspended, closes all jobs, and releases all active employees back to JOB_SEEKER."
        expectedToken="CONFIRM_DELETE_COMPANY"
        confirmButtonText="Delete Company"
        loading={actionLoading}
      />

      {/* 5. Reset Economy Typed Confirmation Modal */}
      <TypedConfirmationModal
        isOpen={resetEconModalOpen}
        onClose={() => setResetEconModalOpen(false)}
        onConfirm={handleConfirmResetEconomy}
        title="Zero Out Economic Balances"
        description={`This will reset EXP and CorpCoin balances to 0 (${econResetScope} scope). Cannot be undone.`}
        expectedToken="CONFIRM_RESET_ECONOMY"
        confirmButtonText="Execute Economy Reset"
        loading={actionLoading}
      />

      {/* 6. Inspect Audit Log Diff Modal */}
      {inspectAuditLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>Audit Diff: {inspectAuditLog.action}</h3>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Justification Reason</div>
              <div style={{ color: '#ffffff', fontSize: '14px', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px' }}>
                {inspectAuditLog.reason}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>State Diff (Previous vs New)</div>
              <pre style={{ background: '#020617', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#38bdf8', overflowX: 'auto', maxHeight: '240px' }}>
                {JSON.stringify({ previousState: inspectAuditLog.previousState, newState: inspectAuditLog.newState }, null, 2)}
              </pre>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setInspectAuditLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsolePage;
