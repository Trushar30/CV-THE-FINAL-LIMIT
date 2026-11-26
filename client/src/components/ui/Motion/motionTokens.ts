import type { Transition, Variants } from 'motion/react';

/**
 * CorpVerse Canonical Spring Parameters
 * Restrained, snappy physics calibrated to Linear/Raycast UI discipline.
 */
export const SPRING_FAST: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
};

/**
 * Page Transitions: Calm fade with subtle 6px vertical shift.
 * Avoids disorienting page wipes or excessive movement.
 */
export const PAGE_TRANSITION_VARIANTS: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] },
  },
};

/**
 * Modal Dialog Entrance: scale(0.96) -> scale(1) + fade in.
 */
export const MODAL_BACKDROP_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const MODAL_DIALOG_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING_FAST },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.1 } },
};

/**
 * Stagger List: max 40ms stagger between items, max 5 items animated.
 */
export const STAGGER_CONTAINER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04, // 40ms stagger
      delayChildren: 0.02,
    },
  },
};

export const STAGGER_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_FAST,
  },
};
