import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ApplicationsTrackerPage } from '../pages/career/ApplicationsTrackerPage';
import { StageChatPage } from '../pages/career/StageChatPage';
import { OfferPage } from '../pages/career/OfferPage';
import { FeedbackModal } from '../components/career/FeedbackModal';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { careerApi, type ApplicationListItem, type RejectionFeedback } from '../api/career';
import { notificationsApi } from '../api/notifications';
import { AuthProvider } from '../store/AuthContext';

vi.mock('../api/career', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/career')>();
  return {
    ...actual,
    careerApi: {
      ...actual.careerApi,
      getApplications: vi.fn(),
      getApplication: vi.fn(),
      getApplicationFeedback: vi.fn(),
      withdrawApplication: vi.fn(),
      getStageSession: vi.fn(),
      submitStageAnswer: vi.fn(),
      getOffer: vi.fn(),
      negotiateOffer: vi.fn(),
      acceptOffer: vi.fn(),
      declineOffer: vi.fn(),
    },
  };
});

vi.mock('../api/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/notifications')>();
  return {
    ...actual,
    notificationsApi: {
      ...actual.notificationsApi,
      getNotifications: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
    },
  };
});

const mockActiveApp: ApplicationListItem = {
  _id: 'app-active-1',
  userId: 'user-1',
  companyId: {
    _id: 'comp-1',
    name: 'Nexus Corp',
    type: 'PLATFORM',
    companyRating: 4.8,
  },
  jobId: {
    _id: 'job-1',
    title: 'Senior Distributed Engineer',
    domain: 'SOFTWARE_ENGINEERING',
    minLevel: 7,
    maxLevel: 8,
    openings: 2,
    status: 'OPEN',
  },
  mode: 'PRODUCTION',
  currentStage: 'SCREENING',
  status: 'ACTIVE',
  stageHistory: [{ stage: 'APPLIED', enteredAt: '2026-10-09T10:00:00Z' }],
  createdAt: '2026-10-09T10:00:00Z',
  updatedAt: '2026-10-09T10:05:00Z',
};

const mockRejectedApp: ApplicationListItem = {
  _id: 'app-rejected-2',
  userId: 'user-1',
  companyId: {
    _id: 'comp-2',
    name: 'CloudScale Inc',
    type: 'PLATFORM',
    companyRating: 4.6,
  },
  jobId: {
    _id: 'job-2',
    title: 'Cloud Architect',
    domain: 'CLOUD_ENGINEERING',
    minLevel: 8,
    maxLevel: 9,
    openings: 1,
    status: 'OPEN',
  },
  mode: 'PRODUCTION',
  currentStage: 'ATS_SCREENING',
  status: 'REJECTED',
  atsScore: 62,
  stageHistory: [{ stage: 'APPLIED', enteredAt: '2026-10-08T10:00:00Z' }],
  createdAt: '2026-10-08T10:00:00Z',
  updatedAt: '2026-10-08T10:05:00Z',
};

const mockFeedback: RejectionFeedback = {
  _id: 'fb-1',
  applicationId: 'app-rejected-2',
  userId: 'user-1',
  rejectionStage: 'ATS_SCREENING',
  strengths: ['Strong Go concurrency background', 'Clean Git workflow'],
  weaknesses: ['Insufficient multi-region Terraform infrastructure experience'],
  actionableSuggestions: ['Build a multi-region VPC Peering proof of concept', 'Practice AWS CDK'],
  missingSkills: ['Terraform', 'Kubernetes Helm'],
  createdAt: '2026-10-08T10:05:00Z',
};

describe('Hiring Journey Frontend Suite (TASK P6.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Applications Tracker Page (/applications)', () => {
    it('renders active quota widget with x/5 count and application cards', async () => {
      vi.mocked(careerApi.getApplications).mockResolvedValueOnce({
        applications: [mockActiveApp, mockRejectedApp],
        total: 2,
        page: 1,
        limit: 50,
      });

      render(
        <MemoryRouter>
          <ApplicationsTrackerPage />
        </MemoryRouter>
      );

      // Quota counter
      await waitFor(() => {
        expect(screen.getByTestId('quota-counter')).toHaveTextContent('1 / 5');
      });

      // Role titles & companies
      expect(screen.getByText('Senior Distributed Engineer')).toBeInTheDocument();
      expect(screen.getByText('Nexus Corp')).toBeInTheDocument();
      expect(screen.getByText('Cloud Architect')).toBeInTheDocument();

      // Badges
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();

      // Continue interview button
      expect(screen.getByTestId('continue-interview-btn')).toBeInTheDocument();
    });

    it('handles application withdrawal workflow with confirmation dialog', async () => {
      vi.mocked(careerApi.getApplications).mockResolvedValue({
        applications: [mockActiveApp],
        total: 1,
        page: 1,
        limit: 50,
      });
      vi.mocked(careerApi.withdrawApplication).mockResolvedValueOnce({
        application: { ...mockActiveApp, status: 'WITHDRAWN' },
      });

      render(
        <MemoryRouter>
          <ApplicationsTrackerPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('withdraw-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('withdraw-btn'));

      // Withdraw modal pops up
      expect(screen.getByTestId('withdraw-modal')).toBeInTheDocument();

      const confirmBtn = screen.getByTestId('confirm-withdraw-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(careerApi.withdrawApplication).toHaveBeenCalledWith('app-active-1', '');
      });
    });

    it('opens rejection feedback modal when viewing feedback for rejected application', async () => {
      vi.mocked(careerApi.getApplications).mockResolvedValueOnce({
        applications: [mockRejectedApp],
        total: 1,
        page: 1,
        limit: 50,
      });
      vi.mocked(careerApi.getApplicationFeedback).mockResolvedValueOnce({
        feedback: mockFeedback,
      });

      render(
        <MemoryRouter>
          <ApplicationsTrackerPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('view-feedback-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('view-feedback-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
        expect(screen.getByTestId('feedback-missing-skills')).toBeInTheDocument();
        expect(screen.getByText('Terraform')).toBeInTheDocument();
        expect(screen.getByText(/Strong Go concurrency background/)).toBeInTheDocument();
      });
    });
  });

  describe('2. Feedback Viewer Modal (FeedbackModal)', () => {
    it('renders diagnostic strengths, weaknesses, and missing skills accurately', () => {
      const onClose = vi.fn();

      render(
        <FeedbackModal
          isOpen={true}
          onClose={onClose}
          feedback={mockFeedback}
          companyName="CloudScale Inc"
          jobTitle="Cloud Architect"
        />
      );

      expect(screen.getByText('Stage Diagnostic Feedback')).toBeInTheDocument();
      expect(screen.getByText('ATS SCREENING')).toBeInTheDocument();
      expect(screen.getByText('Cloud Architect at CloudScale Inc')).toBeInTheDocument();

      // Missing competencies
      expect(screen.getByText('Kubernetes Helm')).toBeInTheDocument();

      // Actionable recommendations
      expect(screen.getByText(/Build a multi-region VPC Peering/)).toBeInTheDocument();
    });
  });

  describe('3. Stage Chat Interface (StageChatPage)', () => {
    it('renders active question, handles candidate submission and evaluation score display', async () => {
      vi.mocked(careerApi.getApplication).mockResolvedValueOnce({
        application: mockActiveApp,
      });
      vi.mocked(careerApi.getStageSession).mockResolvedValueOnce({
        interview: {
          _id: 'int-1',
          stage: 'SCREENING',
          status: 'IN_PROGRESS',
          questionsCount: 3,
          currentQuestionIndex: 1,
        },
        currentQuestion: {
          question: 'How do you design a high-throughput event buffer using Kafka?',
          type: 'SYSTEM_DESIGN',
          difficulty: 'MEDIUM',
          expectedPoints: ['Partitioning strategy', 'Replication factor'],
        },
        previousAnswers: [],
        isCompleted: false,
        isWaitingAI: false,
      });

      vi.mocked(careerApi.submitStageAnswer).mockResolvedValueOnce({
        evaluation: {
          score: 88,
          strengths: ['Accurate partition key explanation'],
          weaknesses: ['Could mention consumer lag monitoring'],
          notes: 'Solid understanding of distributed message queue trade-offs.',
        },
        nextQuestion: {
          question: 'What is the role of consumer group rebalancing protocols?',
          type: 'ARCHITECTURE',
          difficulty: 'MEDIUM',
          expectedPoints: ['Eager vs Cooperative Sticky'],
        },
        isCompleted: false,
      });

      render(
        <MemoryRouter initialEntries={['/applications/app-active-1/stage']}>
          <Routes>
            <Route path="/applications/:id/stage" element={<StageChatPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Question rendered
      await waitFor(() => {
        expect(
          screen.getByText(/How do you design a high-throughput event buffer using Kafka/)
        ).toBeInTheDocument();
      });

      // Submit input
      const input = screen.getByTestId('stage-answer-input');
      const submitBtn = screen.getByTestId('stage-submit-btn');

      // Double-submission guard: disabled when empty
      expect(submitBtn).toBeDisabled();

      fireEvent.change(input, {
        target: {
          value:
            'I would partition the topic by user ID and ensure adequate consumer group parallelism.',
        },
      });

      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      // Submitting calls API and renders evaluation score
      await waitFor(() => {
        expect(careerApi.submitStageAnswer).toHaveBeenCalledWith(
          'app-active-1',
          'I would partition the topic by user ID and ensure adequate consumer group parallelism.',
          1
        );
        expect(screen.getByText('Score: 88/100')).toBeInTheDocument();
        expect(
          screen.getByText(/What is the role of consumer group rebalancing protocols/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('4. Offer Review & Negotiation Page (OfferPage)', () => {
    it('renders compensation terms, executes salary counter-offer, and accepts offer', async () => {
      const mockOffer = {
        positionTitle: 'Staff Software Engineer',
        level: 8,
        salarySimulated: 240000,
        salaryMin: 230000,
        salaryMax: 280000,
        negotiationRoundsLeft: 2,
        maxNegotiationRounds: 3,
        negotiationHistory: [],
        status: 'OFFERED' as const,
      };

      vi.mocked(careerApi.getApplication).mockResolvedValueOnce({
        application: mockActiveApp,
      });
      vi.mocked(careerApi.getOffer).mockResolvedValueOnce({
        offer: mockOffer,
      });

      vi.mocked(careerApi.negotiateOffer).mockResolvedValueOnce({
        offer: {
          ...mockOffer,
          salarySimulated: 255000,
          negotiationRoundsLeft: 1,
          negotiationHistory: [
            {
              round: 1,
              candidateMessage: 'I bring deep systems expertise, requesting $260k.',
              requestedSalary: 260000,
              aiResponse: 'We can meet you at $255,000 given your strong evaluation performance.',
              counterOfferSalary: 255000,
              timestamp: '2026-10-09T11:00:00Z',
            },
          ],
        },
        counterOfferSalary: 255000,
        negotiationRoundsLeft: 1,
      });

      vi.mocked(careerApi.acceptOffer).mockResolvedValueOnce({
        application: { ...mockActiveApp, status: 'ACCEPTED' },
        employee: { _id: 'emp-1' },
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/applications/app-active-1/offer']}>
            <Routes>
              <Route path="/applications/:id/offer" element={<OfferPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('$240,000')).toBeInTheDocument();
        expect(screen.getByTestId('rounds-left-pill')).toHaveTextContent('2 rounds remaining');
      });

      // Submit Negotiation Counter-Offer
      const msgInput = screen.getByTestId('negotiation-message-input');
      const salaryInput = screen.getByTestId('negotiation-salary-input');
      const counterBtn = screen.getByTestId('submit-negotiation-btn');

      fireEvent.change(msgInput, {
        target: { value: 'I bring deep systems expertise, requesting $260k.' },
      });
      fireEvent.change(salaryInput, { target: { value: '260000' } });

      fireEvent.click(counterBtn);

      await waitFor(() => {
        expect(careerApi.negotiateOffer).toHaveBeenCalledWith(
          'app-active-1',
          'I bring deep systems expertise, requesting $260k.',
          260000
        );
        expect(screen.getByText('Adjusted: $255,000')).toBeInTheDocument();
      });

      // Accept Offer
      const acceptBtn = screen.getByTestId('accept-offer-btn');
      fireEvent.click(acceptBtn);

      const confirmAcceptBtn = screen.getByTestId('confirm-accept-btn');
      fireEvent.click(confirmAcceptBtn);

      await waitFor(() => {
        expect(careerApi.acceptOffer).toHaveBeenCalledWith('app-active-1');
        expect(screen.getByTestId('offer-accepted-celebration')).toBeInTheDocument();
        expect(screen.getByText(/Congratulations! You are officially hired/)).toBeInTheDocument();
      });
    });
  });

  describe('5. Notifications Bell (NotificationBell)', () => {
    it('renders unread badge and marks notifications read on interaction', async () => {
      const mockNotifications = [
        {
          _id: 'notif-1',
          userId: 'user-1',
          type: 'STAGE_ADVANCED',
          title: 'Stage Advanced',
          message: 'You advanced to Assessment stage.',
          isRead: false,
          link: '/applications/app-active-1',
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(notificationsApi.getNotifications).mockResolvedValueOnce({
        notifications: mockNotifications,
        unreadCount: 1,
        total: 1,
        page: 1,
        limit: 15,
      });

      const targetNotif = mockNotifications[0]!;
      vi.mocked(notificationsApi.markRead).mockResolvedValueOnce({
        notification: { ...targetNotif, isRead: true },
      });

      render(
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
      });

      // Click bell button to open popover
      const bellBtn = screen.getByRole('button', { name: /Notifications/ });
      fireEvent.click(bellBtn);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('You advanced to Assessment stage.')).toBeInTheDocument();

      // Click item
      const item = screen.getByTestId('notification-item-notif-1');
      fireEvent.click(item);

      await waitFor(() => {
        expect(notificationsApi.markRead).toHaveBeenCalledWith('notif-1');
      });
    });
  });
});
