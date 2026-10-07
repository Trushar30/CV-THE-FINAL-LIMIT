import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Badge } from '../ui/Badge/Badge';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps): ReactElement {
  const { user } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.brandHeader}>
          <NavLink to="/" className={styles.logoArea} onClick={onCloseMobile}>
            <div className={styles.logoIcon}>C</div>
            <span className={styles.logoText}>CorpVerse</span>
          </NavLink>
          <button
            type="button"
            className={styles.closeMobileBtn}
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className={styles.navSection}>
          {/* General Navigation */}
          <div className={styles.navGroup}>
            <div className={styles.navGroupTitle}>Core Foundation</div>
            <NavLink
              to="/showcase"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onCloseMobile}
            >
              <span className={styles.navIcon}>✨</span>
              <span>Component Showcase</span>
            </NavLink>
            <NavLink
              to="/leaderboards"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onCloseMobile}
            >
              <span className={styles.navIcon}>🏆</span>
              <span>Global Leaderboards</span>
            </NavLink>
          </div>

          {/* Candidate Onboarding Navigation */}
          {user && user.careerRole === 'NONE' && (
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>Candidate Onboarding</div>
              <NavLink
                to="/profile/setup"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>🚀</span>
                <span>Profile Setup Wizard</span>
              </NavLink>
            </div>
          )}

          {/* Job Seeker Navigation */}
          {user && (user.careerRole === 'JOB_SEEKER' || user.platformRole === 'ADMIN') && (
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>Job Seeker</div>
              <NavLink
                to="/career"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>💼</span>
                <span>Career Hub</span>
              </NavLink>
              <NavLink
                to="/applications"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>📋</span>
                <span>Active Applications</span>
              </NavLink>
            </div>
          )}

          {/* Employee Navigation */}
          {user && (user.careerRole === 'EMPLOYEE' || user.platformRole === 'ADMIN') && (
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>Employee Portal</div>
              <NavLink
                to="/workplace"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>🏢</span>
                <span>Workplace Dashboard</span>
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>⚡</span>
                <span>Daily Tasks</span>
              </NavLink>
            </div>
          )}

          {/* Founder Navigation */}
          {user && (user.careerRole === 'FOUNDER' || user.platformRole === 'ADMIN') && (
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>Executive HQ</div>
              <NavLink
                to="/founder"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>🚀</span>
                <span>Company Command</span>
              </NavLink>
              <NavLink
                to="/bots"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>🤖</span>
                <span>Bot Marketplace</span>
              </NavLink>
            </div>
          )}

          {/* Admin Navigation */}
          {user && user.platformRole === 'ADMIN' && (
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>Platform Administration</div>
              <NavLink
                to="/admin"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>⚙️</span>
                <span>Admin Console</span>
              </NavLink>
              <NavLink
                to="/admin/audit"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>📜</span>
                <span>Audit Explorer</span>
              </NavLink>
            </div>
          )}

          {/* AI Manager Navigation */}
          {user && (user.platformRole === 'AI_MANAGER' || user.platformRole === 'ADMIN') && (
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>AI Operations</div>
              <NavLink
                to="/ai-ops"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>🧠</span>
                <span>AI Infrastructure</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className={styles.sidebarFooter}>
          {user ? (
            <div className={styles.userCard}>
              <div className={styles.userAvatar}>{user.displayName.slice(0, 2).toUpperCase()}</div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user.displayName}</div>
                <div className={styles.userRoles}>
                  <Badge variant="primary" size="sm">
                    {user.careerRole}
                  </Badge>
                  {user.platformRole !== 'NONE' && (
                    <Badge variant="warning" size="sm">
                      {user.platformRole}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--cv-text-muted)' }}
            >
              Guest Session (Demo)
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
