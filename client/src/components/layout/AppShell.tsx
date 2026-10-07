import { useState, type ReactElement, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children?: ReactNode;
  pageTitle?: string;
}

export function AppShell({ children, pageTitle }: AppShellProps): ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  return (
    <div className={styles.shellContainer}>
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      <div className={styles.mainWrapper}>
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} title={pageTitle} />
        <main className={styles.contentArea}>{children || <Outlet />}</main>
      </div>
    </div>
  );
}

export default AppShell;
