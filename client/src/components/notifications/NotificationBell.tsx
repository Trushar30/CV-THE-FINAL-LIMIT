import { useState, useEffect, useRef, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  notificationsApi,
  type NotificationItem,
} from '../../api/notifications';
import {
  BellIcon,
  ZapIcon,
  AlertCircleIcon,
  TrophyIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
} from '../ui/Icon';
import styles from './NotificationBell.module.css';

function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const past = new Date(dateString).getTime();
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function getNotificationIcon(type: string): ReactElement {
  switch (type) {
    case 'STAGE_ADVANCED':
      return <ZapIcon size={14} color="var(--cv-violet-500)" />;
    case 'APPLICATION_REJECTED':
      return <AlertCircleIcon size={14} color="var(--cv-feedback-error)" />;
    case 'OFFER_RECEIVED':
      return <TrophyIcon size={14} color="var(--cv-gold-500)" />;
    case 'HIRED':
      return <ShieldCheckIcon size={14} color="var(--cv-feedback-success)" />;
    default:
      return <BriefcaseIcon size={14} color="var(--cv-brand-primary-500)" />;
  }
}

export function NotificationBell(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async (): Promise<void> => {
    try {
      const res = await notificationsApi.getNotifications({ limit: 15 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Ignore background network errors for smooth user experience
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (): void => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      void fetchNotifications();
    }
  };

  const handleItemClick = async (item: NotificationItem): Promise<void> => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Continue navigation
      }
    }
    setIsOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container} ref={containerRef} data-testid="notification-bell">
      <button
        type="button"
        className={styles.bellButton}
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <BellIcon size={16} />
        {unreadCount > 0 && (
          <span className={styles.badge} data-testid="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.popover} role="dialog" aria-label="Notifications panel">
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className={styles.unreadCountBadge}>{unreadCount} new</span>
              )}
            </div>
            <button
              type="button"
              className={styles.markAllBtn}
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || isLoading}
            >
              Mark all read
            </button>
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <BellIcon size={24} color="var(--cv-text-muted)" />
                <span className={styles.emptyStateText}>No notifications yet</span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  className={`${styles.item} ${!item.isRead ? styles.unread : ''}`}
                  onClick={() => void handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleItemClick(item);
                    }
                  }}
                  data-testid={`notification-item-${item._id}`}
                >
                  <div className={styles.itemIcon}>{getNotificationIcon(item.type)}</div>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>
                      <span>{item.title}</span>
                      <span className={styles.itemTime}>{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    <div className={styles.itemMessage}>{item.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
