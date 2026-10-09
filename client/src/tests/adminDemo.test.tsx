import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDemoPage } from '../pages/admin/AdminDemoPage';
import { adminDemoApi, type DemoSessionSummary, type DemoInspectionResponse } from '../api/adminDemo';
import { ToastProvider } from '../components/ui/Toast/ToastContext';

vi.mock('../api/adminDemo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/adminDemo')>();
  return {
    ...actual,
    adminDemoApi: {
      createDemoSession: vi.fn(),
      listDemoSessions: vi.fn(),
      getDemoSession: vi.fn(),
      stepDemoSession: vi.fn(),
      submitDemoAnswer: vi.fn(),
      simulateDemoSession: vi.fn(),
      cleanupDemoSession: vi.fn(),
      cleanupAllDemoData: vi.fn(),
    },
  };
});

const mockBaseSession: DemoSessionSummary = {
  _id: 'demo-session-1',
  createdBy: 'admin-1',
  applicationId: 'app-demo-1',
  companyId: 'comp-demo-1',
  jobId: 'job-demo-1',
  candidateUserId: 'cand-demo-1',
  domain: 'SOFTWARE_ENGINEERING',
  difficulty: 'MEDIUM',
  questionsCount: 3,
  interviewType: 'CODING',
  currentStage: 'INTERVIEW',
  status: 'IN_PROGRESS',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSessions: DemoSessionSummary[] = [
  mockBaseSession,
  {
    _id: 'demo-session-2',
    createdBy: 'admin-1',
    applicationId: 'app-demo-2',
    companyId: 'comp-demo-1',
    jobId: 'job-demo-2',
    candidateUserId: 'cand-demo-2',
    domain: 'AI_ENGINEERING',
    difficulty: 'HARD',
    questionsCount: 5,
    interviewType: 'ARCHITECTURE',
    currentStage: 'FINAL_REVIEW',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const mockInspectionData: DemoInspectionResponse = {
  session: mockBaseSession,
  application: {
    _id: 'app-demo-1',
    currentStage: 'INTERVIEW',
    status: 'IN_PROGRESS',
    atsScore: 88,
    atsFeedback: 'Strong backend skills and system design experience.',
    stageHistory: [
      { stage: 'ATS_SCREENING', enteredAt: new Date().toISOString(), exitedAt: new Date().toISOString(), result: 'PASSED' },
      { stage: 'SCREENING', enteredAt: new Date().toISOString(), exitedAt: new Date().toISOString(), result: 'PASSED' },
      { stage: 'INTERVIEW', enteredAt: new Date().toISOString() },
    ],
  },
  stages: {
    ats: {
      evaluation: {
        score: 88,
        summary: 'Candidate matches key tech stack requirements.',
        scoreBreakdown: {
          matchedSkills: ['Node.js', 'TypeScript', 'MongoDB'],
          missingSkills: ['Kubernetes'],
          strengths: ['Solid architecture experience'],
          weaknesses: ['Limited cloud certifications'],
        },
      },
    },
    interviews: [
      {
        stage: 'INTERVIEW',
        interview: {
          _id: 'int-1',
          status: 'IN_PROGRESS',
          questionsCount: 3,
          currentQuestionIndex: 1,
          overallScore: 85,
        },
        questions: [
          { sequenceNumber: 1, question: 'Explain how Node event loop handles async I/O.', type: 'CODING', difficulty: 'MEDIUM' },
          { sequenceNumber: 2, question: 'How would you scale a WebSocket connection pool?', type: 'ARCHITECTURE', difficulty: 'MEDIUM' },
        ],
        answers: [
          {
            answer: 'The event loop relies on libuv thread pool and epoll/kqueue.',
            score: 90,
            strengths: ['Precise libuv mechanics'],
            weaknesses: [],
            notes: 'Excellent explanation.',
          },
        ],
      },
    ],
    finalReview: {
      atsScore: 88,
      screeningScore: 82,
      assessmentScore: 85,
      interviewScore: 90,
      finalScore: 86,
      isPassing: true,
      summary: 'Candidate exceeded hiring threshold across technical categories.',
      recommendations: ['Extend mid-level offer'],
    },
    offer: {
      positionTitle: 'Backend Engineer (Simulated)',
      level: 4,
      salarySimulated: 4500,
      salaryMin: 4000,
      salaryMax: 5000,
      status: 'OFFERED',
    },
  },
  aiTelemetry: {
    jobs: [
      {
        _id: 'job-tel-1',
        taskType: 'ATS_SCREENING',
        provider: 'GEMINI',
        model: 'gemini-1.5-pro',
        status: 'COMPLETED',
        attempts: 1,
        pool: 'DEMO',
        latencyMs: 310,
        promptTokens: 520,
        completionTokens: 140,
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'job-tel-2',
        taskType: 'INTERVIEW_EVALUATION',
        provider: 'OPENAI',
        model: 'gpt-4o-mini',
        status: 'COMPLETED',
        attempts: 1,
        pool: 'DEMO',
        latencyMs: 440,
        promptTokens: 810,
        completionTokens: 210,
        createdAt: new Date().toISOString(),
      },
    ],
    recentRequests: [
      {
        _id: 'req-1',
        provider: 'GEMINI',
        model: 'gemini-1.5-pro',
        taskType: 'ATS_SCREENING',
        latencyMs: 310,
        status: 'COMPLETED',
        promptTokens: 520,
        completionTokens: 140,
        createdAt: new Date().toISOString(),
      },
    ],
  },
};

function renderAdminDemoPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AdminDemoPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('AdminDemoPage - TASK P6.8 Frontend Console', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminDemoApi.listDemoSessions).mockResolvedValue({ sessions: mockSessions });
    vi.mocked(adminDemoApi.getDemoSession).mockResolvedValue(mockInspectionData);
  });

  it('renders initial setup form and lists past demo sessions', async () => {
    renderAdminDemoPage();

    expect(screen.getByText('Admin Hiring Demo Simulator')).toBeInTheDocument();
    expect(screen.getByText('Initialize New Demo Session')).toBeInTheDocument();

    await waitFor(() => {
      expect(adminDemoApi.listDemoSessions).toHaveBeenCalled();
    });

    expect(screen.getByText('SOFTWARE_ENGINEERING')).toBeInTheDocument();
    expect(screen.getByText('AI_ENGINEERING')).toBeInTheDocument();
  });

  it('launches a new demo session on form submission', async () => {
    const createdSession: DemoSessionSummary = {
      ...mockBaseSession,
      _id: 'demo-session-new',
    };
    vi.mocked(adminDemoApi.createDemoSession).mockResolvedValue({
      session: createdSession,
      application: {},
      job: {},
      candidate: {},
    });
    vi.mocked(adminDemoApi.getDemoSession).mockResolvedValue({
      ...mockInspectionData,
      session: createdSession,
    });

    renderAdminDemoPage();

    const launchBtn = screen.getByTestId('create-session-btn');
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(adminDemoApi.createDemoSession).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 3,
          difficulty: 'EASY',
          interviewType: 'CONCEPTUAL',
        })
      );
    });

    await waitFor(() => {
      expect(adminDemoApi.getDemoSession).toHaveBeenCalledWith('demo-session-new');
    });
  });

  it('renders active stage question and allows submitting candidate response', async () => {
    renderAdminDemoPage();

    // Select existing session from the table
    await waitFor(() => {
      expect(screen.getByTestId('inspect-session-btn-demo-session-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('inspect-session-btn-demo-session-1'));

    await waitFor(() => {
      expect(adminDemoApi.getDemoSession).toHaveBeenCalledWith('demo-session-1');
    });

    // Check that question 2 is displayed in the candidate runner
    expect(
      screen.getByText('How would you scale a WebSocket connection pool?')
    ).toBeInTheDocument();

    // Fill answer and submit
    vi.mocked(adminDemoApi.submitDemoAnswer).mockResolvedValue({
      evaluation: {
        score: 92,
        strengths: ['Great distributed Redis pub/sub design'],
        weaknesses: [],
        notes: 'Very clean approach.',
      },
      isCompleted: true,
    });

    const answerInput = screen.getByTestId('demo-answer-input');
    fireEvent.change(answerInput, {
      target: { value: 'Use Redis Pub/Sub adapter across multiple gateway nodes.' },
    });

    const submitBtn = screen.getByTestId('demo-submit-answer-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminDemoApi.submitDemoAnswer).toHaveBeenCalledWith(
        'demo-session-1',
        'Use Redis Pub/Sub adapter across multiple gateway nodes.'
      );
    });
  });

  it('allows advancing session step and triggers stage update', async () => {
    vi.mocked(adminDemoApi.stepDemoSession).mockResolvedValue({
      session: { ...mockBaseSession, currentStage: 'FINAL_REVIEW' },
      stage: 'FINAL_REVIEW',
      action: 'ADVANCED',
      result: {},
    });

    renderAdminDemoPage();

    await waitFor(() => {
      expect(screen.getByTestId('inspect-session-btn-demo-session-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('inspect-session-btn-demo-session-1'));

    await waitFor(() => {
      expect(adminDemoApi.getDemoSession).toHaveBeenCalled();
    });

    const advanceBtn = screen.getByTestId('step-session-btn');
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(adminDemoApi.stepDemoSession).toHaveBeenCalledWith('demo-session-1');
    });
  });

  it('runs one-click auto simulation end-to-end', async () => {
    vi.mocked(adminDemoApi.simulateDemoSession).mockResolvedValue({
      session: { ...mockBaseSession, status: 'COMPLETED', currentStage: 'OFFER' },
      status: 'COMPLETED',
      currentStage: 'OFFER',
      history: ['ATS_SCREENING', 'SCREENING', 'INTERVIEW', 'FINAL_REVIEW', 'OFFER'],
    });

    renderAdminDemoPage();

    await waitFor(() => {
      expect(screen.getByTestId('inspect-session-btn-demo-session-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('inspect-session-btn-demo-session-1'));

    await waitFor(() => {
      expect(adminDemoApi.getDemoSession).toHaveBeenCalled();
    });

    const simulateBtn = screen.getByTestId('simulate-session-btn');
    fireEvent.click(simulateBtn);

    await waitFor(() => {
      expect(adminDemoApi.simulateDemoSession).toHaveBeenCalledWith('demo-session-1');
    });
  });

  it('displays stage scores and AI telemetry breakdown', async () => {
    renderAdminDemoPage();

    await waitFor(() => {
      expect(screen.getByTestId('inspect-session-btn-demo-session-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('inspect-session-btn-demo-session-1'));

    await waitFor(() => {
      expect(screen.getByTestId('demo-results-grid')).toBeInTheDocument();
    });

    // Check Stage Scores
    const atsPanel = screen.getByTestId('ats-result-panel');
    expect(atsPanel).toHaveTextContent('88');
    expect(atsPanel).toHaveTextContent('Candidate matches key tech stack requirements.');

    const finalReviewPanel = screen.getByTestId('final-review-panel');
    expect(finalReviewPanel).toHaveTextContent('86');

    const offerPanel = screen.getByTestId('offer-result-panel');
    expect(offerPanel).toHaveTextContent('Backend Engineer (Simulated)');

    // Check AI Telemetry Table
    expect(screen.getByTestId('ai-telemetry-card')).toBeInTheDocument();
    expect(screen.getAllByText('gemini-1.5-pro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('310 ms').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    expect(screen.getByText('440 ms')).toBeInTheDocument();
  });

  it('cleans up an individual demo session with audit reason', async () => {
    vi.mocked(adminDemoApi.cleanupDemoSession).mockResolvedValue({ deletedSessionId: 'demo-session-1' });

    renderAdminDemoPage();

    await waitFor(() => {
      expect(screen.getByTestId('cleanup-session-btn-demo-session-1')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId('cleanup-session-btn-demo-session-1');
    fireEvent.click(deleteBtn);

    // Modal opens
    expect(screen.getByTestId('cleanup-modal')).toBeInTheDocument();
    expect(screen.getByText('Clean Up Demo Session')).toBeInTheDocument();

    // Submit cleanup
    const confirmBtn = screen.getByTestId('confirm-cleanup-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminDemoApi.cleanupDemoSession).toHaveBeenCalledWith(
        'demo-session-1',
        expect.stringContaining('Admin cleaned up demo session')
      );
    });
  });

  it('purges all demo data via modal with required audit reason', async () => {
    vi.mocked(adminDemoApi.cleanupAllDemoData).mockResolvedValue({
      deletedSessionsCount: 2,
      deletedApplicationsCount: 2,
    });

    renderAdminDemoPage();

    await waitFor(() => {
      expect(screen.getByTestId('purge-all-demo-btn')).toBeInTheDocument();
    });

    const purgeBtn = screen.getByTestId('purge-all-demo-btn');
    fireEvent.click(purgeBtn);

    const modal = screen.getByTestId('cleanup-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByRole('heading', { name: /purge all demo data/i })).toBeInTheDocument();

    const reasonInput = screen.getByTestId('cleanup-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'Nightly automated sandbox cleanup' } });

    const confirmPurgeBtn = screen.getByTestId('confirm-cleanup-btn');
    fireEvent.click(confirmPurgeBtn);

    await waitFor(() => {
      expect(adminDemoApi.cleanupAllDemoData).toHaveBeenCalledWith('Nightly automated sandbox cleanup');
    });
  });
});
