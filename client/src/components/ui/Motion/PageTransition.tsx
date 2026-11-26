import type { ReactElement, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PAGE_TRANSITION_VARIANTS } from './motionTokens';

export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps): ReactElement {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={PAGE_TRANSITION_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
