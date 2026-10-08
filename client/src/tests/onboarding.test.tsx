import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, DEFAULT_MOCK_USER } from '../store/AuthContext';
import { ProfileSetupPage } from '../pages/ProfileSetupPage';
import { onboardingApi } from '../api/onboarding';

describe('Onboarding Guided Flow Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(onboardingApi, 'getDomains').mockResolvedValue({
      domains: [
        {
          code: 'SOFTWARE_ENGINEERING',
          name: 'Software Engineering',
          description: 'Design systems',
          isActive: true,
        },
        {
          code: 'CLOUD_ENGINEERING',
          name: 'Cloud Engineering',
          description: 'Build infra',
          isActive: true,
        },
        {
          code: 'AI_ENGINEERING',
          name: 'AI Engineering',
          description: 'Train models',
          isActive: true,
        },
      ],
    });
    vi.spyOn(onboardingApi, 'getSkills').mockResolvedValue({
      skills: [
        { name: 'TypeScript', domainCode: 'SOFTWARE_ENGINEERING' },
        { name: 'Node.js', domainCode: 'SOFTWARE_ENGINEERING' },
      ],
    });
    vi.spyOn(onboardingApi, 'updateStep').mockResolvedValue({
      user: { onboardingStep: 'RESUME' },
    });
  });

  it('displays warning banner when email is not verified and handles resend action', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({ profile: null });
    vi.spyOn(onboardingApi, 'resendVerification').mockResolvedValueOnce({
      message: 'New verification link generated',
      devVerificationUrl: 'http://localhost:5173/auth/verify?token=xyz123',
    });

    const unverifiedUser = {
      ...DEFAULT_MOCK_USER,
      emailVerified: false,
      careerRole: 'NONE' as const,
      onboardingStep: 'REGISTERED',
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={unverifiedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/email verification required/i)).toBeDefined();

    const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(screen.getByText(/verification email simulated/i)).toBeDefined();
    });
  });

  it('resumes the flow from saved step DOMAIN after page refresh', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Maya Lin',
        skills: [],
      },
    });

    const savedDomainUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      onboardingStep: 'DOMAIN',
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={savedDomainUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Saved step DOMAIN means user finished DOMAIN and resumes at SKILLS (Step 3)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /step 3: technical competencies/i })
      ).toBeDefined();
    });
  });

  it('validates file extension and size during resume upload', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Maya Lin',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript', 'Node.js'],
      },
    });

    const resumeStepUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      onboardingStep: 'SKILLS', // resumes at Step 4 (Resume Upload)
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={resumeStepUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /step 4: resume upload/i })).toBeDefined();
    });

    const dropzone = screen.getByText(/drag & drop resume here/i).closest('[role="button"]')!;

    // 1. Invalid file extension (.exe)
    const invalidFile = new File(['binary'], 'malware.exe', { type: 'application/x-msdownload' });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [invalidFile] },
    });

    expect(
      screen.getByText(/only pdf \(\.pdf\) and word \(\.docx\) documents are allowed/i)
    ).toBeDefined();

    // 2. Oversized file (> 10MB)
    const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], 'giant.pdf', {
      type: 'application/pdf',
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [bigFile] },
    });

    expect(screen.getByText(/file size exceeds the 10 mb limit/i)).toBeDefined();
  });

  it('uploads valid PDF resume and transitions to processing step', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Maya Lin',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript', 'Node.js'],
      },
    });

    vi.spyOn(onboardingApi, 'uploadResume').mockResolvedValueOnce({
      resumeId: 'res_123',
      filename: 'maya_resume.pdf',
      sizeBytes: 1024 * 150,
      mimeType: 'application/pdf',
      status: 'PENDING',
    });

    vi.spyOn(onboardingApi, 'getResumeAnalysis').mockResolvedValue({
      status: 'PROCESSING',
    });

    const resumeStepUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      onboardingStep: 'SKILLS',
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={resumeStepUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /step 4: resume upload/i })).toBeDefined();
    });

    const dropzone = screen.getByText(/drag & drop resume here/i).closest('[role="button"]')!;
    const validPdf = new File(['%PDF-1.4 sample content'], 'maya_resume.pdf', {
      type: 'application/pdf',
    });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validPdf] },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /step 5: resume ingestion & ai verification/i,
        })
      ).toBeDefined();
      expect(screen.getByText(/analyzing technical qualifications/i)).toBeDefined();
    });
  });

  it('handles WAITING_FOR_PROVIDER queue state gracefully during analysis polling', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Maya Lin',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript'],
        resumeId: 'res_123',
      },
    });

    vi.spyOn(onboardingApi, 'getResumeAnalysis').mockResolvedValue({
      status: 'WAITING_FOR_PROVIDER',
      message: 'All providers busy, job enqueued',
    });

    const processingUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      onboardingStep: 'RESUME',
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={processingUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/queued for ai provider/i)).toBeDefined();
      expect(screen.getByText(/experiencing high load/i)).toBeDefined();
    });
  });

  it('handles SCANNED_UNREADABLE notice and allows manual review progression', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Maya Lin',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript'],
        resumeId: 'res_123',
      },
    });

    vi.spyOn(onboardingApi, 'getResumeAnalysis').mockResolvedValue({
      status: 'SCANNED_UNREADABLE',
      isScannedOrEmpty: true,
      message: 'No extractable text found',
    });

    const processingUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      onboardingStep: 'RESUME',
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={processingUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/scanned document notice/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /continue to final review/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue to final review/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /step 6: profile & resume verification review/i,
        })
      ).toBeDefined();
      expect(screen.getByText(/automated extraction results are not available/i)).toBeDefined();
    });
  });

  it('renders side-by-side review comparison with candidate profile and extracted resume data', async () => {
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Devon Vance',
        domain: 'CLOUD_ENGINEERING',
        skills: ['Kubernetes', 'AWS', 'Terraform'],
      },
    });

    const extractedMockResume = {
      id: 'analysis_1',
      resumeId: 'res_1',
      userId: 'usr_mock_123',
      status: 'COMPLETED',
      name: 'Devon Vance',
      contact: {
        email: 'devon@cloudinfra.io',
        phone: '+1 555-0199',
        location: 'Seattle, WA',
      },
      skills: ['Kubernetes', 'Terraform', 'Go'],
      yearsOfExperience: 5,
      domainClassification: 'CLOUD_ENGINEERING' as const,
      education: [
        {
          institution: 'University of Washington',
          degree: 'B.S.',
          fieldOfStudy: 'Computer Science',
          graduationYear: 2021,
        },
      ],
      workHistory: [
        {
          company: 'CloudWorks Inc.',
          role: 'DevOps Engineer',
          duration: '2021 - Present',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(onboardingApi, 'getResumeAnalysis').mockResolvedValue({
      status: 'COMPLETED',
      analysis: extractedMockResume,
    });

    const reviewUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      onboardingStep: 'REVIEW',
    };

    render(
      <MemoryRouter>
        <AuthProvider initialUser={reviewUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Left Column
      expect(screen.getByText('Candidate Profile Data')).toBeDefined();
      expect(screen.getAllByText('Devon Vance').length).toBe(2);
      expect(screen.getByText('Optional • Summarize your technical journey')).toBeDefined();

      // Right Column
      expect(screen.getByText('Extracted Resume Data')).toBeDefined();
      expect(screen.getByText('devon@cloudinfra.io • +1 555-0199 • Seattle, WA')).toBeDefined();
      expect(screen.getByText('University of Washington')).toBeDefined();
      expect(screen.getByText('DevOps Engineer @ CloudWorks Inc.')).toBeDefined();
    });
  });
});
