import { useId, type ReactElement, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SPRING_SNAPPY } from '../Motion/motionTokens';
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
  const instanceId = useId();
  const shouldReduceMotion = useReducedMotion();

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
              {isActive && (
                <motion.span
                  layoutId={shouldReduceMotion ? undefined : `activeTabIndicator-${instanceId}`}
                  className={styles.activeIndicator}
                  transition={SPRING_SNAPPY}
                />
              )}
              <span className={styles.tabLabelWrapper}>
                {tab.icon && <span className={styles.icon}>{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.badge !== undefined && <span className={styles.badge}>{tab.badge}</span>}
              </span>
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
