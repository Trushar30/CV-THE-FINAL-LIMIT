import { apiClient } from './client';
import type { CareerDomain } from './onboarding';

export type DemoDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type DemoInterviewType = 'CONCEPTUAL' | 'CODING' | 'ARCHITECTURE' | 'BEHAVIORAL';
export type DemoSessionStatus =
  | 'INITIALIZED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CLEANED_UP';

export interface CreateDemoSessionInput {
  domain: CareerDomain;
  questionsCount?: number;
  difficulty?: DemoDifficulty;
  interviewType?: DemoInterviewType;
}

export interface DemoSessionSummary {
  _id: string;
  createdBy: string;
  applicationId: string;
  companyId: string;
  jobId: string;
  candidateUserId: string;
  domain: CareerDomain;
  difficulty: DemoDifficulty;
  questionsCount: number;
  interviewType: DemoInterviewType;
  currentStage: string;
  status: DemoSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DemoAITelemetryJob {
  _id: string;
  taskType: string;
  provider: string;
  model?: string;
  status: string;
  attempts: number;
  pool: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  createdAt: string;
}

export interface DemoInspectionResponse {
  session: DemoSessionSummary;
  application: {
    _id: string;
    currentStage: string;
    status: string;
    atsScore?: number;
    atsFeedback?: string;
    stageHistory: Array<{ stage: string; enteredAt: string; exitedAt?: string; result?: string }>;
  };
  stages: {
    ats?: {
      evaluation?: {
        score: number;
        summary: string;
        scoreBreakdown?: {
          matchedSkills?: string[];
          missingSkills?: string[];
          strengths?: string[];
          weaknesses?: string[];
        };
      };
      feedback?: {
        rejectionStage: string;
        strengths: string[];
        weaknesses: string[];
        actionableSuggestions: string[];
      };
    };
    interviews?: Array<{
      stage: string;
      interview: {
        _id: string;
        status: string;
        questionsCount: number;
        currentQuestionIndex: number;
        overallScore?: number;
      };
      questions: Array<{
        sequenceNumber: number;
        question: string;
        type: string;
        difficulty: string;
      }>;
      answers: Array<{
        answer: string;
        score?: number;
        strengths?: string[];
        weaknesses?: string[];
        notes?: string;
      }>;
    }>;
    finalReview?: {
      atsScore: number;
      screeningScore: number;
      assessmentScore: number;
      interviewScore: number;
      finalScore: number;
      isPassing: boolean;
      summary: string;
      recommendations?: string[];
    };
    offer?: {
      positionTitle: string;
      level: number;
      salarySimulated: number;
      salaryMin: number;
      salaryMax: number;
      status: string;
    };
  };
  aiTelemetry: {
    jobs: DemoAITelemetryJob[];
    recentRequests: Array<{
      _id: string;
      provider: string;
      model: string;
      taskType: string;
      latencyMs: number;
      status: string;
      promptTokens?: number;
      completionTokens?: number;
      createdAt: string;
    }>;
  };
}

export const adminDemoApi = {
  /**
   * Initializes a new demo hiring session
   */
  async createDemoSession(data: CreateDemoSessionInput): Promise<{
    session: DemoSessionSummary;
    application: unknown;
    job: unknown;
    candidate: unknown;
  }> {
    return apiClient.post('/admin/demo/hiring', data);
  },

  /**
   * Lists all existing demo hiring sessions
   */
  async listDemoSessions(): Promise<{ sessions: DemoSessionSummary[] }> {
    return apiClient.get('/admin/demo/hiring');
  },

  /**
   * Full inspection endpoint returning stage results, evaluations, and AI request logs
   */
  async getDemoSession(sessionId: string): Promise<DemoInspectionResponse> {
    return apiClient.get(`/admin/demo/hiring/${sessionId}`);
  },

  /**
   * Advances the demo hiring session by one step/stage using authoritative engine
   */
  async stepDemoSession(sessionId: string): Promise<{
    session: DemoSessionSummary;
    stage: string;
    action: string;
    result: unknown;
  }> {
    return apiClient.post(`/admin/demo/hiring/${sessionId}/step`);
  },

  /**
   * Submits candidate response to active interview chat question
   */
  async submitDemoAnswer(sessionId: string, answer: string): Promise<{
    evaluation: { score: number; strengths: string[]; weaknesses: string[]; notes: string };
    nextQuestion?: unknown;
    isCompleted: boolean;
  }> {
    return apiClient.post(`/admin/demo/hiring/${sessionId}/answer`, { answer });
  },

  /**
   * Simulates entire demo hiring lifecycle end-to-end
   */
  async simulateDemoSession(sessionId: string): Promise<{
    session: DemoSessionSummary;
    status: string;
    currentStage: string;
    history: string[];
  }> {
    return apiClient.post(`/admin/demo/hiring/${sessionId}/simulate`);
  },

  /**
   * Cleans up all data generated for a specific demo session
   */
  async cleanupDemoSession(sessionId: string, reason?: string): Promise<{ deletedSessionId: string }> {
    return apiClient.delete(`/admin/demo/hiring/${sessionId}`, {
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /**
   * System-wide purge of all demo data with audit logging
   */
  async cleanupAllDemoData(reason?: string): Promise<{
    deletedSessionsCount: number;
    deletedApplicationsCount: number;
  }> {
    return apiClient.delete('/admin/demo/hiring', {
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
