import type { ReactElement, ReactNode } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, getPostLoginRedirect } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { Button } from '../ui/Button/Button';
import { SunIcon, MoonIcon } from '../ui/Icon';
import styles from './MarketingLayout.module.css';

export interface MarketingLayoutProps {
  children?: ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps): ReactElement {
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();


  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.navInner}>
          <div className={styles.leftArea}>
            <Link to="/" className={styles.logo} aria-label="CorpVerse Home">
              <span className={styles.logoIcon}>C</span>
              <span className={styles.logoText}>CorpVerse</span>
            </Link>
          </div>

          <div className={styles.rightArea}>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </button>

            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(getPostLoginRedirect(user))}
              >
                Go to Workspace →
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/register')}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {children || <Outlet />}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link to="/" className={styles.logo} style={{ marginBottom: 'var(--cv-space-2)' }}>
                <span className={styles.logoIcon}>C</span>
                <span className={styles.logoText}>CorpVerse</span>
              </Link>
              <p className={styles.footerDesc}>
                A deterministic, AI-orchestrated corporate career and company simulation platform.
                Advance from job applicant to enterprise founder.
              </p>
            </div>

            <div className={styles.footerLinkGroup}>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>SIMULATION</span>
                <Link to="/jobs" className={styles.footerLink}>
                  Job Board
                </Link>
                <Link to="/companies" className={styles.footerLink}>
                  Companies
                </Link>
                <Link to="/leaderboards" className={styles.footerLink}>
                  Leaderboards
                </Link>
              </div>

              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>PROGRESSION</span>
                <a href="/#roles" className={styles.footerLink}>
                  Job Seeker
                </a>
                <a href="/#roles" className={styles.footerLink}>
                  Employee Track
                </a>
                <a href="/#roles" className={styles.footerLink}>
                  Founder Mode
                </a>
              </div>

              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>PLATFORM</span>
                <Link to="/showcase" className={styles.footerLink}>
                  Design Tokens
                </Link>
                <Link to="/login" className={styles.footerLink}>
                  Console Sign In
                </Link>
                <Link to="/register" className={styles.footerLink}>
                  Candidate Registration
                </Link>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>&copy; {new Date().getFullYear()} CorpVerse Engine. Authoritative simulation architecture.</span>
            <span>All AI systems nominal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MarketingLayout;
