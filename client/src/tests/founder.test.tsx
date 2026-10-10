import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast/ToastContext';
import { FounderUnlockPage } from '../pages/founder/FounderUnlockPage';
import { CreateCompanyPage } from '../pages/founder/CreateCompanyPage';
import { BotShopPage } from '../pages/founder/BotShopPage';
import { FounderDashboardPage } from '../pages/founder/FounderDashboardPage';
import { DailyScenarioPage } from '../pages/founder/DailyScenarioPage';
import { JobOpeningsPage } from '../pages/founder/JobOpeningsPage';
import { ApplicantPipelinePage } from '../pages/founder/ApplicantPipelinePage';
import { FounderLedgerPage } from '../pages/founder/FounderLedgerPage';
import { BankruptcyOutcomePage } from '../pages/founder/BankruptcyOutcomePage';
import apiClient from '../api/client';
import { useAuth } from '../store/AuthContext';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../store/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Founder Mode Frontend Suite', () => {
  const mockFetchCurrentUser = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: {
        _id: 'founder-1',
        email: 'founder@corpverse.com',
        displayName: 'Executive Jane',
        careerRole: 'EMPLOYEE',
        platformRole: 'NONE',
        domain: 'SOFTWARE_ENGINEERING',
        totalExpCached: 14500,
        corpCoinBalanceCached: 1000,
      },
      fetchCurrentUser: mockFetchCurrentUser,
    });
  });

  describe('FounderUnlockPage', () => {
    it('renders eligibility telemetry and handles confirmation unlock', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        eligible: true,
        currentExp: 14500,
        requiredExp: 12000,
        starterCoinAvailable: true,
        hasUnlockedBefore: false,
      });

      (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        message: 'Founder Mode unlocked successfully',
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <FounderUnlockPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText(/Unlock Founder Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Eligible to Launch/i)).toBeInTheDocument();
      expect(screen.getByText(/14,500 \/ 12,000 EXP/i)).toBeInTheDocument();
      expect(screen.getByText(/Starter Capital Grant: 1,000 CorpCoin/i)).toBeInTheDocument();

      const unlockBtn = screen.getByTestId('unlock-founder-button');
      fireEvent.click(unlockBtn);

      expect(screen.getByTestId('unlock-confirm-modal')).toBeInTheDocument();
      expect(screen.getByText(/Confirm Executive Transition/i)).toBeInTheDocument();

      const confirmBtn = screen.getByTestId('confirm-unlock-button');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/founder/unlock', { confirm: true });
        expect(mockFetchCurrentUser).toHaveBeenCalled();
      });
    });

    it('displays ineligible state when EXP is below threshold', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        eligible: false,
        currentExp: 4500,
        requiredExp: 12000,
        starterCoinAvailable: true,
        hasUnlockedBefore: false,
        reason: 'Requires minimum 12000 EXP',
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <FounderUnlockPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText(/Level 9 Required/i)).toBeInTheDocument();
      expect(screen.getByText(/4,500 \/ 12,000 EXP/i)).toBeInTheDocument();
      expect(screen.getByTestId('unlock-founder-button')).toBeDisabled();
    });
  });

  describe('CreateCompanyPage', () => {
    it('renders company formation wizard with cost preview and submits creation', async () => {
      (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        company: {
          _id: 'comp-new',
          name: 'Apex Robotics Systems',
          domain: 'SOFTWARE_ENGINEERING',
          financialHealth: 0,
        },
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <CreateCompanyPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('create-company-page')).toBeInTheDocument();
      expect(screen.getByText(/Establish Your Corporation/i)).toBeInTheDocument();
      expect(screen.getByText(/100 CorpCoin/i)).toBeInTheDocument();
      expect(screen.getByText(/900 CorpCoin/i)).toBeInTheDocument();

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
        expect(mockFetchCurrentUser).toHaveBeenCalled();
      });
    });
  });

  describe('BotShopPage', () => {
    it('renders 3 basic bots and handles bot acquisition', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        company: {
          _id: 'comp-1',
          name: 'Apex Robotics',
          isOpenForHiring: false,
        },
        bots: [
          { botType: 'HIRING_BOT', isActive: true },
        ],
      });

      (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <BotShopPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('bot-shop-page')).toBeInTheDocument();
      expect(screen.getByTestId('hiring-inactive-banner')).toBeInTheDocument();
      expect(screen.getByText(/1 of 3 Basic Bots/i)).toBeInTheDocument();

      // Acquire task bot
      const buyTaskBotBtn = screen.getByTestId('buy-bot-task_bot');
      fireEvent.click(buyTaskBotBtn);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/founder/bots/purchase', {
          botType: 'TASK_BOT',
        });
      });
    });

    it('displays open for hiring banner when all 3 basic bots are active', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        company: {
          _id: 'comp-1',
          name: 'Apex Robotics',
          isOpenForHiring: true,
        },
        bots: [
          { botType: 'HIRING_BOT', isActive: true },
          { botType: 'TASK_BOT', isActive: true },
          { botType: 'EVALUATION_BOT', isActive: true },
        ],
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <BotShopPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('hiring-active-banner')).toBeInTheDocument();
      expect(screen.getByText(/Open for Hiring Active/i)).toBeInTheDocument();
    });
  });

  describe('FounderDashboardPage', () => {
    it('renders financial health gauge, telemetry, and employee roster', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/founder/company') {
          return Promise.resolve({
            _id: 'comp-1',
            name: 'Cyberdyne Systems',
            domain: 'AI_ENGINEERING',
            status: 'ACTIVE',
            isOpenForHiring: true,
            financialHealth: 350,
            companyRating: 88,
            employeeSatisfaction: 82,
            retentionRate: 95,
            employeeCount: 4,
            maxEmployees: 20,
            operatingDays: 7,
            cumulativeRevenue: 4200,
            cumulativeProfit: 1600,
          });
        }
        if (url.startsWith('/founder/simulation/financials')) {
          return Promise.resolve([
            {
              _id: 'snap-1',
              date: '2026-10-10',
              revenue: 600,
              expenses: 400,
              profit: 200,
              financialHealth: 350,
              companyRating: 88,
              employeeSatisfaction: 82,
              employeeRetentionRate: 95,
              employeeCount: 4,
              recordedAt: new Date().toISOString(),
            },
          ]);
        }
        if (url === '/founder/employees') {
          return Promise.resolve({
            employees: [
              {
                _id: 'emp-1',
                userId: { _id: 'u-1', email: 'alice@corpverse.com', displayName: 'Alice Engineer' },
                domain: 'AI_ENGINEERING',
                level: 5,
                positionTitle: 'Machine Learning Specialist',
                status: 'ACTIVE',
                startedAt: new Date().toISOString(),
              },
            ],
          });
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <FounderDashboardPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('founder-dashboard-page')).toBeInTheDocument();
      expect(screen.getByText('Cyberdyne Systems')).toBeInTheDocument();
      expect(screen.getAllByText(/350 CC/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Solvent & Stable/i)).toBeInTheDocument();
      expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning Specialist')).toBeInTheDocument();
    });
  });

  describe('DailyScenarioPage', () => {
    it('renders daily dilemma, option modifiers, and executes strategic decision', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        _id: 'scen-1',
        companyId: 'comp-1',
        date: '2026-10-10',
        category: 'FINANCIAL',
        scenarioPrompt: 'A key infrastructure vendor offers a 20% discount if we commit to an annual enterprise tier upfront.',
        options: [
          {
            optionId: 'A',
            text: 'Sign annual contract upfront (-150 CC immediate, -15% daily expenses)',
            templateId: 'REDUCE_EXPENSES_UPFRONT',
            modifiers: {
              expensesDeltaPercent: -15,
              immediateCost: 150,
              satisfactionDelta: 0,
              reputationDelta: 0,
            },
          },
          {
            optionId: 'B',
            text: 'Remain on month-to-month pay-as-you-go',
            templateId: 'STATUS_QUO',
            modifiers: {
              revenueDeltaPercent: 0,
              expensesDeltaPercent: 0,
              satisfactionDelta: 0,
              reputationDelta: 0,
            },
          },
        ],
        status: 'PENDING',
      });

      (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <DailyScenarioPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('daily-scenario-page')).toBeInTheDocument();
      expect(screen.getByText(/Daily Executive Dilemma/i)).toBeInTheDocument();
      expect(screen.getByText(/A key infrastructure vendor offers/i)).toBeInTheDocument();

      const optionA = screen.getByTestId('scenario-option-a');
      fireEvent.click(optionA);

      const submitDecisionBtn = screen.getByTestId('submit-decision-button');
      fireEvent.click(submitDecisionBtn);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/founder/simulation/decision', {
          scenarioId: 'scen-1',
          chosenOptionId: 'A',
          rationale: undefined,
        });
      });
    });

    it('triggers daily simulation tick and renders financial outcome banner', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        _id: 'scen-1',
        companyId: 'comp-1',
        date: '2026-10-10',
        category: 'PRODUCT',
        scenarioPrompt: 'Release early beta feature.',
        options: [],
        status: 'DECIDED',
        chosenOptionId: 'A',
      });

      (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        alreadyTicked: false,
        tickResult: {
          dayKey: '2026-10-10',
          dailyRevenue: 520,
          dailyExpenses: 340,
          dailyProfit: 180,
          newFinancialHealth: 480,
          newCompanyRating: 85,
          isBankrupt: false,
        },
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <DailyScenarioPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('daily-scenario-page')).toBeInTheDocument();
      const tickBtn = screen.getByTestId('execute-tick-button');
      fireEvent.click(tickBtn);

      await waitFor(() => {
        expect(screen.getByTestId('tick-outcome-banner')).toBeInTheDocument();
        expect(screen.getByText(/\+520 CC/i)).toBeInTheDocument();
        expect(screen.getByText(/-340 CC/i)).toBeInTheDocument();
        expect(screen.getByText(/SOLVENT/i)).toBeInTheDocument();
      });
    });
  });

  describe('JobOpeningsPage & ApplicantPipelinePage', () => {
    it('manages job requisitions and closes an opening', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/founder/jobs') {
          return Promise.resolve({
            jobs: [
              {
                _id: 'job-1',
                title: 'Senior Distributed Engineer',
                domain: 'SOFTWARE_ENGINEERING',
                seniorityLevel: 7,
                requiredSkills: ['Rust', 'Distributed Systems'],
                isOpen: true,
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (url === '/founder/company') {
          return Promise.resolve({
            name: 'Nexus Corp',
            employeeCount: 3,
            maxEmployees: 20,
            isOpenForHiring: true,
          });
        }
        return Promise.reject(new Error(`Unknown ${url}`));
      });

      (apiClient.patch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <JobOpeningsPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText('Senior Distributed Engineer')).toBeInTheDocument();
      expect(screen.getByText('Level 7')).toBeInTheDocument();
      expect(screen.getByText('OPEN')).toBeInTheDocument();

      const closeBtn = screen.getByText('Close Requisition');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(apiClient.patch).toHaveBeenCalledWith('/founder/jobs/job-1/close');
      });
    });

    it('renders candidate pipeline and inspects evaluation rounds', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/founder/applications') {
          return Promise.resolve({
            applications: [
              {
                _id: 'app-1',
                candidateId: { _id: 'cand-1', email: 'dev@corpverse.com', displayName: 'Sam Dev' },
                jobId: { _id: 'job-1', title: 'Platform Engineer' },
                currentStage: 'ASSESSMENT',
                status: 'APPLIED',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (url === '/founder/applications/app-1') {
          return Promise.resolve({
            application: {
              _id: 'app-1',
              currentStage: 'ASSESSMENT',
              status: 'APPLIED',
              history: [],
            },
            evaluations: [
              {
                _id: 'eval-1',
                stage: 'ATS_SCREENING',
                score: 88,
                passed: true,
                feedback: 'Exceptional profile match and distributed systems experience.',
                createdAt: new Date().toISOString(),
              },
            ],
            feedbacks: [],
          });
        }
        return Promise.reject(new Error(`Unknown ${url}`));
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <ApplicantPipelinePage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText('Sam Dev')).toBeInTheDocument();
      expect(screen.getByText('Platform Engineer')).toBeInTheDocument();

      const viewEvalBtn = screen.getByText('View Evaluation');
      fireEvent.click(viewEvalBtn);

      expect(await screen.findByTestId('application-detail-modal')).toBeInTheDocument();
      expect(screen.getByText(/ATS_SCREENING/i)).toBeInTheDocument();
      expect(screen.getByText(/Score: 88\/100/i)).toBeInTheDocument();
    });
  });

  describe('FounderLedgerPage & BankruptcyOutcomePage', () => {
    it('renders immutable double-entry CorpCoin transactions', async () => {
      (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        transactions: [
          {
            _id: 'tx-1',
            type: 'FOUNDER_STARTER_GRANT',
            amount: 1000,
            balanceAfter: 1000,
            reason: 'Founder starter CorpCoin grant upon initial unlock',
            createdAt: new Date().toISOString(),
          },
          {
            _id: 'tx-2',
            type: 'COMPANY_CREATION',
            amount: -100,
            balanceAfter: 900,
            reason: 'Creation cost for company Apex Robotics',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <FounderLedgerPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('founder-ledger-page')).toBeInTheDocument();
      expect(screen.getByText('+1,000 CC')).toBeInTheDocument();
      expect(screen.getByText('-100 CC')).toBeInTheDocument();
      expect(screen.getByText(/Founder starter CorpCoin grant/i)).toBeInTheDocument();
    });

    it('renders bankruptcy outcome page with preserved EXP and talent market re-entry', () => {
      render(
        <MemoryRouter>
          <ToastProvider>
            <BankruptcyOutcomePage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('bankruptcy-outcome-page')).toBeInTheDocument();
      expect(screen.getByText(/Company Insolvent: Bankruptcy Liquidation Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/14,500 EXP/i)).toBeInTheDocument();
      expect(screen.getByText(/100% of lifelong career EXP is preserved/i)).toBeInTheDocument();
      expect(screen.getByTestId('reentry-jobs-btn')).toBeInTheDocument();
    });
  });
});
