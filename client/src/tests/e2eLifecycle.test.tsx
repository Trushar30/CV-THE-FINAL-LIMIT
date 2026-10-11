import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast/ToastContext';
import { AuthProvider, DEFAULT_MOCK_USER } from '../store/AuthContext';
import { RegisterPage } from '../pages/RegisterPage';
import { WorkplaceDashboardPage } from '../pages/employee/WorkplaceDashboardPage';
import { FounderUnlockPage } from '../pages/founder/FounderUnlockPage';
import { CreateCompanyPage } from '../pages/founder/CreateCompanyPage';
import { BotShopPage } from '../pages/founder/BotShopPage';
import { BankruptcyOutcomePage } from '../pages/founder/BankruptcyOutcomePage';
import apiClient from '../api/client';
import * as employeeApi from '../api/employee';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../api/employee', () => ({
  fetchTodayTasks: vi.fn(),
  fetchTaskById: vi.fn(),
  submitTaskWork: vi.fn(),
  fetchTaskEvaluation: vi.fn(),
  fetchPromotionProgress: vi.fn(),
  fetchActiveWarnings: vi.fn(),
  fetchEmployeeCompany: vi.fn(),
  fetchTaskHistory: vi.fn(),
  fetchExpLedger: vi.fn(),
}));

describe('TASK P10.2: Frontend End-to-End Lifecycle Suite', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Step 1: Renders registration portal and submits registration payload', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      message: 'Registration successful. Please verify your email.',
      email: 'candidate@corpverse.dev',
    });

    render(
      <MemoryRouter>
        <AuthProvider initialUser={null}>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/corporate email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^master password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/corporate email/i), {
      target: { value: 'candidate@corpverse.dev' },
    });
    fireEvent.change(screen.getByLabelText(/^master password/i), {
      target: { value: 'ValidPass123!' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'ValidPass123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /register account/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'candidate@corpverse.dev',
        password: 'ValidPass123!',
      });
    });
  });

  it('Step 2: Renders employee workplace dashboard with active tasks and company context', async () => {
    vi.mocked(employeeApi.fetchTodayTasks).mockResolvedValue([
      {
        _id: 'task-1',
        userId: 'user-1',
        companyId: 'comp-1',
        domain: 'SOFTWARE_ENGINEERING',
        level: 2,
        kind: 'PRIMARY',
        difficulty: 'MEDIUM',
        title: 'Optimize API Latency & Caching',
        description: 'Diagnose endpoint bottlenecks and add caching layer.',
        scenario: {
          title: 'Optimize API Latency & Caching',
          scenario: 'Slow database calls are degrading p99 latency.',
          requirements: ['Benchmark latency', 'Add cache layer', 'Verify eviction'],
          difficulty: 'MEDIUM',
          evaluationCriteria: ['Correctness', 'Cache policy', 'Resilience'],
        },
        maxExp: 60,
        status: 'ASSIGNED',
        dayKey: '2026-10-10',
        dueAt: '2026-10-11T00:00:00.000Z',
        createdAt: '2026-10-10T08:00:00.000Z',
        updatedAt: '2026-10-10T08:00:00.000Z',
      },
    ]);

    vi.mocked(employeeApi.fetchEmployeeCompany).mockResolvedValue({
      company: {
        _id: 'comp-1',
        name: 'TechCorp Global',
        domain: 'SOFTWARE_ENGINEERING',
        tier: 'TIER_1',
        description: 'Global engineering corporation',
      },
      employee: {
        _id: 'emp-1',
        userId: 'user-1',
        companyId: 'comp-1',
        level: 2,
        positionTitle: 'Junior Software Engineer',
        salarySimulated: 45000,
        status: 'ACTIVE',
        startedAt: '2026-10-01T00:00:00.000Z',
      },
    });

    vi.mocked(employeeApi.fetchActiveWarnings).mockResolvedValue({
      activeCount: 0,
      warnings: [],
    });

    vi.mocked(employeeApi.fetchPromotionProgress).mockResolvedValue({
      currentLevel: 2,
      currentTitle: 'Junior Software Engineer',
      targetLevel: 3,
      targetTitle: 'Associate Software Engineer',
      isMaxLevel: false,
      criteria: {
        exp: { current: 500, required: 1200, met: false, missing: 700 },
        completedTasks: { current: 5, required: 10, met: false, missing: 5 },
        averageScore: { current: 85, required: 75, met: true, missing: 0 },
        activeWarnings: { current: 0, maxAllowed: 0, met: true, excess: 0 },
      },
      isEligible: false,
      missingRequirements: ['Accumulate 700 more EXP'],
    });

    render(
      <MemoryRouter>
        <AuthProvider
          initialUser={{
            ...DEFAULT_MOCK_USER,
            careerRole: 'EMPLOYEE',
            totalExpCached: 500,
          }}
        >
          <WorkplaceDashboardPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/TechCorp Global/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimize API Latency & Caching/i)).toBeInTheDocument();
    expect(screen.getByText(/Junior Software Engineer/i)).toBeInTheDocument();
  });

  it('Step 3: Verifies founder mode unlock eligibility and unlocks founder tier', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      eligible: true,
      currentExp: 14500,
      requiredExp: 12000,
      starterCoinAvailable: true,
      hasUnlockedBefore: false,
    });

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      message: 'Founder Mode unlocked successfully',
    });

    render(
      <MemoryRouter>
        <AuthProvider
          initialUser={{
            ...DEFAULT_MOCK_USER,
            careerRole: 'EMPLOYEE',
            totalExpCached: 14500,
          }}
        >
          <ToastProvider>
            <FounderUnlockPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Unlock Founder Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Eligible to Launch/i)).toBeInTheDocument();
    expect(screen.getByText(/Starter Capital Grant: 1,000 CorpCoin/i)).toBeInTheDocument();

    const unlockBtn = screen.getByTestId('unlock-founder-button');
    fireEvent.click(unlockBtn);

    expect(screen.getByTestId('unlock-confirm-modal')).toBeInTheDocument();
    const confirmBtn = screen.getByTestId('confirm-unlock-button');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/founder/unlock', { confirm: true });
    });
  });

  it('Step 4: Creates new founder company wizard with domain selection', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      company: {
        _id: 'comp-new',
        name: 'Apex Robotics Systems',
        domain: 'SOFTWARE_ENGINEERING',
        financialHealth: 0,
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider
          initialUser={{
            ...DEFAULT_MOCK_USER,
            careerRole: 'FOUNDER',
            corpCoinBalanceCached: 1000,
          }}
        >
          <ToastProvider>
            <CreateCompanyPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('create-company-page')).toBeInTheDocument();
    expect(screen.getByText(/Establish Your Corporation/i)).toBeInTheDocument();
    expect(screen.getByText(/100 CorpCoin/i)).toBeInTheDocument();

    const nameInput = screen.getByTestId('company-name-input');
    fireEvent.change(nameInput, { target: { value: 'Apex Robotics Systems' } });

    const submitBtn = screen.getByTestId('submit-create-company');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/founder/company', {
        name: 'Apex Robotics Systems',
        domain: 'SOFTWARE_ENGINEERING',
        description: undefined,
      });
    });
  });

  it('Step 5: Acquires basic bots in AI bot marketplace and verifies hiring unlock', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      company: {
        _id: 'comp-1',
        name: 'Apex Robotics',
        isOpenForHiring: false,
      },
      bots: [{ botType: 'HIRING_BOT', isActive: true }],
    });

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
    });

    render(
      <MemoryRouter>
        <AuthProvider
          initialUser={{
            ...DEFAULT_MOCK_USER,
            careerRole: 'FOUNDER',
            corpCoinBalanceCached: 900,
          }}
        >
          <ToastProvider>
            <BotShopPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('bot-shop-page')).toBeInTheDocument();
    expect(screen.getByTestId('hiring-inactive-banner')).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 Basic Bots/i)).toBeInTheDocument();

    const buyTaskBotBtn = screen.getByTestId('buy-bot-task_bot');
    fireEvent.click(buyTaskBotBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/founder/bots/purchase', {
        botType: 'TASK_BOT',
      });
    });
  });

  it('Step 6: Renders bankruptcy liquidation outcome with preserved EXP and talent market re-entry', () => {
    render(
      <MemoryRouter>
        <AuthProvider
          initialUser={{
            ...DEFAULT_MOCK_USER,
            careerRole: 'JOB_SEEKER',
            totalExpCached: 14500,
          }}
        >
          <ToastProvider>
            <BankruptcyOutcomePage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('bankruptcy-outcome-page')).toBeInTheDocument();
    expect(
      screen.getByText(/Company Insolvent: Bankruptcy Liquidation Complete/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/14,500 EXP/i)).toBeInTheDocument();
    expect(screen.getByText(/100% of lifelong career EXP is preserved/i)).toBeInTheDocument();
    expect(screen.getByTestId('reentry-jobs-btn')).toBeInTheDocument();
  });
});
