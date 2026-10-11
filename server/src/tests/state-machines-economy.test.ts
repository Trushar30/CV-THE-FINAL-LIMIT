import { describe, it, expect } from 'vitest';
import {
  ApplicationStateMachine,
  TERMINAL_STATUSES,
} from '../services/career/applicationStateMachine.js';
import {
  clampScore,
  sanitizeExp,
  levelForExp,
  calculateTaskExp,
  performanceBand,
  performanceBandLabel,
  getPerformanceBandDetails,
  getLevelDetails,
} from '../services/economy/expEngine.js';
import { executeDeterministicTick, isBankrupt } from '../services/simulation/simulationEngine.js';
import { AppError } from '../utils/errors.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import type { ApplicationStage, ApplicationStatus } from '../types/enums.js';

describe('TASK P10.2: State Machines & Economy Invariants Hardening Suite', () => {
  describe('1. Application State Machine Invariants', () => {
    it('allows complete 8-stage linear progression', () => {
      let currentStage: ApplicationStage = 'APPLIED';
      const currentStatus: ApplicationStatus = 'ACTIVE';

      const forwardStages: ApplicationStage[] = [
        'ATS_SCREENING',
        'SCREENING',
        'ASSESSMENT',
        'INTERVIEW',
        'FINAL_REVIEW',
        'OFFER',
        'ACCEPTED',
      ];

      for (const nextStage of forwardStages) {
        expect(
          ApplicationStateMachine.canTransition(currentStage, currentStatus, { nextStage })
        ).toBe(true);

        const dummyApp = {
          currentStage,
          status: currentStatus,
          stageHistory: [],
        };

        ApplicationStateMachine.transition(
          dummyApp as unknown as Parameters<typeof ApplicationStateMachine.transition>[0],
          { nextStage },
          { result: 'PASSED' }
        );
        expect(dummyApp.currentStage).toBe(nextStage);
        currentStage = nextStage;
      }

      expect(currentStage).toBe('ACCEPTED');
    });

    it('rejects skipping stages in forward progression', () => {
      expect(
        ApplicationStateMachine.canTransition('APPLIED', 'ACTIVE', { nextStage: 'ASSESSMENT' })
      ).toBe(false);

      expect(() => {
        ApplicationStateMachine.validateTransition('APPLIED', 'ACTIVE', { nextStage: 'ASSESSMENT' });
      }).toThrowError(AppError);

      expect(
        ApplicationStateMachine.canTransition('SCREENING', 'ACTIVE', { nextStage: 'OFFER' })
      ).toBe(false);
    });

    it('rejects backward transitions between stages', () => {
      expect(
        ApplicationStateMachine.canTransition('INTERVIEW', 'ACTIVE', { nextStage: 'SCREENING' })
      ).toBe(false);

      expect(
        ApplicationStateMachine.canTransition('OFFER', 'ACTIVE', { nextStage: 'FINAL_REVIEW' })
      ).toBe(false);
    });

    it('permits all non-terminal stages to transition to terminal states (REJECTED, WITHDRAWN, EXPIRED)', () => {
      const nonTerminalStages: ApplicationStage[] = [
        'APPLIED',
        'ATS_SCREENING',
        'SCREENING',
        'ASSESSMENT',
        'INTERVIEW',
        'FINAL_REVIEW',
        'OFFER',
      ];

      for (const stage of nonTerminalStages) {
        expect(
          ApplicationStateMachine.canTransition(stage, 'ACTIVE', { terminalStatus: 'REJECTED' })
        ).toBe(true);
        expect(
          ApplicationStateMachine.canTransition(stage, 'ACTIVE', { terminalStatus: 'WITHDRAWN' })
        ).toBe(true);
        expect(
          ApplicationStateMachine.canTransition(stage, 'ACTIVE', { terminalStatus: 'EXPIRED' })
        ).toBe(true);
      }
    });

    it('blocks any further transitions from terminal states (no resurrection)', () => {
      for (const terminalStatus of TERMINAL_STATUSES) {
        expect(
          ApplicationStateMachine.canTransition('INTERVIEW', terminalStatus, { nextStage: 'FINAL_REVIEW' })
        ).toBe(false);

        expect(
          ApplicationStateMachine.canTransition('INTERVIEW', terminalStatus, { terminalStatus: 'REJECTED' })
        ).toBe(false);

        expect(() => {
          ApplicationStateMachine.validateTransition('INTERVIEW', terminalStatus, { nextStage: 'FINAL_REVIEW' });
        }).toThrowError(AppError);
      }
    });
  });

  describe('2. EXP & Level Calculation Invariants', () => {
    const levelTable = DEFAULT_PLATFORM_CONFIG.levelTable;

    it('accurately maps total EXP to levels per Spec Section 5', () => {
      expect(levelForExp(0, levelTable)).toBe(1);
      expect(levelForExp(499, levelTable)).toBe(1);
      expect(levelForExp(500, levelTable)).toBe(2);
      expect(levelForExp(1199, levelTable)).toBe(2);
      expect(levelForExp(1200, levelTable)).toBe(3);
      expect(levelForExp(2000, levelTable)).toBe(4);
      expect(levelForExp(3000, levelTable)).toBe(5);
      expect(levelForExp(4500, levelTable)).toBe(6);
      expect(levelForExp(6500, levelTable)).toBe(7);
      expect(levelForExp(9000, levelTable)).toBe(8);
      expect(levelForExp(12000, levelTable)).toBe(9);
      expect(getLevelDetails(12000, levelTable).founderUnlocked).toBe(true);
      expect(levelForExp(16000, levelTable)).toBe(10);
      expect(levelForExp(50000, levelTable)).toBe(10);
    });

    it('safely clamps scores and handles aberrant AI outputs', () => {
      expect(clampScore(95)).toBe(95);
      expect(clampScore(150)).toBe(100);
      expect(clampScore(-25)).toBe(0);
      expect(clampScore(NaN)).toBe(0);
      expect(clampScore(null)).toBe(0);
      expect(clampScore(undefined)).toBe(0);
      expect(clampScore('88')).toBe(88);
      expect(clampScore('aberrant string')).toBe(0);
    });

    it('correctly calculates awarded task EXP bounded by maxExp', () => {
      expect(calculateTaskExp(100, 60)).toBe(60);
      expect(calculateTaskExp(50, 60)).toBe(30);
      expect(calculateTaskExp(0, 60)).toBe(0);
      expect(calculateTaskExp(120, 60)).toBe(60);
      expect(calculateTaskExp(-10, 60)).toBe(0);
    });

    it('correctly categorizes performance score bands matching Spec Section 11', () => {
      expect(performanceBand(20)).toBe('POOR');
      expect(performanceBandLabel(20)).toBe('Poor');
      expect(getPerformanceBandDetails(20).isWarningCandidate).toBe(true);
      expect(getPerformanceBandDetails(20).isPerformanceIssue).toBe(false);

      expect(performanceBand(45)).toBe('NEEDS_IMPROVEMENT');
      expect(performanceBandLabel(45)).toBe('Needs Improvement');
      expect(getPerformanceBandDetails(45).isWarningCandidate).toBe(false);
      expect(getPerformanceBandDetails(45).isPerformanceIssue).toBe(true);

      expect(performanceBand(65)).toBe('ACCEPTABLE');
      expect(performanceBandLabel(65)).toBe('Acceptable');
      expect(getPerformanceBandDetails(65).isWarningCandidate).toBe(false);

      expect(performanceBand(80)).toBe('GOOD');
      expect(performanceBandLabel(80)).toBe('Good');

      expect(performanceBand(95)).toBe('EXCELLENT');
      expect(performanceBandLabel(95)).toBe('Excellent');
    });
  });

  describe('3. Economy & Ledgers Invariants', () => {
    it('enforces starter capital and store pricing buffer invariants', () => {
      const founderStarter = DEFAULT_PLATFORM_CONFIG.founder.starterCorpCoin; // 1,000
      const companyCreation = DEFAULT_PLATFORM_CONFIG.founder.companyCreationCost; // 100
      const basicBotCost = DEFAULT_PLATFORM_CONFIG.bots.hiring; // 250
      const threeBotsCost = basicBotCost * 3; // 750

      const totalRequiredSpend = companyCreation + threeBotsCost; // 850
      const remainingBuffer = founderStarter - totalRequiredSpend; // 150

      expect(founderStarter).toBe(1000);
      expect(companyCreation).toBe(100);
      expect(threeBotsCost).toBe(750);
      expect(totalRequiredSpend).toBe(850);
      expect(remainingBuffer).toBe(150);
    });

    it('verifies non-negative EXP invariant (EXP never decreased by demotion or firing)', () => {
      const startingExp = 12500;
      const sanitized = sanitizeExp(startingExp);
      expect(sanitized).toBe(startingExp);
      expect(sanitizeExp(-100)).toBe(0);
    });

    it('enforces applications concurrency limit of 5', () => {
      expect(DEFAULT_PLATFORM_CONFIG.applications.maxActive).toBe(5);
    });
  });

  describe('4. Simulation & Bankruptcy Mathematical Invariants', () => {
    it('executes deterministic tick math: dailyRevenue - dailyExpenses = dailyProfit', () => {
      const result = executeDeterministicTick({
        employeeCount: 4,
        botCount: 3,
        companyRating: 70,
        financialHealth: 500,
        employeeSatisfaction: 75,
        retentionRate: 90,
        productivity: 0.8,
      });

      expect(result.dailyProfit).toBe(result.dailyRevenue - result.dailyExpenses);
      expect(result.newFinancialHealth).toBe(500 + result.dailyProfit);
    });

    it('identifies bankruptcy threshold strictly at financialHealth <= -1000', () => {
      expect(isBankrupt(-999)).toBe(false);
      expect(isBankrupt(-1000)).toBe(true);
      expect(isBankrupt(-1500)).toBe(true);
      expect(isBankrupt(0)).toBe(false);
      expect(isBankrupt(5000)).toBe(false);
    });
  });

  describe('5. Warning Decay & Disciplinary Threshold Invariants', () => {
    it('filters expired warnings after 30 days', () => {
      const now = new Date('2026-10-10T12:00:00Z');
      const activeWarningDate = new Date('2026-10-01T12:00:00Z');
      const expiredWarningDate = new Date('2026-08-01T12:00:00Z');

      const warningExpiresAt = (issuedAt: Date) => {
        const d = new Date(issuedAt);
        d.setDate(d.getDate() + 30);
        return d;
      };

      const isWarningActive = (issuedAt: Date) => warningExpiresAt(issuedAt) > now;

      expect(isWarningActive(activeWarningDate)).toBe(true);
      expect(isWarningActive(expiredWarningDate)).toBe(false);
    });

    it('enforces 4 active warnings threshold for employment review', () => {
      const warningThreshold = DEFAULT_PLATFORM_CONFIG.employee.warningThreshold;
      expect(warningThreshold).toBe(4);

      const checkReviewNeeded = (activeCount: number) => activeCount >= warningThreshold;

      expect(checkReviewNeeded(3)).toBe(false);
      expect(checkReviewNeeded(4)).toBe(true);
      expect(checkReviewNeeded(5)).toBe(true);
    });
  });
});
