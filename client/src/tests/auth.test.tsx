import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, getPostLoginRedirect, DEFAULT_MOCK_USER } from '../store/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { Sidebar } from '../components/layout/Sidebar';
import apiClient from '../api/client';

describe('Client Authentication Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LoginPage', () => {
    it('renders login form elements', () => {
      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeDefined();
      expect(screen.getByLabelText(/corporate email/i)).toBeDefined();
      expect(screen.getByLabelText(/master password/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /sign in to workspace/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /sign in as demo user/i })).toBeDefined();
    });

    it('displays error message on invalid credentials', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Invalid email or password'));

      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/corporate email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/master password/i), {
        target: { value: 'WrongPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in to workspace/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeDefined();
      });
    });

    it('displays lockout warning when account is locked', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new Error(
          'Account is temporarily locked due to failed login attempts. Please try again later.'
        )
      );

      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/corporate email/i), {
        target: { value: 'locked@corpverse.dev' },
      });
      fireEvent.change(screen.getByLabelText(/master password/i), {
        target: { value: 'Pass12345!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in to workspace/i }));

      await waitFor(() => {
        expect(screen.getByText(/account is temporarily locked/i)).toBeDefined();
      });
    });

    it('shows resend option when unverified email error occurs', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new Error('Please verify your email address before logging in.')
      );

      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/corporate email/i), {
        target: { value: 'unverified@corpverse.dev' },
      });
      fireEvent.change(screen.getByLabelText(/master password/i), {
        target: { value: 'ValidPass123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in to workspace/i }));

      await waitFor(() => {
        expect(screen.getByText(/verify your email/i)).toBeDefined();
        expect(screen.getByRole('button', { name: /resend verification link/i })).toBeDefined();
      });
    });
  });

  describe('RegisterPage', () => {
    it('renders password checklist and disables submit when criteria are not met', () => {
      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /create account/i })).toBeDefined();
      expect(screen.getByText('At least 8 characters')).toBeDefined();
      expect(screen.getByText('One uppercase letter')).toBeDefined();
      expect(screen.getByText('One numeric digit')).toBeDefined();

      const submitBtn = screen.getByRole('button', { name: /register account/i });
      expect(submitBtn.getAttribute('disabled')).not.toBeNull();
    });

    it('enables submit button when valid password and matching confirmation are entered', () => {
      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/corporate email/i), {
        target: { value: 'candidate@corpverse.dev' },
      });
      fireEvent.change(screen.getByLabelText(/^master password/i), {
        target: { value: 'ValidPass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'ValidPass123!' },
      });

      const submitBtn = screen.getByRole('button', { name: /register account/i });
      expect(submitBtn.getAttribute('disabled')).toBeNull();
    });

    it('submits registration and displays dev verification link helper', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        message: 'Registration successful. Please verify your email.',
        email: 'candidate@corpverse.dev',
        devVerificationUrl: 'http://localhost:5173/verify-email?token=devtoken123',
      });

      render(
        <MemoryRouter>
          <AuthProvider initialUser={null}>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/corporate email/i), {
        target: { value: 'candidate@corpverse.dev' },
      });
      fireEvent.change(screen.getByLabelText(/^master password/i), {
        target: { value: 'ValidPass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'ValidPass123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /register account/i }));

      await waitFor(() => {
        expect(screen.getByText('Account Initiated')).toBeDefined();
        expect(screen.getByText(/verify email address now/i)).toBeDefined();
      });
    });
  });

  describe('VerifyEmailPage', () => {
    it('executes token verification and displays success message', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        message: 'Email verified successfully',
      });

      render(
        <MemoryRouter initialEntries={['/verify-email?token=testtoken123']}>
          <AuthProvider initialUser={null}>
            <VerifyEmailPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Verification Successful!')).toBeDefined();
        expect(screen.getByRole('button', { name: /sign in to your workspace/i })).toBeDefined();
      });
    });
  });

  describe('Post-Login Redirection & Navigation Consistency', () => {
    it('redirects users to role-appropriate destinations via getPostLoginRedirect', () => {
      expect(getPostLoginRedirect(null)).toBe('/jobs');
      expect(getPostLoginRedirect({ careerRole: 'EMPLOYEE', platformRole: 'NONE' })).toBe('/workplace');
      expect(getPostLoginRedirect({ careerRole: 'FOUNDER', platformRole: 'NONE' })).toBe('/founder/dashboard');
      expect(getPostLoginRedirect({ careerRole: 'JOB_SEEKER', platformRole: 'NONE' })).toBe('/career');
      expect(getPostLoginRedirect({ careerRole: 'NONE', platformRole: 'NONE' })).toBe('/profile/setup');
      expect(getPostLoginRedirect({ careerRole: 'NONE', platformRole: 'ADMIN' })).toBe('/admin');
      expect(getPostLoginRedirect({ careerRole: 'NONE', platformRole: 'AI_MANAGER' })).toBe('/ai-ops');
    });

    it('verifies Sidebar does not render Platform Overview or UI System Showcase links', () => {
      render(
        <MemoryRouter>
          <AuthProvider initialUser={DEFAULT_MOCK_USER}>
            <Sidebar mobileOpen={false} onCloseMobile={() => {}} />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.queryByText('Platform Overview')).toBeNull();
      expect(screen.queryByText('UI System Showcase')).toBeNull();
      expect(screen.getByText('Global Leaderboards')).toBeDefined();
      expect(screen.getByText('Explore Jobs')).toBeDefined();
    });
  });
});
