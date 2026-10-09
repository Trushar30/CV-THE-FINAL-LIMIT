import { AppError } from '../../utils/errors.js';
import {
  type ApplicationStage,
  APPLICATION_STAGES,
  type ApplicationStatus,
} from '../../types/enums.js';
import type { IApplicationDocument, IStageHistoryEntry } from '../../models/Application.js';

export const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'ACCEPTED',
] as const;

export const NON_TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  'ACTIVE',
  'IN_PROGRESS',
] as const;

/**
 * Ordered pipeline stages per Spec Section 7.1:
 * APPLIED -> ATS_SCREENING -> SCREENING -> ASSESSMENT -> INTERVIEW -> FINAL_REVIEW -> OFFER -> ACCEPTED
 */
export const STAGE_ORDER: readonly ApplicationStage[] = [
  'APPLIED',
  'ATS_SCREENING',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'FINAL_REVIEW',
  'OFFER',
  'ACCEPTED',
] as const;

/**
 * Direct forward transitions between stages.
 */
export const ALLOWED_FORWARD_TRANSITIONS: Readonly<Record<ApplicationStage, ApplicationStage | null>> = {
  APPLIED: 'ATS_SCREENING',
  ATS_SCREENING: 'SCREENING',
  SCREENING: 'ASSESSMENT',
  ASSESSMENT: 'INTERVIEW',
  INTERVIEW: 'FINAL_REVIEW',
  FINAL_REVIEW: 'OFFER',
  OFFER: 'ACCEPTED',
  ACCEPTED: null,
};

export interface TransitionTarget {
  nextStage?: ApplicationStage;
  terminalStatus?: 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'ACCEPTED';
}

export interface TransitionOptions {
  result?: string;
  rejectionReason?: string;
  withdrawalReason?: string;
  expiryReason?: string;
}

/**
 * Single authoritative state machine for job applications.
 * Enforces the 8-stage pipeline and terminal status transitions per Spec Section 7.
 * Any illegal transition throws AppError.businessRuleViolation.
 */
export class ApplicationStateMachine {
  /**
   * Check whether a status is terminal.
   */
  public static isTerminalStatus(status: ApplicationStatus): boolean {
    return (TERMINAL_STATUSES as readonly string[]).includes(status);
  }

  /**
   * Validate whether a transition from current state to target is permitted.
   */
  public static canTransition(
    currentStage: ApplicationStage,
    currentStatus: ApplicationStatus,
    target: TransitionTarget
  ): boolean {
    try {
      this.validateTransition(currentStage, currentStatus, target);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate transition parameters. Throws AppError.businessRuleViolation on any violation.
   */
  public static validateTransition(
    currentStage: ApplicationStage,
    currentStatus: ApplicationStatus,
    target: TransitionTarget
  ): void {
    if (!target.nextStage && !target.terminalStatus) {
      throw AppError.businessRuleViolation(
        'Invalid transition target: must specify either nextStage or terminalStatus.'
      );
    }

    // Rule 1: No transition allowed from any terminal status
    if (this.isTerminalStatus(currentStatus)) {
      throw AppError.businessRuleViolation(
        `Cannot transition application: already in terminal status '${currentStatus}'.`
      );
    }

    // Terminal Status Transitions
    if (target.terminalStatus) {
      if (!(TERMINAL_STATUSES as readonly string[]).includes(target.terminalStatus)) {
        throw AppError.businessRuleViolation(
          `Invalid terminal status: '${target.terminalStatus}'. Must be one of ${TERMINAL_STATUSES.join(', ')}.`
        );
      }

      // ACCEPTED can only be reached from OFFER stage
      if (target.terminalStatus === 'ACCEPTED') {
        if (currentStage !== 'OFFER') {
          throw AppError.businessRuleViolation(
            `Illegal transition: status 'ACCEPTED' can only be reached from stage 'OFFER' (current stage is '${currentStage}').`
          );
        }
        if (target.nextStage && target.nextStage !== 'ACCEPTED') {
          throw AppError.businessRuleViolation(
            `Illegal transition: target stage '${target.nextStage}' conflicts with terminal status 'ACCEPTED'.`
          );
        }
        return;
      }

      // WITHDRAWN and EXPIRED are valid from any non-terminal stage
      if (target.terminalStatus === 'WITHDRAWN' || target.terminalStatus === 'EXPIRED') {
        return;
      }

      // REJECTED is valid from any non-terminal stage
      if (target.terminalStatus === 'REJECTED') {
        return;
      }
    }

    // Forward Stage Transition
    if (target.nextStage) {
      if (!(APPLICATION_STAGES as readonly string[]).includes(target.nextStage)) {
        throw AppError.businessRuleViolation(
          `Invalid stage: '${target.nextStage}'. Must be one of ${APPLICATION_STAGES.join(', ')}.`
        );
      }

      if (target.nextStage === currentStage) {
        throw AppError.businessRuleViolation(
          `Illegal transition: application is already in stage '${currentStage}'.`
        );
      }

      const expectedNext = ALLOWED_FORWARD_TRANSITIONS[currentStage];
      if (!expectedNext || expectedNext !== target.nextStage) {
        throw AppError.businessRuleViolation(
          `Illegal stage transition: cannot transition from '${currentStage}' to '${target.nextStage}'. Expected '${expectedNext || 'none (terminal)'}'.`
        );
      }

      // If advancing to ACCEPTED, terminalStatus must be ACCEPTED
      if (target.nextStage === 'ACCEPTED') {
        if (currentStage !== 'OFFER') {
          throw AppError.businessRuleViolation(
            `Illegal transition: stage 'ACCEPTED' can only be reached from 'OFFER'.`
          );
        }
      }
    }
  }

  /**
   * Execute an authoritative transition on an Application document.
   * Updates stageHistory, currentStage, status, and transition reasons.
   */
  public static transition<T extends {
    currentStage: ApplicationStage;
    status: ApplicationStatus;
    stageHistory: IStageHistoryEntry[];
    rejectionReason?: string;
    withdrawalReason?: string;
    expiryReason?: string;
  }>(
    application: T,
    target: TransitionTarget,
    options?: TransitionOptions
  ): T {
    this.validateTransition(application.currentStage, application.status, target);

    const now = new Date();

    // 1. Close current open stage in stageHistory
    if (application.stageHistory && application.stageHistory.length > 0) {
      const currentEntry = application.stageHistory[application.stageHistory.length - 1];
      if (currentEntry && !currentEntry.exitedAt) {
        currentEntry.exitedAt = now;
        currentEntry.result =
          options?.result ||
          (target.terminalStatus
            ? target.terminalStatus
            : `ADVANCED_TO_${target.nextStage}`);
      }
    }

    // 2. Handle forward stage progression
    if (target.nextStage) {
      application.currentStage = target.nextStage;

      if (target.nextStage === 'ACCEPTED') {
        application.status = 'ACCEPTED';
        application.stageHistory.push({
          stage: 'ACCEPTED',
          enteredAt: now,
          exitedAt: now,
          result: options?.result || 'ACCEPTED',
        });
      } else {
        application.stageHistory.push({
          stage: target.nextStage,
          enteredAt: now,
        });
      }
    }

    // 3. Handle terminal status
    if (target.terminalStatus) {
      application.status = target.terminalStatus;

      if (target.terminalStatus === 'ACCEPTED') {
        application.currentStage = 'ACCEPTED';
      }

      if (target.terminalStatus === 'REJECTED' && options?.rejectionReason) {
        application.rejectionReason = options.rejectionReason;
      }
      if (target.terminalStatus === 'WITHDRAWN' && options?.withdrawalReason) {
        application.withdrawalReason = options.withdrawalReason;
      }
      if (target.terminalStatus === 'EXPIRED' && options?.expiryReason) {
        application.expiryReason = options.expiryReason;
      }
    }

    return application;
  }

  /**
   * Advance application to its next sequential pipeline stage.
   */
  public static advanceStage<T extends IApplicationDocument>(
    application: T,
    nextStage: ApplicationStage,
    options?: { result?: string }
  ): T {
    return this.transition(application, { nextStage }, options);
  }

  /**
   * Transition application to REJECTED.
   */
  public static reject<T extends IApplicationDocument>(
    application: T,
    options?: { reason?: string; result?: string }
  ): T {
    return this.transition(
      application,
      { terminalStatus: 'REJECTED' },
      {
        result: options?.result || 'REJECTED',
        rejectionReason: options?.reason,
      }
    );
  }

  /**
   * Transition application to WITHDRAWN (voluntary candidate action).
   */
  public static withdraw<T extends IApplicationDocument>(
    application: T,
    options?: { reason?: string; result?: string }
  ): T {
    return this.transition(
      application,
      { terminalStatus: 'WITHDRAWN' },
      {
        result: options?.result || 'WITHDRAWN',
        withdrawalReason: options?.reason,
      }
    );
  }

  /**
   * Transition application to EXPIRED (stale inactivity).
   */
  public static expire<T extends IApplicationDocument>(
    application: T,
    options?: { reason?: string; result?: string }
  ): T {
    return this.transition(
      application,
      { terminalStatus: 'EXPIRED' },
      {
        result: options?.result || 'EXPIRED',
        expiryReason: options?.reason,
      }
    );
  }

  /**
   * Transition application to ACCEPTED (only from OFFER stage).
   */
  public static acceptOffer<T extends IApplicationDocument>(
    application: T,
    options?: { result?: string }
  ): T {
    return this.transition(
      application,
      { nextStage: 'ACCEPTED', terminalStatus: 'ACCEPTED' },
      { result: options?.result || 'OFFER_ACCEPTED' }
    );
  }
}
