import { apiClient } from './client';

export type CareerDomain = 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';

export interface DomainItem {
  id?: string;
  code: CareerDomain;
  name: string;
  description: string;
  isActive: boolean;
}

export interface SkillItem {
  id?: string;
  name: string;
  domainCode: CareerDomain;
  category?: string;
}

export interface CandidateProfile {
  _id?: string;
  userId: string;
  displayName: string;
  domain?: CareerDomain;
  skills: string[];
  resumeId?: string;
  resumeAnalysisId?: string;
  bio?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  projects?: Array<{
    title: string;
    description: string;
    techStack?: string[];
    link?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    issueDate?: string;
    credentialId?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumeUploadResult {
  resumeId: string;
  analysisId?: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  checksum?: string;
  status: string;
  message?: string;
}

export interface ExtractedResumeData {
  id: string;
  resumeId: string;
  userId: string;
  status: string;
  name?: string;
  contact?: {
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedin?: string | null;
    github?: string | null;
    website?: string | null;
  };
  skills: string[];
  yearsOfExperience: number;
  domainClassification: CareerDomain;
  summary?: string;
  education?: Array<{
    institution: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
    graduationYear?: string | number | null;
  }>;
  workHistory?: Array<{
    company: string;
    role: string;
    duration?: string | null;
    description?: string | null;
    highlights?: string[];
  }>;
  projects?: Array<{
    title: string;
    description?: string | null;
    techStack?: string[];
    link?: string | null;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string | null;
    year?: string | number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeAnalysisResponse {
  status:
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'SCANNED_UNREADABLE'
    | 'WAITING_FOR_PROVIDER';
  isScannedOrEmpty?: boolean;
  message?: string;
  failureReason?: string;
  jobId?: string;
  jobAttempts?: number;
  analysis?: ExtractedResumeData | null;
}

export type OnboardingStepPayload =
  | { step: 'NAME'; displayName: string }
  | { step: 'DOMAIN'; domain: CareerDomain }
  | { step: 'SKILLS'; skills: string[] }
  | { step: 'RESUME'; resumeId?: string }
  | {
      step: 'REVIEW';
      bio?: string;
      githubUrl?: string;
      linkedinUrl?: string;
      portfolioUrl?: string;
    }
  | { step: 'COMPLETE' };

export const onboardingApi = {
  /**
   * Fetches current candidate profile
   */
  async getProfile(): Promise<{ profile: CandidateProfile | null; user?: unknown }> {
    return apiClient.get('/profile/me');
  },

  /**
   * Fetches catalog of active domains
   */
  async getDomains(): Promise<{ domains: DomainItem[] }> {
    return apiClient.get('/domains');
  },

  /**
   * Fetches list of verified skills for a domain
   */
  async getSkills(domainCode?: CareerDomain): Promise<{ skills: SkillItem[] }> {
    return apiClient.get('/skills', { params: domainCode ? { domainCode } : undefined });
  },

  /**
   * Updates an onboarding step and advances user.onboardingStep
   */
  async updateStep(payload: OnboardingStepPayload): Promise<{ user: { onboardingStep: string } }> {
    return apiClient.patch('/profile/step', payload);
  },

  /**
   * Uploads candidate resume via multipart/form-data
   */
  async uploadResume(file: File): Promise<ResumeUploadResult> {
    const formData = new FormData();
    formData.append('resume', file);
    return apiClient.upload<ResumeUploadResult>('/profile/resume/upload', formData);
  },

  /**
   * Polls or gets the current resume analysis status and parsed data
   */
  async getResumeAnalysis(): Promise<ResumeAnalysisResponse> {
    return apiClient.get<ResumeAnalysisResponse>('/profile/resume/analysis');
  },

  /**
   * Completes onboarding authoritatively, setting careerRole = 'JOB_SEEKER'
   */
  async completeOnboarding(): Promise<{ profile: CandidateProfile; user: unknown }> {
    return apiClient.post('/profile/complete-onboarding');
  },

  /**
   * Resends email verification code/link
   */
  async resendVerification(
    email: string
  ): Promise<{ message: string; devVerificationUrl?: string }> {
    return apiClient.post('/auth/resend-verification', { email });
  },
};
