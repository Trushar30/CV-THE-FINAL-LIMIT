import { useState, useEffect, type ReactElement, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children?: ReactNode;
  pageTitle?: string;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Welcome',
  '/showcase': 'Component Showcase',
  '/leaderboards': 'Global Leaderboards',
  '/notifications': 'Notifications Hub',
  '/companies': 'Enterprises Directory',
  '/jobs': 'Career Opportunities',
  '/career': 'Application Pipeline',
  '/applications': 'Application Pipeline',
  '/workplace': 'Employee Workplace',
  '/employee/dashboard': 'Employee Workplace',
  '/tasks': 'Employee Workplace',
  '/tasks/history': 'Task Execution History',
  '/founder/unlock': 'Founder Mode Activation',
  '/founder/company/new': 'Found an Enterprise',
  '/founder/bots': 'AI Bot Store',
  '/founder/dashboard': 'Founder Executive HQ',
  '/founder/scenario': 'Daily Strategic Dilemma',
  '/founder/jobs': 'Manage Requisitions',
  '/founder/applicants': 'Applicant Pipeline',
  '/founder/ledger': 'Corporate Financial Ledger',
  '/founder/bankruptcy': 'Corporate Liquidation Notice',
  '/admin': 'Platform Administration',
  '/admin/demo': 'Hiring Simulator Demo',
  '/admin/ai-health': 'AI Health & Diagnostics',
  '/ai-ops': 'AI Operations Console',
  '/login': 'Authentication',
  '/register': 'Create Account',
  '/verify-email': 'Verify Email',
  '/profile/setup': 'Candidate Onboarding',
  '/403': '403 Access Restricted',
  '/404': '404 Page Not Found',
};

function getRouteTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }
  if (pathname.startsWith('/jobs/')) return 'Job Requisition';
  if (pathname.startsWith('/companies/')) return 'Enterprise Profile';
  if (pathname.includes('/offer')) return 'Executive Offer Review';
  if (pathname.startsWith('/applications/')) return 'Interview Session';
  if (pathname.startsWith('/tasks/')) return 'Daily Task Workspace';
  return 'CorpVerse Simulation Platform';
}

export function AppShell({ children, pageTitle }: AppShellProps): ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const location = useLocation();

  const activeTitle = pageTitle || getRouteTitle(location.pathname);

  useEffect(() => {
    document.title = `${activeTitle} | CorpVerse`;
  }, [activeTitle]);

  return (
    <div className={styles.shellContainer}>
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      <div className={styles.mainWrapper}>
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} title={activeTitle} />
        <main className={styles.contentArea}>{children || <Outlet />}</main>
      </div>
    </div>
  );
}

export default AppShell;
