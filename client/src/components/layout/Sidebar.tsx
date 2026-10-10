import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Badge } from '../ui/Badge/Badge';
import {
  SparklesIcon,
  TrophyIcon,
  RocketIcon,
  BriefcaseIcon,
  ClipboardListIcon,
  BuildingIcon,
  ZapIcon,
  BotIcon,
  ShieldCheckIcon,
  BrainCircuitIcon,
  CloseIcon,
} from '../ui/Icon';
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
            <CloseIcon size={18} />
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
              <span className={styles.navIcon}>
                <SparklesIcon size={18} />
              </span>
              <span>Component Showcase</span>
            </NavLink>
            <NavLink
              to="/leaderboards"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onCloseMobile}
            >
              <span className={styles.navIcon}>
                <TrophyIcon size={18} />
              </span>
              <span>Global Leaderboards</span>
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onCloseMobile}
            >
              <span className={styles.navIcon}>
                <BriefcaseIcon size={18} />
              </span>
              <span>Explore Jobs</span>
            </NavLink>
            <NavLink
              to="/companies"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onCloseMobile}
            >
              <span className={styles.navIcon}>
                <BuildingIcon size={18} />
              </span>
              <span>Enterprise Directory</span>
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
                <span className={styles.navIcon}>
                  <RocketIcon size={18} />
                </span>
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
                <span className={styles.navIcon}>
                  <BriefcaseIcon size={18} />
                </span>
                <span>Career Hub</span>
              </NavLink>
              <NavLink
                to="/applications"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <ClipboardListIcon size={18} />
                </span>
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
                <span className={styles.navIcon}>
                  <BuildingIcon size={18} />
                </span>
                <span>Workplace Dashboard</span>
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <ZapIcon size={18} />
                </span>
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
                end
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <RocketIcon size={18} />
                </span>
                <span>Command Overview</span>
              </NavLink>
              <NavLink
                to="/founder/simulation"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <ZapIcon size={18} />
                </span>
                <span>Daily Dilemma</span>
              </NavLink>
              <NavLink
                to="/founder/bots"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <BotIcon size={18} />
                </span>
                <span>Bot Fleet</span>
              </NavLink>
              <NavLink
                to="/founder/jobs"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <BriefcaseIcon size={18} />
                </span>
                <span>Job Openings</span>
              </NavLink>
              <NavLink
                to="/founder/applicants"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <ClipboardListIcon size={18} />
                </span>
                <span>Applicant Pipeline</span>
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
                <span className={styles.navIcon}>
                  <ShieldCheckIcon size={18} />
                </span>
                <span>Admin Console</span>
              </NavLink>
              <NavLink
                to="/admin/audit"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <ClipboardListIcon size={18} />
                </span>
                <span>Audit Explorer</span>
              </NavLink>
              <NavLink
                to="/admin/ai-health"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <ShieldCheckIcon size={18} />
                </span>
                <span>AI Health & Telemetry</span>
              </NavLink>
              <NavLink
                to="/admin/demo"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
              >
                <span className={styles.navIcon}>
                  <SparklesIcon size={18} />
                </span>
                <span>Hiring Demo Simulator</span>
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
                <span className={styles.navIcon}>
                  <BrainCircuitIcon size={18} />
                </span>
                <span>AI Infrastructure</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className={styles.sidebarFooter}>
          {user ? (
            <div className={styles.userCard}>
              <div className={styles.userAvatar}>
                {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'CV'}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user.displayName || user.email}</div>
                <div className={styles.userRoles}>
                  <Badge variant="cyan" size="sm">
                    {user.careerRole}
                  </Badge>
                  {user.platformRole !== 'NONE' && (
                    <Badge variant="danger" size="sm">
                      {user.platformRole}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-2)' }}>
              <NavLink
                to="/login"
                className={styles.navLink}
                style={{ justifyContent: 'center' }}
                onClick={onCloseMobile}
              >
                Sign In
              </NavLink>
              <NavLink
                to="/register"
                className={styles.navLink}
                style={{
                  justifyContent: 'center',
                  background: 'var(--cv-brand-primary-600)',
                  color: '#ffffff',
                }}
                onClick={onCloseMobile}
              >
                Register Account
              </NavLink>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
