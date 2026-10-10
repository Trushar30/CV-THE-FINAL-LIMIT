import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationsPage } from '../pages/NotificationsPage';
import { notificationsApi, type NotificationItem } from '../api/notifications';
import { ToastProvider } from '../components/ui/Toast/ToastContext';

vi.mock('../api/notifications', () => ({
  notificationsApi: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const mockNotifications: NotificationItem[] = [
  {
    _id: 'notif-1',
    userId: 'u-1',
    type: 'STAGE_ADVANCED',
    title: 'Application Advanced',
    message: 'You have been advanced to ASSESSMENT stage at HyperScale Tech',
    isRead: false,
    link: '/applications/app-1',
    createdAt: '2026-10-10T12:00:00Z',
  },
  {
    _id: 'notif-2',
    userId: 'u-1',
    type: 'PROMOTION',
    title: 'Promotion Achieved',
    message: 'Promoted to Senior Engineer (Level 7)',
    isRead: false,
    link: '/employee/dashboard',
    createdAt: '2026-10-10T11:00:00Z',
  },
  {
    _id: 'notif-3',
    userId: 'u-1',
    type: 'WARNING_ISSUED',
    title: 'Disciplinary Warning',
    message: 'Warning issued due to consecutive missed tasks',
    isRead: true,
    link: '/employee/performance',
    createdAt: '2026-10-09T10:00:00Z',
  },
  {
    _id: 'notif-4',
    userId: 'u-1',
    type: 'AI_RESULT_READY',
    title: 'AI Evaluation Completed',
    message: 'Your system architecture assessment has been evaluated by the AI panel',
    isRead: true,
    link: '/tasks/task-1',
    createdAt: '2026-10-08T09:00:00Z',
  },
];

const renderNotificationsPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <NotificationsPage />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('NotificationsCenter Frontend Suite (TASK P9.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notifications list with unread counter and badges', async () => {
    vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unreadCount: 2,
      page: 1,
      limit: 20,
    });

    renderNotificationsPage();

    await waitFor(() => {
      expect(screen.getByText('Notifications Center')).toBeInTheDocument();
      expect(screen.getByText('Application Advanced')).toBeInTheDocument();
      expect(screen.getByText('Promotion Achieved')).toBeInTheDocument();
      expect(screen.getByText('Disciplinary Warning')).toBeInTheDocument();
      expect(screen.getByText('AI Evaluation Completed')).toBeInTheDocument();
    });

    expect(screen.getByText('2 Unread')).toBeInTheDocument();
  });

  it('filters notifications by unread tab', async () => {
    vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unreadCount: 2,
      page: 1,
      limit: 20,
    });

    renderNotificationsPage();

    await waitFor(() => {
      expect(screen.getByText('Application Advanced')).toBeInTheDocument();
    });

    // Click Unread tab
    const unreadTab = screen.getByText(/Unread \(2\)/);
    fireEvent.click(unreadTab);

    // Should only show the unread items
    expect(screen.getByText('Application Advanced')).toBeInTheDocument();
    expect(screen.getByText('Promotion Achieved')).toBeInTheDocument();
    expect(screen.queryByText('Disciplinary Warning')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Evaluation Completed')).not.toBeInTheDocument();
  });

  it('filters notifications by category (Discipline tab)', async () => {
    vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unreadCount: 2,
      page: 1,
      limit: 20,
    });

    renderNotificationsPage();

    await waitFor(() => {
      expect(screen.getByText('Application Advanced')).toBeInTheDocument();
    });

    // Click Discipline tab
    const disciplineTab = screen.getByText('Employment Discipline');
    fireEvent.click(disciplineTab);

    expect(screen.getByText('Disciplinary Warning')).toBeInTheDocument();
    expect(screen.queryByText('Application Advanced')).not.toBeInTheDocument();
  });

  it('marks all notifications as read when button is clicked', async () => {
    vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unreadCount: 2,
      page: 1,
      limit: 20,
    });
    vi.mocked(notificationsApi.markAllRead).mockResolvedValue({ modifiedCount: 2 });

    renderNotificationsPage();

    await waitFor(() => {
      expect(screen.getByText('Mark All as Read')).toBeInTheDocument();
    });

    const markAllBtn = screen.getByText('Mark All as Read');
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(notificationsApi.markAllRead).toHaveBeenCalledTimes(1);
    });
  });

  it('marks single notification as read on click', async () => {
    vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unreadCount: 2,
      page: 1,
      limit: 20,
    });
    vi.mocked(notificationsApi.markRead).mockResolvedValue({
      notification: {
        _id: 'notif-1',
        userId: 'u-1',
        type: 'STAGE_ADVANCED',
        title: 'Application Advanced',
        message: 'You have been advanced to ASSESSMENT stage at HyperScale Tech',
        isRead: true,
        createdAt: '2026-10-10T12:00:00Z',
      },
    });

    renderNotificationsPage();

    await waitFor(() => {
      expect(screen.getByText('Application Advanced')).toBeInTheDocument();
    });

    const unreadCard = screen.getByText('Application Advanced').closest('div[role="button"]');
    if (unreadCard) {
      fireEvent.click(unreadCard);
    }

    await waitFor(() => {
      expect(notificationsApi.markRead).toHaveBeenCalledWith('notif-1');
    });
  });
});
