import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, DEFAULT_MOCK_USER } from '../store/AuthContext';
import { ProfileSetupPage } from '../pages/ProfileSetupPage';
import apiClient from '../api/client';

describe('ProfileSetupPage Wizard Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const unonboardedUser = {
    ...DEFAULT_MOCK_USER,
    careerRole: 'NONE' as const,
    onboardingStep: 'EMAIL_VERIFIED',
  };

  it('renders Step 1 with all 3 career domains', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /profile setup wizard/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Software Engineering' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Cloud Engineering' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'AI Engineering' })).toBeDefined();
    expect(screen.getByRole('button', { name: /continue to profile details/i })).toBeDefined();
  });

  it('selects domain and progresses to Step 2', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Click on Cloud Engineering card
    const cloudCard = screen.getByText('Cloud Engineering').closest('[role="button"]')!;
    fireEvent.click(cloudCard);

    // Click continue
    fireEvent.click(screen.getByRole('button', { name: /continue to profile details/i }));

    // Verify step 2 credentials card is rendered
    expect(screen.getByRole('heading', { name: /step 2: candidate credentials/i })).toBeDefined();
    expect(screen.getByLabelText(/display name/i)).toBeDefined();
  });

  it('allows adding and removing skills dynamically', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Proceed to Step 2
    fireEvent.click(screen.getByRole('button', { name: /continue to profile details/i }));

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

  it('submits profile and reaches Step 3 celebratory view', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      profile: {
        displayName: 'Elena Rostova',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript', 'Node.js'],
      },
      user: {
        id: 'usr_mock_123',
        email: 'alex.chen@corpverse.dev',
        careerRole: 'JOB_SEEKER',
        platformRole: 'NONE',
        onboardingStep: 'PROFILE_COMPLETED',
        totalExp: 0,
        corpCoinBalance: 0,
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /continue to profile details/i }));

    // Fill Display Name
    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: 'Elena Rostova' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /complete profile setup/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Career Role Activated!')).toBeDefined();
      expect(screen.getByText('Congratulations, Elena Rostova!')).toBeDefined();
      expect(screen.getByRole('button', { name: /enter career hub now/i })).toBeDefined();
    });
  });

  it('displays error banner if backend profile setup fails', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new Error('Profile has already been configured for this account')
    );

    render(
      <MemoryRouter>
        <AuthProvider initialUser={unonboardedUser}>
          <ProfileSetupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /continue to profile details/i }));

    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: 'Elena Rostova' } });

    fireEvent.click(screen.getByRole('button', { name: /complete profile setup/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Profile has already been configured for this account')
      ).toBeDefined();
    });
  });
});
