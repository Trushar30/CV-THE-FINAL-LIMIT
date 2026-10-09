import type { ReactElement, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type CareerRole, type PlatformRole } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { Button } from '../ui/Button/Button';
import { MenuIcon, ZapIcon, CoinIcon, SunIcon, MoonIcon } from '../ui/Icon';
import { NotificationBell } from '../notifications/NotificationBell';
import styles from './Topbar.module.css';

export interface TopbarProps {
  onToggleMobileMenu: () => void;
  title?: string;
}

export function Topbar({
  onToggleMobileMenu,
  title = 'CorpVerse Simulation Platform',
}: TopbarProps): ReactElement {
  const { user, switchCareerRole, switchPlatformRole, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleRoleChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (value === 'ADMIN' || value === 'AI_MANAGER') {
      switchPlatformRole(value as PlatformRole);
      switchCareerRole('NONE');
    } else {
      switchPlatformRole('NONE');
      switchCareerRole(value as CareerRole);
    }
  };

  const currentRoleValue =
    user?.platformRole === 'ADMIN'
      ? 'ADMIN'
      : user?.platformRole === 'AI_MANAGER'
        ? 'AI_MANAGER'
        : user?.careerRole || 'JOB_SEEKER';

  return (
    <header className={styles.topbar}>
      <div className={styles.leftArea}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
        >
          <MenuIcon size={18} />
        </button>
        <div className={styles.titleArea}>
          <span className={styles.pageTitle}>{title}</span>
          <div className={styles.statusIndicator}>
            <span className={styles.statusDot} />
            <span>AI Gateway Connected</span>
          </div>
        </div>
      </div>

      <div className={styles.rightArea}>
        {/* Economic Balance Indicators */}
        {user && (
          <div className={styles.balancePills}>
            <div className={`${styles.pill} ${styles.pillExp}`} title="Total EXP">
              <ZapIcon size={13} color="var(--cv-violet-400)" />
              <span>L{user.level}</span>
              <span>•</span>
              <span>{user.totalExpCached.toLocaleString()} EXP</span>
            </div>
            <div className={`${styles.pill} ${styles.pillCoin}`} title="CorpCoin Balance">
              <CoinIcon size={13} color="var(--cv-gold-400)" />
              <span>{user.corpCoinBalanceCached.toLocaleString()} CC</span>
            </div>
          </div>
        )}

        {/* Role Switcher (Stub for testing permissions and views) */}
        {user && (
          <select
            className={styles.roleSelect}
            value={currentRoleValue}
            onChange={handleRoleChange}
            aria-label="Switch active simulation role"
            title="Switch simulation role"
          >
            <option value="JOB_SEEKER">Role: Job Seeker</option>
            <option value="EMPLOYEE">Role: Employee</option>
            <option value="FOUNDER">Role: Founder</option>
            <option value="ADMIN">Role: Platform Admin</option>
            <option value="AI_MANAGER">Role: AI Manager</option>
          </select>
        )}

        {/* Notifications Bell */}
        {isAuthenticated && <NotificationBell />}

        {/* Theme Toggle Button */}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>

        {/* Auth Action */}
        <Button
          variant={isAuthenticated ? 'outline' : 'primary'}
          size="sm"
          onClick={() => {
            if (isAuthenticated) {
              void logout();
            } else {
              navigate('/login');
            }
          }}
        >
          {isAuthenticated ? 'Sign Out' : 'Sign In'}
        </Button>
      </div>
    </header>
  );
}

export default Topbar;
