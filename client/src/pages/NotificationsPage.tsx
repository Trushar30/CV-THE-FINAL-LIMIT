import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type NotificationItem } from '../api/notifications';
import { useToast } from '../components/ui/Toast/ToastContext';
import { Button, Spinner, EmptyState, Badge } from '../components/ui';
import {
  ZapIcon,
  AlertCircleIcon,
  TrophyIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  SparklesIcon,
} from '../components/ui/Icon';
import styles from './NotificationsPage.module.css';

function getNotificationIcon(type: string): React.ReactElement {
  switch (type) {
    case 'STAGE_ADVANCED':
      return <ZapIcon size={18} color="var(--cv-violet-500)" />;
    case 'APPLICATION_REJECTED':
      return <AlertCircleIcon size={18} color="var(--cv-feedback-error)" />;
    case 'OFFER_RECEIVED':
      return <TrophyIcon size={18} color="var(--cv-gold-500)" />;
    case 'HIRED':
      return <ShieldCheckIcon size={18} color="var(--cv-feedback-success)" />;
    case 'PROMOTION':
      return <TrophyIcon size={18} color="var(--cv-gold-500)" />;
    case 'DEMOTION':
      return <AlertCircleIcon size={18} color="var(--cv-feedback-warning)" />;
    case 'TERMINATION':
      return <AlertCircleIcon size={18} color="var(--cv-feedback-error)" />;
    case 'WARNING_ISSUED':
      return <AlertCircleIcon size={18} color="var(--cv-feedback-warning)" />;
    case 'WARNING_EXPIRING_SOON':
      return <ShieldCheckIcon size={18} color="var(--cv-cyan-500)" />;
    case 'COMPANY_BANKRUPT':
      return <AlertCircleIcon size={18} color="var(--cv-feedback-error)" />;
    case 'LOW_BALANCE_WARNING':
      return <AlertCircleIcon size={18} color="var(--cv-feedback-error)" />;
    case 'TASK_ASSIGNED':
      return <BriefcaseIcon size={18} color="var(--cv-brand-primary-500)" />;
    case 'TASK_EVALUATED':
      return <ZapIcon size={18} color="var(--cv-violet-500)" />;
    case 'DAILY_SCENARIO_READY':
      return <BriefcaseIcon size={18} color="var(--cv-brand-primary-500)" />;
    case 'AI_RESULT_READY':
      return <SparklesIcon size={18} color="var(--cv-cyan-500)" />;
    default:
      return <BriefcaseIcon size={18} color="var(--cv-brand-primary-500)" />;
  }
}

type NotificationCategoryTab = 'ALL' | 'UNREAD' | 'CAREER' | 'DISCIPLINE' | 'COMPANY' | 'AI';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<NotificationCategoryTab>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications({ page, limit });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
      setTotal(res.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch notifications';
      toastError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, toastError]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      toastSuccess('All notifications marked as read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark all as read';
      toastError(msg);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Silently continue
      }
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'UNREAD') return !item.isRead;
    if (activeTab === 'CAREER') {
      return [
        'STAGE_ADVANCED',
        'APPLICATION_REJECTED',
        'OFFER_RECEIVED',
        'HIRED',
        'APPLICATION_EXPIRED',
      ].includes(item.type);
    }
    if (activeTab === 'DISCIPLINE') {
      return [
        'WARNING_ISSUED',
        'WARNING_EXPIRING_SOON',
        'PROMOTION',
        'DEMOTION',
        'TERMINATION',
      ].includes(item.type);
    }
    if (activeTab === 'COMPANY') {
      return [
        'DAILY_SCENARIO_READY',
        'LOW_BALANCE_WARNING',
        'COMPANY_BANKRUPT',
        'FOUNDER_UNLOCKED',
      ].includes(item.type);
    }
    if (activeTab === 'AI') {
      return ['AI_RESULT_READY', 'TASK_ASSIGNED', 'TASK_EVALUATED'].includes(item.type);
    }
    return true;
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className={styles.notificationsContainer} data-testid="notifications-center-page">
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitles}>
          <h1>Notifications Center</h1>
          <p>Real-time lifecycle telemetry, career events, and simulation alerts.</p>
        </div>
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <Badge variant="cyan" size="md">
              {unreadCount} Unread
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
          >
            {markingAll ? 'Marking...' : 'Mark All as Read'}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterBar}>
        {(
          [
            { id: 'ALL', label: 'All Alerts' },
            { id: 'UNREAD', label: `Unread (${unreadCount})` },
            { id: 'CAREER', label: 'Career & Hiring' },
            { id: 'DISCIPLINE', label: 'Employment Discipline' },
            { id: 'COMPANY', label: 'Corporate Operations' },
            { id: 'AI', label: 'AI & Tasks' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.filterChip} ${activeTab === tab.id ? styles.filterChipActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`filter-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          title={activeTab === 'UNREAD' ? 'Zero Unread Alerts' : 'No Notifications'}
          description={
            activeTab === 'UNREAD'
              ? 'You have caught up with all career and simulation alerts.'
              : 'There are no notifications matching your active filter criteria.'
          }
        />
      ) : (
        <div className={styles.notificationsList}>
          {filteredNotifications.map((item) => (
            <div
              key={item._id}
              className={`${styles.notificationCard} ${!item.isRead ? styles.unreadCard : ''}`}
              onClick={() => void handleItemClick(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleItemClick(item);
                }
              }}
              data-testid={`notification-card-${item._id}`}
            >
              {!item.isRead && <span className={styles.unreadDot} />}
              <div className={styles.cardIconArea}>{getNotificationIcon(item.type)}</div>
              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{item.title}</span>
                  <span className={styles.cardTime}>
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className={styles.cardMessage}>{item.message}</div>
                {item.link && (
                  <span className={styles.cardAction}>
                    View Details &rarr;
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className={styles.paginationBar}>
          <span className={styles.paginationInfo}>
            Page {page} of {totalPages} ({total} total alerts)
          </span>
          <div className={styles.paginationButtons}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
