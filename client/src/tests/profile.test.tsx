import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, DEFAULT_MOCK_USER } from '../store/AuthContext';
import { ProfileSetupPage } from '../pages/ProfileSetupPage';
import { onboardingApi } from '../api/onboarding';

describe('ProfileSetupPage Wizard Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(onboardingApi, 'getProfile').mockResolvedValue({ profile: null });
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
        { name: 'PostgreSQL', domainCode: 'SOFTWARE_ENGINEERING' },
      ],
    });
    vi.spyOn(onboardingApi, 'updateStep').mockResolvedValue({
      user: { onboardingStep: 'NAME' },
    });
  });

  const unonboardedUser = {
    ...DEFAULT_MOCK_USER,
    careerRole: 'NONE' as const,
    onboardingStep: 'EMAIL_VERIFIED',
  };

  it('renders Step 1 with Display Name input', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /profile setup wizard/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /step 1: candidate display name/i })).toBeDefined();
    expect(screen.getByLabelText(/display name/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /continue to domain selection/i })).toBeDefined();
  });

  it('validates display name and progresses to Step 2 (Domain Selection)', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: 'Elena Rostova' } });

    const continueBtn = screen.getByRole('button', {
      name: /continue to domain selection/i,
    });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /step 2: choose your career domain/i })
      ).toBeDefined();
      expect(screen.getAllByText('Software Engineering').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cloud Engineering').length).toBeGreaterThan(0);
      expect(screen.getAllByText('AI Engineering').length).toBeGreaterThan(0);
    });
  });

  it('selects domain and progresses to Step 3 (Technical Skills)', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Step 1 -> Step 2
    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: 'Elena Rostova' } });
    fireEvent.click(screen.getByRole('button', { name: /continue to domain selection/i }));

    await waitFor(() => {
      expect(screen.getByText('Cloud Engineering')).toBeDefined();
    });

    // Select Cloud Engineering
    const cloudCard = screen.getByText('Cloud Engineering').closest('[role="button"]')!;
    fireEvent.click(cloudCard);

    // Click Continue to Skills
    const toSkillsBtn = screen.getByRole('button', { name: /continue to skills/i });
    fireEvent.click(toSkillsBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /step 3: technical competencies/i })
      ).toBeDefined();
    });
  });

  it('allows adding and removing skills dynamically', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Advance to Step 3
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Elena Rostova' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue to domain selection/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to skills/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue to skills/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a skill and press enter/i)).toBeDefined();
    });

    const skillInput = screen.getByPlaceholderText(/type a skill and press enter/i);
    const addSkillBtn = screen.getByRole('button', { name: /add skill/i });

    // Add custom skill
    fireEvent.change(skillInput, { target: { value: 'Rust' } });
    fireEvent.click(addSkillBtn);

    expect(screen.getByText('Rust')).toBeDefined();

    // Remove skill
    const removeBtn = screen.getByLabelText('Remove skill Rust');
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Rust')).toBeNull();
  });

  it('submits complete profile and reaches Step 7 celebratory view', async () => {
    vi.spyOn(onboardingApi, 'completeOnboarding').mockResolvedValueOnce({
      profile: {
        userId: 'usr_mock_123',
        displayName: 'Elena Rostova',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript', 'Node.js'],
      },
      user: {
        id: 'usr_mock_123',
        email: 'alex.chen@corpverse.dev',
        careerRole: 'JOB_SEEKER',
        platformRole: 'NONE',
        onboardingStep: 'COMPLETE',
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider initialUser={{ ...unonboardedUser, onboardingStep: 'REVIEW' }}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // When onboardingStep is REVIEW, should render Step 6
    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /step 6: profile & resume verification review/i,
        })
      ).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', {
      name: /create profile & activate role/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Career Role Activated!')).toBeDefined();
      expect(screen.getByRole('button', { name: /enter career hub now/i })).toBeDefined();
    });
  });

  it('displays error banner if backend display name save fails', async () => {
    vi.spyOn(onboardingApi, 'updateStep').mockRejectedValueOnce(
      new Error("Display name 'Elena Rostova' is already taken")
    );

    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: 'Elena Rostova' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to domain selection/i }));

    await waitFor(() => {
      expect(screen.getByText("Display name 'Elena Rostova' is already taken")).toBeDefined();
    });
  });
});
