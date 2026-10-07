import type { ReactElement, ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export type TabsVariant = 'pills' | 'underline';

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: TabsVariant;
  children?: ReactNode;
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  children,
  className = '',
}: TabsProps): ReactElement {
  return (
    <div className={`${styles.container} ${styles[`variant-${variant}`]} ${className}`}>
      <div role="tablist" className={styles.tabList}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              disabled={tab.disabled}
              id={`tab-${tab.id}`}
              className={`${styles.tabButton} ${isActive ? styles.active : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.icon && <span className={styles.icon}>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && <span className={styles.badge}>{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {children && (
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className={styles.tabPanel}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Tabs;
