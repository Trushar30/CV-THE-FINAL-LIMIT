import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminConsolePage } from '../pages/admin/AdminConsolePage';
import { TypedConfirmationModal } from '../components/admin/TypedConfirmationModal';
import { adminApi, type AdminUserListItem } from '../api/admin';
import { ToastProvider } from '../components/ui/Toast/ToastContext';

vi.mock('../api/admin', () => ({
  adminApi: {
    listUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    suspendUser: vi.fn(),
    restoreUser: vi.fn(),
    deleteUser: vi.fn(),
    getConfigSection: vi.fn(),
    updateConfigSection: vi.fn(),
    getCompanies: vi.fn(),
    deleteCompany: vi.fn(),
    getJobs: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    getUserAnalytics: vi.fn(),
    getApplicationAnalytics: vi.fn(),
    getTaskAnalytics: vi.fn(),
    getEconomyAnalytics: vi.fn(),
    getCompanyAnalytics: vi.fn(),
    getAiAnalytics: vi.fn(),
    getAuditLogs: vi.fn(),
    getAiLogs: vi.fn(),
    getAiQueue: vi.fn(),
    resetEconomy: vi.fn(),
  },
}));

describe('TypedConfirmationModal Component (TASK P9.5)', () => {
  it('keeps confirm button disabled until challenge token and reason criteria are met', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <TypedConfirmationModal
        isOpen={true}
        title="Delete User Account"
        description="This action will permanently purge the user."
        expectedToken="CONFIRM_DELETE_USER"
        confirmButtonText="Delete User"
        onConfirm={onConfirm}
        onClose={onCancel}
      />
    );

    expect(screen.getByText('Delete User Account')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Delete User' });
    expect(confirmBtn).toBeDisabled();

    // Type incorrect token
    const tokenInput = screen.getByTestId('confirmation-token-input');
    fireEvent.change(tokenInput, { target: { value: 'CONFIRM' } });
    expect(confirmBtn).toBeDisabled();

    // Type correct token, but empty reason
    fireEvent.change(tokenInput, { target: { value: 'CONFIRM_DELETE_USER' } });
    expect(confirmBtn).toBeDisabled();

    // Type short reason (< 10 chars)
    const reasonInput = screen.getByTestId('confirmation-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'short' } });
    expect(confirmBtn).toBeDisabled();

    // Type valid reason (>= 10 chars)
    fireEvent.change(reasonInput, { target: { value: 'Valid justification for deletion' } });
    expect(confirmBtn).toBeEnabled();

    // Click confirm
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('Valid justification for deletion');
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <TypedConfirmationModal
        isOpen={true}
        title="Delete User Account"
        description="Test description"
        expectedToken="CONFIRM_DELETE_USER"
        onConfirm={onConfirm}
        onClose={onCancel}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});

const mockUsers: AdminUserListItem[] = [
  {
    _id: 'u-admin-1',
    email: 'admin@corpverse.com',
    careerRole: 'EMPLOYEE',
    platformRole: 'ADMIN',
    status: 'ACTIVE',
    isSuspended: false,
    emailVerified: true,
    totalExpCached: 16000,
    corpCoinBalanceCached: 5000,
    createdAt: '2026-10-01T10:00:00Z',
    profile: {
      displayName: 'Master Administrator',
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['TypeScript', 'Architecture'],
    },
  },
  {
    _id: 'u-user-2',
    email: 'dev@corpverse.com',
    careerRole: 'JOB_SEEKER',
    platformRole: 'NONE',
    status: 'ACTIVE',
    isSuspended: false,
    emailVerified: true,
    totalExpCached: 600,
    corpCoinBalanceCached: 100,
    createdAt: '2026-10-02T10:00:00Z',
    profile: {
      displayName: 'Candidate Dev',
      domain: 'AI_ENGINEERING',
      skills: ['Python'],
    },
  },
];

const renderAdminConsole = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AdminConsolePage />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('AdminConsolePage Frontend Suite (TASK P9.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(adminApi.listUsers).mockResolvedValue({
      users: mockUsers,
      pagination: {
        total: 2,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });

    vi.mocked(adminApi.getConfigSection).mockResolvedValue({
      section: 'founder',
      config: { starterCoins: 1000, unlockExp: 12000 },
      version: 1,
      updatedAt: '2026-10-10T12:00:00Z',
      updatedBy: 'admin',
    });

    vi.mocked(adminApi.getCompanies).mockResolvedValue([
      {
        _id: 'comp-1',
        name: 'Apex Robotics Inc',
        type: 'PLATFORM',
        status: 'ACTIVE',
        employeeCount: 12,
        maxEmployees: 20,
        companyRating: 92,
        financialHealth: 850,
        domainsHired: ['AI_ENGINEERING'],
        createdAt: '2026-10-01T10:00:00Z',
      },
    ]);

    vi.mocked(adminApi.getJobs).mockResolvedValue([
      {
        _id: 'job-1',
        companyId: 'comp-1',
        companyName: 'Apex Robotics Inc',
        title: 'Senior AI Engineer',
        domain: 'AI_ENGINEERING',
        minLevel: 7,
        maxLevel: 10,
        openings: 2,
        requiredSkills: ['PyTorch'],
        status: 'OPEN',
        createdAt: '2026-10-02T10:00:00Z',
      },
    ]);

    vi.mocked(adminApi.getUserAnalytics).mockResolvedValue({
      totals: { totalUsers: 150, activeUsers: 140, suspendedUsers: 10 },
      byRole: [{ role: 'JOB_SEEKER', count: 80 }, { role: 'EMPLOYEE', count: 50 }, { role: 'FOUNDER', count: 20 }],
      byPlatformRole: [{ role: 'NONE', count: 145 }, { role: 'ADMIN', count: 5 }],
      byDomain: [{ domain: 'SOFTWARE_ENGINEERING', count: 80 }, { domain: 'AI_ENGINEERING', count: 70 }],
      registrationTrends: [{ date: '2026-10-10', count: 12 }],
      dateRange: { startDate: '2026-09-10', endDate: '2026-10-10' },
    });

    vi.mocked(adminApi.getApplicationAnalytics).mockResolvedValue({
      totalApplications: 60,
      byStatus: [{ status: 'ACCEPTED', count: 10 }, { status: 'REJECTED', count: 10 }],
      byStage: [{ stage: 'APPLIED', count: 20 }, { stage: 'INTERVIEW', count: 15 }],
      rejectionReasons: [{ stage: 'ATS', count: 7 }],
      topMissingSkills: [{ skill: 'Docker', count: 5 }],
      dateRange: { startDate: '2026-09-10', endDate: '2026-10-10' },
    });

    vi.mocked(adminApi.getTaskAnalytics).mockResolvedValue({
      totalTasks: 300,
      totalSubmissions: 280,
      submissionRate: 0.933,
      averageScore: 82.5,
      scoreStats: {
        avgScore: 82.5,
        minScore: 40,
        maxScore: 100,
        totalEvaluations: 280,
      },
      byDifficulty: [
        { difficulty: 'EASY', count: 100 },
        { difficulty: 'MEDIUM', count: 120 },
        { difficulty: 'HARD', count: 80 },
      ],
      byScoreBand: [
        { band: 'POOR (0-39)', count: 5 },
        { band: 'NEEDS_IMPROVEMENT (40-59)', count: 15 },
        { band: 'ACCEPTABLE (60-74)', count: 60 },
        { band: 'GOOD (75-89)', count: 120 },
        { band: 'EXCELLENT (90-100)', count: 80 },
      ],
      dailyScoreTrend: [{ date: '2026-10-10', avgScore: 82.5, count: 280 }],
      dateRange: { startDate: '2026-09-10', endDate: '2026-10-10' },
    });

    vi.mocked(adminApi.getEconomyAnalytics).mockResolvedValue({
      circulation: {
        totalExpCirculation: 500000,
        totalCorpCoinCirculation: 125000,
      },
      expTransactions: [],
      corpCoinTransactions: [],
      dateRange: { startDate: '2026-09-10', endDate: '2026-10-10' },
    });

    vi.mocked(adminApi.getAiAnalytics).mockResolvedValue({
      requestsByProvider: [{ provider: 'GEMINI', count: 300 }, { provider: 'OPENAI', count: 150 }],
      requestsByTaskType: [{ taskType: 'ATS_SCREENING', count: 450 }],
      telemetry: {
        avgLatencyMs: 820,
        minLatencyMs: 200,
        maxLatencyMs: 2500,
        totalTokens: 43000,
        totalCalls: 450,
        successCalls: 446,
        failedCalls: 4,
        failureRate: 0.8,
      },
      errorSummary: [{ errorCode: 'RATE_LIMIT', count: 3 }],
      liveQueueDepth: [{ status: 'PENDING', count: 2 }],
      dateRange: { startDate: '2026-09-10', endDate: '2026-10-10' },
    });

    vi.mocked(adminApi.getAuditLogs).mockResolvedValue({
      logs: [
        {
          _id: 'audit-1',
          actorId: 'admin-1',
          actorRole: 'ADMIN',
          action: 'USER_SUSPEND',
          targetType: 'users',
          targetId: 'u-user-2',
          previousState: { isSuspended: false },
          newState: { isSuspended: true },
          reason: 'Terms of service violation',
          createdAt: '2026-10-10T12:00:00Z',
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });

    vi.mocked(adminApi.getAiQueue).mockResolvedValue({
      jobs: [
        {
          _id: 'job-ai-1',
          taskType: 'ATS_SCREENING',
          pool: 'PIPELINE',
          status: 'PENDING',
          attempts: 1,
          createdAt: '2026-10-10T12:30:00Z',
          updatedAt: '2026-10-10T12:30:00Z',
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });
  });

  it('renders Admin Console and users roster table by default', async () => {
    renderAdminConsole();

    expect(screen.getByText('Platform Administration')).toBeInTheDocument();
    expect(screen.getByText(/Authoritative system governance/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Master Administrator')).toBeInTheDocument();
      expect(screen.getByText('Candidate Dev')).toBeInTheDocument();
      expect(screen.getByText('admin@corpverse.com')).toBeInTheDocument();
    });
  });

  it('navigates through tabs: Platform Config, Companies & Jobs, Analytics, Audit Logs, AI Queue, Economy Reset', async () => {
    renderAdminConsole();

    await waitFor(() => {
      expect(screen.getByText('Master Administrator')).toBeInTheDocument();
    });

    // Switch to Platform Config tab
    const configTab = screen.getByTestId('admin-nav-config');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('PlatformConfig Section Editor')).toBeInTheDocument();
      expect(screen.getByText(/Founder & Startup/)).toBeInTheDocument();
    });

    // Switch to Companies & Jobs tab
    const companiesTab = screen.getByTestId('admin-nav-companies_jobs');
    fireEvent.click(companiesTab);

    await waitFor(() => {
      expect(screen.getByText('Apex Robotics Inc')).toBeInTheDocument();
      expect(screen.getByText('Senior AI Engineer')).toBeInTheDocument();
    });

    // Switch to Analytics tab
    const analyticsTab = screen.getByTestId('admin-nav-analytics');
    fireEvent.click(analyticsTab);

    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('EXP in Circulation')).toBeInTheDocument();
    });

    // Switch to Audit Logs tab
    const auditTab = screen.getByTestId('admin-nav-audit');
    fireEvent.click(auditTab);

    await waitFor(() => {
      expect(screen.getByText('Append-Only Audit Log Explorer')).toBeInTheDocument();
      expect(screen.getByText('USER_SUSPEND')).toBeInTheDocument();
      expect(screen.getByText('Terms of service violation')).toBeInTheDocument();
    });

    // Switch to AI Queue tab
    const queueTab = screen.getByTestId('admin-nav-queue');
    fireEvent.click(queueTab);

    await waitFor(() => {
      expect(screen.getByText('AI Background Execution Queue')).toBeInTheDocument();
      expect(screen.getByText('ATS_SCREENING')).toBeInTheDocument();
    });

    // Switch to Economy Reset tab
    const economyTab = screen.getByTestId('admin-nav-economy');
    fireEvent.click(economyTab);

    await waitFor(() => {
      expect(screen.getByText('Dangerous Economy Reset Tool')).toBeInTheDocument();
      expect(screen.getByText('Launch Economy Reset Challenge')).toBeInTheDocument();
    });
  });

  it('opens suspension modal and submits suspension with justification reason', async () => {
    vi.mocked(adminApi.suspendUser).mockResolvedValue({
      success: true,
      data: {
        _id: 'u-user-2',
        email: 'dev@corpverse.com',
        careerRole: 'JOB_SEEKER',
        platformRole: 'NONE',
        status: 'SUSPENDED',
        isSuspended: true,
        emailVerified: true,
        totalExpCached: 600,
        corpCoinBalanceCached: 100,
        createdAt: '2026-10-02T10:00:00Z',
      },
    });

    renderAdminConsole();

    await waitFor(() => {
      expect(screen.getByText('Candidate Dev')).toBeInTheDocument();
    });

    const suspendBtns = screen.getAllByRole('button', { name: 'Suspend' });
    expect(suspendBtns.length).toBeGreaterThan(0);
    fireEvent.click(suspendBtns[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Suspend User Account/)).toBeInTheDocument();
    });

    const reasonInput = screen.getByPlaceholderText(/Audit reason for account suspension/);
    fireEvent.change(reasonInput, { target: { value: 'Repeated platform policy non-compliance' } });

    const confirmSuspendBtn = screen.getByRole('button', { name: 'Suspend Account' });
    fireEvent.click(confirmSuspendBtn);

    await waitFor(() => {
      expect(adminApi.suspendUser).toHaveBeenCalledWith('u-admin-1', 'Repeated platform policy non-compliance');
    });
  });

  it('updates platform config section with version increment and audit reason', async () => {
    vi.mocked(adminApi.updateConfigSection).mockResolvedValue({
      founder: { starterCoins: 1200, unlockExp: 12000 },
    });

    renderAdminConsole();

    const configTab = screen.getByTestId('admin-nav-config');
    fireEvent.click(configTab);

    await waitFor(() => {
      expect(screen.getByText('Patch Config Section & Bump Version')).toBeInTheDocument();
    });

    const reasonInput = screen.getByPlaceholderText(/Reason for modifying this configuration section/);
    fireEvent.change(reasonInput, { target: { value: 'Boosting starter coins buffer' } });

    const saveBtn = screen.getByRole('button', { name: 'Patch Config Section & Bump Version' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminApi.updateConfigSection).toHaveBeenCalledWith(
        'founder',
        expect.anything(),
        'Boosting starter coins buffer'
      );
    });
  });
});
