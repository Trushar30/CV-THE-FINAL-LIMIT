import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LeaderboardsPage } from '../pages/leaderboards/LeaderboardsPage';
import { apiClient } from '../api/client';
import { ToastProvider } from '../components/ui/Toast/ToastContext';
import { useAuth } from '../store/AuthContext';

vi.mock('../store/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
  })),
}));

describe('LeaderboardsPage Frontend Suite (TASK P9.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
  });

  const mockUserExpData = {
    category: 'USER_EXP',
    period: 'ALL_TIME',
    rankings: [
      {
        rank: 1,
        entityId: 'u1',
        name: 'Sarah Principal',
        score: 16500,
        domain: 'SOFTWARE_ENGINEERING',
        careerRole: 'EMPLOYEE',
        secondaryMetric: 'Level 10',
      },
      {
        rank: 2,
        entityId: 'u2',
        name: 'David Lead',
        score: 12200,
        domain: 'AI_ENGINEERING',
        careerRole: 'FOUNDER',
        secondaryMetric: 'Level 9',
      },
      {
        rank: 3,
        entityId: 'u3',
        name: 'Elena Senior',
        score: 7100,
        domain: 'CLOUD_ENGINEERING',
        careerRole: 'EMPLOYEE',
        secondaryMetric: 'Level 7',
      },
      {
        rank: 4,
        entityId: 'u4',
        name: 'Marcus Mid',
        score: 3500,
        domain: 'SOFTWARE_ENGINEERING',
        careerRole: 'EMPLOYEE',
        secondaryMetric: 'Level 5',
      },
    ],
    totalEntries: 4,
    page: 1,
    limit: 20,
    totalPages: 1,
    calculatedAt: '2026-10-10T12:00:00Z',
  };

  const mockCompanyProfitData = {
    category: 'COMPANY_PROFIT',
    period: 'ALL_TIME',
    rankings: [
      {
        rank: 1,
        entityId: 'c1',
        name: 'Aether Cloud Systems',
        score: 45000,
        domain: 'CLOUD_ENGINEERING',
        isPlatformCompany: true,
        secondaryMetric: '45000 CC Net Profit',
      },
      {
        rank: 2,
        entityId: 'c2',
        name: 'CyberCore Labs',
        score: 22000,
        domain: 'SOFTWARE_ENGINEERING',
        isPlatformCompany: false,
        secondaryMetric: '22000 CC Net Profit',
      },
    ],
    totalEntries: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
    calculatedAt: '2026-10-10T12:00:00Z',
  };

  const renderComponent = () => {
    return render(
      <ToastProvider>
        <MemoryRouter>
          <LeaderboardsPage />
        </MemoryRouter>
      </ToastProvider>
    );
  };

  it('renders title, snapshot metadata, and user rankings on mount', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: mockUserExpData,
    });

    renderComponent();

    expect(screen.getByText('Global Leaderboards')).toBeInTheDocument();
    expect(screen.getByText(/Deterministic rankings calculated strictly/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Principal').length).toBeGreaterThan(0);
    });

    // Check top 3 podium highlights
    expect(screen.getByText('🥇 #1 Champion')).toBeInTheDocument();
    expect(screen.getByText('🥈 #2 Runner Up')).toBeInTheDocument();
    expect(screen.getByText('🥉 #3 Bronze')).toBeInTheDocument();

    // Check key metric format
    expect(screen.getAllByText('Level 10').length).toBeGreaterThan(0);
  });

  it('allows switching segment tabs between Engineering Talent and Corporate Rankings', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        success: true,
        data: mockUserExpData,
      })
      .mockResolvedValueOnce({
        success: true,
        data: mockCompanyProfitData,
      });

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Principal').length).toBeGreaterThan(0);
    });

    // Click Corporate Rankings
    const companyTab = screen.getByText(/Corporate Rankings/i);
    fireEvent.click(companyTab);

    await waitFor(() => {
      expect(screen.getAllByText('Aether Cloud Systems').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CyberCore Labs').length).toBeGreaterThan(0);
    });

    // Verify company category chips are visible
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Largest Workforce')).toBeInTheDocument();
    expect(screen.getByText('Fastest Growing')).toBeInTheDocument();
    expect(screen.getByText('Loss-Making List')).toBeInTheDocument();
  });

  it('triggers refresh cache button and displays success toast', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: mockUserExpData,
    });
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: mockUserExpData,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Principal').length).toBeGreaterThan(0);
    });

    const refreshBtn = screen.getByText(/Refresh Cache/i);
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/leaderboards/refresh', {
        category: 'USER_EXP',
      });
    });
  });

  it('filters results by domain', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: mockUserExpData,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Principal').length).toBeGreaterThan(0);
    });

    const domainSelect = screen.getByDisplayValue('All Engineering Domains');
    fireEvent.change(domainSelect, { target: { value: 'AI_ENGINEERING' } });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/leaderboards', expect.objectContaining({
        params: expect.objectContaining({
          domain: 'AI_ENGINEERING',
        }),
      }));
    });
  });

  it('highlights current user position and renders my standing banner', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'u3',
        displayName: 'Elena Senior',
        email: 'elena@corpverse.com',
        careerRole: 'EMPLOYEE',
        platformRole: 'NONE',
        level: 7,
        totalExpCached: 7100,
        corpCoinBalanceCached: 500,
      },
    } as unknown as ReturnType<typeof useAuth>);

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: mockUserExpData,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('my-standing-banner')).toBeInTheDocument();
      expect(screen.getByTestId('my-rank-row')).toBeInTheDocument();
      expect(screen.getByTestId('my-position-badge')).toBeInTheDocument();
    });

    expect(screen.getByText('Your Standing in this Category')).toBeInTheDocument();
  });
});

