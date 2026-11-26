import type { ReactElement, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  SPRING_FAST,
  STAGGER_CONTAINER_VARIANTS,
  STAGGER_ITEM_VARIANTS,
} from './motionTokens';

export interface StaggerListProps {
  children: ReactNode;
  className?: string;
}

export function StaggerList({ children, className = '' }: StaggerListProps): ReactElement {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={STAGGER_CONTAINER_VARIANTS}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

export function StaggerItem({
  children,
  index = 0,
  className = '',
}: StaggerItemProps): ReactElement {
  const shouldReduce = useReducedMotion();

  // Beyond 5 items, render instantly with zero animation delay
  if (shouldReduce || index >= 5) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={STAGGER_ITEM_VARIANTS}
      transition={SPRING_FAST}
    >
      {children}
    </motion.div>
  );
}
