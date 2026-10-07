import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast/ToastContext';
import { AiManagerPage } from '../pages/AiManagerPage';
import { AdminAiHealthPage } from '../pages/AdminAiHealthPage';
import { aiOpsApi, type HealthAndUsageDto } from '../api/aiOps';

const mockHealthUsageData: HealthAndUsageDto = {
  providers: [
    {
      id: 'prov-1',
      code: 'gemini',
      name: 'Google Gemini Pro',
      priority: 1,
      pool: 'PIPELINE',
      status: 'HEALTHY',
      modelId: 'gemini-1.5-pro',
      maskedApiKey: 'AQ••••••••8Q',
      rateLimitRpm: 60,
      dailyLimit: 5000,
      dailyRequests: 120,
      consecutiveFailures: 0,
      totalRequests: 250,
      totalFailures: 2,
      averageLatencyMs: 145,
      lastSuccessAt: new Date().toISOString(),
      lastFailureAt: null,
      lastFailureReason: null,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: 'prov-2',
      code: 'openai',
      name: 'OpenAI GPT-4o',
      priority: 2,
      pool: 'PIPELINE',
      status: 'DEGRADED',
      modelId: 'gpt-4o-mini',
      maskedApiKey: 'sk-••••••••2UA',
      rateLimitRpm: 60,
      dailyLimit: 5000,
      dailyRequests: 50,
      consecutiveFailures: 1,
      totalRequests: 80,
      totalFailures: 5,
      averageLatencyMs: 230,
      lastSuccessAt: new Date().toISOString(),
      lastFailureAt: new Date().toISOString(),
      lastFailureReason: 'Upstream rate limit',
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: 'prov-3',
      code: 'groq',
      name: 'Groq LPU Engine',
      priority: 3,
      pool: 'PIPELINE',
      status: 'DISABLED',
      modelId: 'llama-3.3-70b-versatile',
      maskedApiKey: 'gsk_••••••••0Mm',
      rateLimitRpm: 60,
      dailyLimit: 5000,
      dailyRequests: 0,
      consecutiveFailures: 0,
      totalRequests: 10,
      totalFailures: 0,
      averageLatencyMs: 85,
      lastSuccessAt: new Date().toISOString(),
      lastFailureAt: null,
      lastFailureReason: null,
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  queueStats: {
    depth: 4,
    pending: 2,
    retrying: 1,
    processing: 1,
    waitingForProvider: 0,
    completed: 45,
    failed: 3,
    total: 52,
  },
  recentHealthLogs: [
    {
      _id: 'hl-1',
      provider: 'openai',
      pool: 'PIPELINE',
      status: 'DEGRADED',
      previousStatus: 'HEALTHY',
      latencyMs: 310,
      errorMessage: 'Rate limit 429 received',
      timestamp: new Date().toISOString(),
    },
  ],
  recentResponses: [
    {
      _id: 'resp-1',
      provider: 'gemini',
      pool: 'PIPELINE',
      model: 'gemini-1.5-pro',
      durationMs: 145,
      tokensTotal: 520,
      createdAt: new Date().toISOString(),
    },
  ],
};

function renderWithToast(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

describe('AI Operations Frontend Suite (TASK P3.7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AiManagerPage Console', () => {
    it('renders provider list, queue telemetry, status badges and masked keys', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValueOnce(mockHealthUsageData);

      renderWithToast(<AiManagerPage />);

      // Telemetry metrics
      await waitFor(() => {
        expect(screen.getByText('Queue Depth')).toBeDefined();
        expect(screen.getByText('4')).toBeDefined(); // depth
        expect(screen.getByText('Waiting for Provider')).toBeDefined();
        expect(screen.getByText('Active Providers')).toBeDefined();
      });

      // Providers list
      expect(screen.getAllByText('Google Gemini Pro').length).toBeGreaterThan(0);
      expect(screen.getAllByText('OpenAI GPT-4o').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Groq LPU Engine').length).toBeGreaterThan(0);

      // Status badges
      expect(screen.getAllByText('HEALTHY').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DEGRADED/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DISABLED/).length).toBeGreaterThan(0);

      // Masked keys (strict security verification)
      expect(screen.getByText('AQ••••••••8Q')).toBeDefined();
      expect(screen.getByText('sk-••••••••2UA')).toBeDefined();
      expect(screen.getByText('gsk_••••••••0Mm')).toBeDefined();

      // Telemetry charts
      expect(screen.getByText('Traffic Volume by Provider')).toBeDefined();
      expect(screen.getByText('Error Rate & Circuit Status')).toBeDefined();
    });

    it('handles pool switching between PIPELINE and DEMO', async () => {
      const getSpy = vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValue(mockHealthUsageData);

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Google Gemini Pro').length).toBeGreaterThan(0);
      });

      // Switch to Demo Pool
      fireEvent.click(screen.getByRole('button', { name: /demo pool/i }));

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith('DEMO');
      });
    });

    it('opens Add Provider modal and submits valid configuration with reason', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValue(mockHealthUsageData);
      const createSpy = vi.spyOn(aiOpsApi, 'createProvider').mockResolvedValueOnce({
        provider: {
          ...mockHealthUsageData.providers[0]!,
          id: 'prov-new',
        },
      });

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Google Gemini Pro').length).toBeGreaterThan(0);
      });

      // Open Add Modal
      fireEvent.click(screen.getByRole('button', { name: /\+ add provider/i }));

      expect(screen.getByText('Register AI Provider Adapter')).toBeDefined();

      // Fill audit reason
      fireEvent.change(
        screen.getByPlaceholderText(/why are you registering this provider adapter\?/i),
        { target: { value: 'Adding secondary OpenAI redundancy adapter' } }
      );

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /save provider/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'gemini',
            reason: 'Adding secondary OpenAI redundancy adapter',
          })
        );
      });
    });

    it('opens Edit Provider modal with pre-populated values', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValue(mockHealthUsageData);

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Google Gemini Pro').length).toBeGreaterThan(0);
      });

      // Click Edit on Gemini
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      fireEvent.click(editButtons[0]!);

      expect(screen.getByText('Edit Google Gemini Pro')).toBeDefined();
      expect(screen.getByDisplayValue('gemini-1.5-pro')).toBeDefined();
    });

    it('requests audit reason when adjusting priority reorder', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValue(mockHealthUsageData);
      const updateSpy = vi.spyOn(aiOpsApi, 'updateProvider').mockResolvedValueOnce({
        provider: mockHealthUsageData.providers[1]!,
      });

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getAllByText('OpenAI GPT-4o').length).toBeGreaterThan(0);
      });

      // Click priority Up button on OpenAI (priority 2 -> 1)
      const upButtons = screen.getAllByRole('button', { name: '▲' });
      fireEvent.click(upButtons[1]!); // OpenAI Up button

      expect(screen.getByText('Confirm Priority Reorder')).toBeDefined();

      // Provide audit reason
      fireEvent.change(
        screen.getByPlaceholderText(
          /state the reason for this action for compliance audit logs\.\.\./i
        ),
        { target: { value: 'Promoting OpenAI to primary due to Gemini maintenance' } }
      );

      fireEvent.click(screen.getByRole('button', { name: /confirm action/i }));

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'openai',
          expect.objectContaining({
            priority: 1,
            reason: 'Promoting OpenAI to primary due to Gemini maintenance',
          }),
          'PIPELINE'
        );
      });
    });

    it('executes live ping test and opens diagnostic result modal', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValue(mockHealthUsageData);
      const testSpy = vi.spyOn(aiOpsApi, 'testProvider').mockResolvedValueOnce({
        success: true,
        latencyMs: 98,
        status: 'HEALTHY',
      });

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Google Gemini Pro').length).toBeGreaterThan(0);
      });

      // Click Ping Test on Gemini
      const pingButtons = screen.getAllByRole('button', { name: /ping test/i });
      fireEvent.click(pingButtons[0]!);

      await waitFor(() => {
        expect(testSpy).toHaveBeenCalledWith('gemini', 'PIPELINE');
        expect(screen.getByText('Diagnostic Health Ping Result')).toBeDefined();
        expect(screen.getByText('Round-trip latency: 98ms')).toBeDefined();
      });
    });

    it('renders empty state when no providers configured', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValueOnce({
        ...mockHealthUsageData,
        providers: [],
      });

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getByText('No providers configured in PIPELINE pool')).toBeDefined();
        expect(screen.getByRole('button', { name: /add first provider/i })).toBeDefined();
      });
    });

    it('renders error alert card when data fetch fails', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockRejectedValueOnce(
        new Error('Network error: server unreachable')
      );

      renderWithToast(<AiManagerPage />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Infrastructure Telemetry')).toBeDefined();
        expect(screen.getAllByText('Network error: server unreachable').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /retry request/i })).toBeDefined();
      });
    });
  });

  describe('AdminAiHealthPage Read-Only Oversight', () => {
    it('renders read-only banner, queue metrics, and provider matrix without mutation buttons', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockResolvedValueOnce(mockHealthUsageData);

      renderWithToast(<AdminAiHealthPage />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /platform ai health & observability/i })
        ).toBeDefined();
      });

      // Read-only notice
      expect(screen.getByText(/read-only administrative overview:/i)).toBeDefined();

      // Status & masked keys
      expect(screen.getByText('Google Gemini Pro')).toBeDefined();
      expect(screen.getByText('AQ••••••••8Q')).toBeDefined();
      expect(screen.getAllByText('HEALTHY').length).toBeGreaterThan(0);

      // Recent Incident logs & Generation telemetry
      expect(screen.getByText('Recent Diagnostic & Health Incidents')).toBeDefined();
      expect(screen.getByText('Rate limit 429 received')).toBeDefined();
      expect(screen.getByText('Recent Inference Executions')).toBeDefined();

      // Strictly NO mutation controls
      expect(screen.queryByRole('button', { name: /\+ add provider/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /disable/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
      expect(screen.queryByRole('button', { name: '▲' })).toBeNull();
      expect(screen.queryByRole('button', { name: '▼' })).toBeNull();
    });

    it('handles empty state and error state gracefully', async () => {
      vi.spyOn(aiOpsApi, 'getHealthAndUsage').mockRejectedValueOnce(
        new Error('Unauthorized access')
      );

      renderWithToast(<AdminAiHealthPage />);

      await waitFor(() => {
        expect(screen.getByText('Telemetry Unreachable')).toBeDefined();
        expect(screen.getByText('Unauthorized access')).toBeDefined();
      });
    });
  });
});
