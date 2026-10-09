import { apiClient } from './client';
import type { CareerDomain } from './onboarding';

export type { CareerDomain };

export type CompanyType = 'PLATFORM' | 'FOUNDER';
export type CompanyStatus = 'ACTIVE' | 'BANKRUPT' | 'SUSPENDED';
export type JobStatus = 'OPEN' | 'CLOSED';

export interface CompanyRatings {
  overall: number;
  culture: number;
  workLife: number;
  technicalExcellence: number;
  reviewCount: number;
}

export interface CompanyListItem {
  _id: string;
  type: CompanyType;
  isPlatformCompany: boolean;
  name: string;
  description?: string;
  domainsHired: CareerDomain[];
  status: CompanyStatus;
  ratings: CompanyRatings;
  companyRating: number;
  employeeCount: number;
  maxEmployees: number;
  openJobCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyJobSummary {
  _id: string;
  companyId: string;
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyDetails extends CompanyListItem {
  financialHealth: number;
  aiProviderPool?: string;
}

export interface CompanyWithJobsResponse {
  company: CompanyDetails;
  openJobs: CompanyJobSummary[];
}

export interface JobListItem {
  _id: string;
  companyId: {
    _id: string;
    name: string;
    type: CompanyType;
    companyRating: number;
    ratings?: CompanyRatings;
    status: CompanyStatus;
  };
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobDetails {
  _id: string;
  companyId: {
    _id: string;
    name: string;
    type: CompanyType;
    companyRating: number;
    ratings?: CompanyRatings;
    status: CompanyStatus;
    description?: string;
    domainsHired?: CareerDomain[];
    employeeCount?: number;
    maxEmployees?: number;
  };
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListCompaniesParams {
  domain?: CareerDomain | string;
  type?: CompanyType | string;
  status?: CompanyStatus | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListJobsParams {
  domain?: CareerDomain | string;
  minLevel?: number;
  maxLevel?: number;
  companyId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export type ApplicationStage =
  | 'APPLIED'
  | 'ATS_SCREENING'
  | 'SCREENING'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'FINAL_REVIEW'
  | 'OFFER'
  | 'ACCEPTED';

export type ApplicationStatus =
  | 'ACTIVE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED';

export type ApplicationMode = 'PRODUCTION' | 'DEMO';

export interface StageHistoryEntry {
  stage: ApplicationStage;
  enteredAt: string;
  exitedAt?: string;
  result?: string;
}

export interface ApplicationListItem {
  _id: string;
  userId: string;
  companyId: {
    _id: string;
    name: string;
    type: CompanyType;
    companyRating: number;
    description?: string;
  };
  jobId: {
    _id: string;
    title: string;
    domain: CareerDomain;
    minLevel: number;
    maxLevel: number;
    openings: number;
    status: JobStatus;
    requiredSkills?: string[];
  };
  mode: ApplicationMode;
  currentStage: ApplicationStage;
  status: ApplicationStatus;
  atsScore?: number;
  atsFeedback?: string;
  stageHistory: StageHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RejectionFeedback {
  _id: string;
  applicationId: string;
  userId: string;
  rejectionStage: ApplicationStage;
  strengths: string[];
  weaknesses: string[];
  actionableSuggestions: string[];
  missingSkills?: string[];
  createdAt: string;
}

export interface StageInterviewQuestion {
  question: string;
  type: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  expectedPoints: string[];
}

export interface StageInterviewAnswer {
  answer: string;
  score?: number;
  strengths?: string[];
  weaknesses?: string[];
  notes?: string;
  questionSequence?: number;
  evaluatedAt?: string;
}

export interface StageSessionData {
  interview: {
    _id: string;
    stage: ApplicationStage;
    status: string;
    questionsCount: number;
    currentQuestionIndex: number;
    passingScore?: number;
  };
  currentQuestion: StageInterviewQuestion | null;
  previousAnswers: StageInterviewAnswer[];
  isCompleted: boolean;
  isWaitingAI: boolean;
}

export interface SubmitStageAnswerResponse {
  evaluation: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    notes: string;
  };
  nextQuestion?: StageInterviewQuestion | null;
  isCompleted: boolean;
  passed?: boolean;
  overallScore?: number;
  nextStage?: ApplicationStage;
}

export interface OfferNegotiationEntry {
  round: number;
  candidateMessage: string;
  requestedSalary?: number;
  aiResponse: string;
  counterOfferSalary?: number;
  timestamp: string;
}

export interface ApplicationOfferData {
  positionTitle: string;
  level: number;
  salarySimulated: number;
  salaryMin: number;
  salaryMax: number;
  negotiationRoundsLeft: number;
  maxNegotiationRounds: number;
  negotiationHistory: OfferNegotiationEntry[];
  status: 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
}

export interface ListApplicationsParams {
  status?: ApplicationStatus | string;
  currentStage?: ApplicationStage | string;
  jobId?: string;
  companyId?: string;
  page?: number;
  limit?: number;
}

export interface ApplicationsResponse {
  applications: ApplicationListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ApplicationDetailResponse {
  application: ApplicationListItem;
  evaluations?: Array<{
    stage: ApplicationStage;
    score: number;
    scoreBreakdown?: {
      missingSkills?: string[];
      matchedSkills?: string[];
      strengths?: string[];
      weaknesses?: string[];
      improvementSuggestions?: string[];
    };
    summary: string;
  }>;
  feedback?: RejectionFeedback;
}

export const careerApi = {
  /**
   * List/search companies with domain filter, search keyword, and pagination.
   */
  async getCompanies(params?: ListCompaniesParams): Promise<CompanyListItem[]> {
    return apiClient.get<CompanyListItem[]>('/companies', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get company details by ID along with its active job openings.
   */
  async getCompany(id: string): Promise<CompanyWithJobsResponse> {
    return apiClient.get<CompanyWithJobsResponse>(`/companies/${id}`);
  },

  /**
   * List/search open jobs with domain, level, and keyword filters.
   */
  async getJobs(params?: ListJobsParams): Promise<JobListItem[]> {
    return apiClient.get<JobListItem[]>('/jobs', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get single job details by ID populated with company summary.
   */
  async getJob(id: string): Promise<JobDetails> {
    return apiClient.get<JobDetails>(`/jobs/${id}`);
  },

  /**
   * List candidate's applications with active and terminal filters.
   */
  async getApplications(params?: ListApplicationsParams): Promise<ApplicationsResponse> {
    return apiClient.get<ApplicationsResponse>('/applications', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get single application details populated with evaluation history.
   */
  async getApplication(id: string): Promise<ApplicationDetailResponse> {
    return apiClient.get<ApplicationDetailResponse>(`/applications/${id}`);
  },

  /**
   * Submit an application for an open position.
   */
  async applyJob(jobId: string): Promise<{ application: ApplicationListItem }> {
    return apiClient.post<{ application: ApplicationListItem }>('/applications', { jobId });
  },

  /**
   * Voluntarily withdraw an active application.
   */
  async withdrawApplication(id: string, reason?: string): Promise<{ application: ApplicationListItem }> {
    return apiClient.post<{ application: ApplicationListItem }>(`/applications/${id}/withdraw`, {
      reason,
    });
  },

  /**
   * View stored rejection feedback for a rejected application.
   */
  async getApplicationFeedback(id: string): Promise<{ feedback: RejectionFeedback }> {
    return apiClient.get<{ feedback: RejectionFeedback }>(`/applications/${id}/feedback`);
  },

  /**
   * Get current chat stage session, active question, and dialogue history.
   */
  async getStageSession(id: string): Promise<StageSessionData> {
    return apiClient.get<StageSessionData>(`/applications/${id}/stage`);
  },

  /**
   * Submit candidate answer for current interview question.
   */
  async submitStageAnswer(
    id: string,
    answer: string,
    questionSequence?: number
  ): Promise<SubmitStageAnswerResponse> {
    return apiClient.post<SubmitStageAnswerResponse>(`/applications/${id}/stage/messages`, {
      answer,
      questionSequence,
    });
  },

  /**
   * View the employment offer details for an application.
   */
  async getOffer(id: string): Promise<{ offer: ApplicationOfferData }> {
    return apiClient.get<{ offer: ApplicationOfferData }>(`/applications/${id}/offer`);
  },

  /**
   * Submits a candidate negotiation turn.
   */
  async negotiateOffer(
    id: string,
    message: string,
    requestedSalary?: number
  ): Promise<{
    offer: ApplicationOfferData;
    counterOfferSalary?: number;
    negotiationRoundsLeft: number;
    message?: string;
  }> {
    return apiClient.post<{
      offer: ApplicationOfferData;
      counterOfferSalary?: number;
      negotiationRoundsLeft: number;
      message?: string;
    }>(`/applications/${id}/offer/negotiate`, {
      message,
      requestedSalary,
    });
  },

  /**
   * Atomically accepts an employment offer.
   */
  async acceptOffer(id: string): Promise<{ application: ApplicationListItem; employee: unknown }> {
    return apiClient.post<{ application: ApplicationListItem; employee: unknown }>(
      `/applications/${id}/offer/accept`
    );
  },

  /**
   * Declines an employment offer.
   */
  async declineOffer(
    id: string,
    reason?: string
  ): Promise<{ application: ApplicationListItem }> {
    return apiClient.post<{ application: ApplicationListItem }>(
      `/applications/${id}/offer/decline`,
      { reason }
    );
  },
};

