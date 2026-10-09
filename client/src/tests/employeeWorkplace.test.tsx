import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WorkplaceDashboardPage } from '../pages/employee/WorkplaceDashboardPage';
import { TaskWorkPage } from '../pages/employee/TaskWorkPage';
import { TaskHistoryPage } from '../pages/employee/TaskHistoryPage';
import * as employeeApi from '../api/employee';
import { AuthProvider } from '../store/AuthContext';

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

const basePrimaryTask: employeeApi.EmployeeTask = {
  _id: 'task-p-1',
  userId: 'user-1',
  companyId: 'comp-1',
  domain: 'SOFTWARE_ENGINEERING',
  level: 4,
  kind: 'PRIMARY',
  difficulty: 'MEDIUM',
  title: 'Optimize Database Indexing & Connection Pool',
  description: 'Diagnose connection exhaustion and propose optimal indexing strategy.',
  scenario: {
    title: 'Optimize Database Indexing & Connection Pool',
    scenario: 'The enterprise cluster is encountering slow queries and pool exhaustion.',
    requirements: ['Analyze execution plan', 'Add compound index', 'Tune idle timeouts'],
    difficulty: 'MEDIUM',
    evaluationCriteria: ['Index correctness', 'Resource efficiency', 'Failure resilience'],
  },
  maxExp: 60,
  status: 'ASSIGNED',
  dayKey: '2026-10-09',
  dueAt: '2026-10-10T00:00:00.000Z',
  createdAt: '2026-10-09T08:00:00.000Z',
  updatedAt: '2026-10-09T08:00:00.000Z',
};

const baseBonusTask: employeeApi.EmployeeTask = {
  _id: 'task-b-1',
  userId: 'user-1',
  companyId: 'comp-1',
  domain: 'SOFTWARE_ENGINEERING',
  level: 4,
  kind: 'BONUS',
  difficulty: 'HARD',
  title: 'Implement Resilient Circuit Breaker',
  description: 'Add circuit breaker state machine for outbound microservice calls.',
  scenario: {
    title: 'Implement Resilient Circuit Breaker',
    scenario: 'Third-party API latency spikes are causing cascading thread exhaustion.',
    requirements: ['Three states: CLOSED, OPEN, HALF_OPEN', 'Consecutive error threshold', 'Automatic probe timer'],
    difficulty: 'HARD',
    evaluationCriteria: ['State transition safety', 'Thread safety', 'Configurability'],
  },
  maxExp: 100,
  status: 'WAITING_FOR_PROVIDER',
  dayKey: '2026-10-09',
  dueAt: '2026-10-10T00:00:00.000Z',
  createdAt: '2026-10-09T08:00:00.000Z',
  updatedAt: '2026-10-09T08:00:00.000Z',
};

const mockTasks: employeeApi.EmployeeTask[] = [basePrimaryTask, baseBonusTask];

const mockPromotionProgress: employeeApi.PromotionProgress = {
  currentLevel: 4,
  currentTitle: 'Associate Software Engineer',
  targetLevel: 5,
  targetTitle: 'Mid-Level Software Engineer',
  isMaxLevel: false,
  criteria: {
    exp: { current: 2450, required: 3000, met: false, missing: 550 },
    completedTasks: { current: 12, required: 10, met: true, missing: 0 },
    averageScore: { current: 82, required: 70, met: true, missing: 0 },
    activeWarnings: { current: 1, maxAllowed: 1, met: true, excess: 0 },
  },
  isEligible: false,
  missingRequirements: ['Accumulate 550 more EXP (Current: 2,450 / 3,000)'],
};

const mockCompanyInfo: employeeApi.EmployeeCompanyInfo = {
  employee: {
    _id: 'emp-1',
    userId: 'user-1',
    companyId: 'comp-1',
    level: 4,
    positionTitle: 'Associate Software Engineer',
    salarySimulated: 78000,
    status: 'ACTIVE',
    startedAt: '2026-09-01T00:00:00.000Z',
  },
  company: {
    _id: 'comp-1',
    name: 'Nexus Enterprise Systems',
    domain: 'SOFTWARE_ENGINEERING',
    tier: 'TIER_1',
    description: 'Autonomous enterprise workflows.',
  },
};

const mockWarnings: employeeApi.EmployeeWarning[] = [
  {
    _id: 'warn-1',
    userId: 'user-1',
    companyId: 'comp-1',
    taskSubmissionId: 'sub-old',
    status: 'ACTIVE',
    reason: 'Task score fell into Poor band (32/100)',
    issuedAt: '2026-09-20T10:00:00.000Z',
    expiresAt: '2026-10-20T10:00:00.000Z',
  },
];

function renderWithProviders(ui: React.ReactElement, initialPath = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </AuthProvider>
  );
}

describe('Employee Workplace Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeeApi.fetchTodayTasks).mockResolvedValue(mockTasks);
    vi.mocked(employeeApi.fetchPromotionProgress).mockResolvedValue(mockPromotionProgress);
    vi.mocked(employeeApi.fetchEmployeeCompany).mockResolvedValue(mockCompanyInfo);
    vi.mocked(employeeApi.fetchActiveWarnings).mockResolvedValue({
      activeCount: 1,
      warnings: mockWarnings,
    });
  });

  it('renders level, EXP progress, and company deployment info', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<WorkplaceDashboardPage />} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByText(/Engineering Workplace/i)).toBeInTheDocument();
      expect(screen.getByText(/Nexus Enterprise Systems/i)).toBeInTheDocument();
    });

    // Career level & EXP stats
    expect(screen.getByTestId('level-card')).toHaveTextContent('Level 4 • Associate Software Engineer');
    expect(screen.getByTestId('exp-card')).toHaveTextContent('2,450 EXP');
    expect(screen.getByTestId('warnings-stat-card')).toHaveTextContent('1 / 4');
  });

  it('renders Founder-mode status banner with remaining EXP', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<WorkplaceDashboardPage />} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByTestId('founder-mode-banner')).toBeInTheDocument();
    });

    // 12,000 - 2,450 = 9,550 EXP remaining
    expect(screen.getByTestId('founder-mode-banner')).toHaveTextContent('9,550 EXP remaining');
    expect(screen.getByTestId('founder-mode-banner')).toHaveTextContent('Locked');
  });

  it('renders active disciplinary warnings with expiration countdown', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<WorkplaceDashboardPage />} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByTestId('warnings-detail-card')).toBeInTheDocument();
    });

    expect(screen.getByText(/Task score fell into Poor band/i)).toBeInTheDocument();
    expect(screen.getByText(/Expires:/i)).toBeInTheDocument();
  });

  it('renders promotion readiness panel with all 4 criteria', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<WorkplaceDashboardPage />} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByTestId('promotion-progress-panel')).toBeInTheDocument();
    });

    expect(screen.getByText(/Promotion Readiness: Level 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Accumulate 550 more EXP/i)).toBeInTheDocument();
    expect(screen.getByText(/12 \/ 10/i)).toBeInTheDocument(); // completed tasks
    expect(screen.getByText(/82% \(Min 70%\)/i)).toBeInTheDocument(); // avg score
  });

  it('renders today primary and bonus tasks including AI-waiting status', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<WorkplaceDashboardPage />} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByTestId('task-card-primary')).toBeInTheDocument();
      expect(screen.getByTestId('task-card-bonus')).toBeInTheDocument();
    });

    expect(screen.getByText('Optimize Database Indexing & Connection Pool')).toBeInTheDocument();
    expect(screen.getByText('+60 EXP Max')).toBeInTheDocument();

    // Bonus task is WAITING_FOR_PROVIDER
    expect(screen.getByTestId('ai-waiting-badge')).toBeInTheDocument();
    expect(screen.getByText(/AI Bot Generating Scenario.../i)).toBeInTheDocument();
  });
});

describe('Task Work & Evaluation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task scenario, requirements, and enforces minimum submission length', async () => {
    vi.mocked(employeeApi.fetchTaskEvaluation).mockResolvedValue({
      task: basePrimaryTask,
      submission: null,
      performanceRecord: null,
    });

    renderWithProviders(
      <Routes>
        <Route path="/tasks/:id" element={<TaskWorkPage />} />
      </Routes>,
      '/tasks/task-p-1'
    );

    await waitFor(() => {
      expect(screen.getByText('Optimize Database Indexing & Connection Pool')).toBeInTheDocument();
    });

    expect(screen.getByText('Analyze execution plan')).toBeInTheDocument();
    expect(screen.getByText('Index correctness')).toBeInTheDocument();

    const textarea = screen.getByTestId('solution-textarea');
    const submitBtn = screen.getByTestId('submit-solution-btn');

    // Submit button disabled when empty or < 10 chars
    expect(submitBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Too short' } });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(textarea, {
      target: {
        value: 'CREATE INDEX idx_user_tenant ON orders (tenant_id, created_at); Set max_pool_size to 50.',
      },
    });
    expect(submitBtn).not.toBeDisabled();
  });

  it('submits solution, displays AI evaluator score hero, rubric breakdown, and awarded EXP', async () => {
    vi.mocked(employeeApi.fetchTaskEvaluation).mockResolvedValue({
      task: basePrimaryTask,
      submission: null,
      performanceRecord: null,
    });

    const mockPerformanceRecord: employeeApi.PerformanceRecord = {
      _id: 'perf-1',
      taskSubmissionId: 'sub-1',
      taskId: 'task-p-1',
      userId: 'user-1',
      companyId: 'comp-1',
      aiScore: 92,
      scoreBand: 'EXCELLENT',
      awardedExp: 55,
      feedback: 'Outstanding schema optimization and pool sizing parameters.',
      strengths: ['Identified left-prefix index rule', 'Configured connection health check'],
      weaknesses: [],
      criteriaScores: [
        { criterion: 'Index correctness', score: 95, comment: 'Optimal multi-column ordering' },
        { criterion: 'Resource efficiency', score: 90, comment: 'Sized for peak concurrency' },
      ],
      createdAt: '2026-10-09T09:00:00.000Z',
    };

    vi.mocked(employeeApi.submitTaskWork).mockResolvedValue({
      submission: {
        _id: 'sub-1',
        taskId: 'task-p-1',
        userId: 'user-1',
        content: 'CREATE INDEX idx_user_tenant ON orders (tenant_id, created_at);',
        submittedAt: '2026-10-09T09:00:00.000Z',
        createdAt: '2026-10-09T09:00:00.000Z',
      },
      task: { ...basePrimaryTask, status: 'EVALUATED' },
      performanceRecord: mockPerformanceRecord,
    });

    renderWithProviders(
      <Routes>
        <Route path="/tasks/:id" element={<TaskWorkPage />} />
      </Routes>,
      '/tasks/task-p-1'
    );

    await waitFor(() => {
      expect(screen.getByTestId('solution-textarea')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('solution-textarea'), {
      target: {
        value: 'CREATE INDEX idx_user_tenant ON orders (tenant_id, created_at);',
      },
    });

    fireEvent.click(screen.getByTestId('submit-solution-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('evaluation-results-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('evaluation-score')).toHaveTextContent('92');
    expect(screen.getByTestId('awarded-exp-pill')).toHaveTextContent('+55 EXP');
    expect(screen.getByText('EXCELLENT')).toBeInTheDocument();
    expect(screen.getByText(/Outstanding schema optimization/i)).toBeInTheDocument();
    expect(screen.getByText('Optimal multi-column ordering')).toBeInTheDocument();
  });
});

describe('Task History & EXP Ledger Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders history items and toggles to double-entry EXP ledger', async () => {
    const mockHistoryItem: employeeApi.TaskHistoryItem = {
      record: {
        _id: 'perf-h1',
        taskSubmissionId: 'sub-h1',
        taskId: 'task-p-1',
        userId: 'user-1',
        companyId: 'comp-1',
        aiScore: 88,
        scoreBand: 'GOOD',
        awardedExp: 50,
        feedback: 'Solid implementation',
        strengths: ['Clean code'],
        weaknesses: [],
        criteriaScores: [],
        createdAt: '2026-10-08T12:00:00.000Z',
      },
      task: basePrimaryTask,
    };

    const mockTransactions: employeeApi.ExpTransaction[] = [
      {
        _id: 'tx-1',
        userId: 'user-1',
        type: 'TASK_COMPLETION',
        amount: 50,
        balanceAfter: 2450,
        reason: 'Task completion: Optimize Database Indexing & Connection Pool',
        sourceId: 'sub-h1',
        createdAt: '2026-10-08T12:00:00.000Z',
      },
    ];

    vi.mocked(employeeApi.fetchTaskHistory).mockResolvedValue([mockHistoryItem]);
    vi.mocked(employeeApi.fetchExpLedger).mockResolvedValue(mockTransactions);

    renderWithProviders(
      <Routes>
        <Route path="/tasks/history" element={<TaskHistoryPage />} />
      </Routes>,
      '/tasks/history'
    );

    await waitFor(() => {
      expect(screen.getByTestId('task-history-table')).toBeInTheDocument();
    });

    expect(screen.getByText('88 / 100 • GOOD')).toBeInTheDocument();
    expect(screen.getByText('+50 EXP')).toBeInTheDocument();

    // Toggle to EXP Ledger tab
    fireEvent.click(screen.getByTestId('tab-ledger'));

    await waitFor(() => {
      expect(screen.getByTestId('exp-ledger-table')).toBeInTheDocument();
    });

    expect(screen.getByText('TASK_COMPLETION')).toBeInTheDocument();
    expect(screen.getByText('2,450 EXP')).toBeInTheDocument();
    expect(screen.getByText(/Task completion: Optimize Database Indexing/i)).toBeInTheDocument();
  });
});
