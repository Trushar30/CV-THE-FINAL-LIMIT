import { describe, it, expect } from 'vitest';
import {
  ApplicationStateMachine,
  TERMINAL_STATUSES,
} from '../services/career/applicationStateMachine.js';
import type {
  ApplicationStage,
  ApplicationStatus,
} from '../types/enums.js';
import type { IApplicationDocument, IStageHistoryEntry } from '../models/Application.js';

interface TestApplication {
  currentStage: ApplicationStage;
  status: ApplicationStatus;
  stageHistory: IStageHistoryEntry[];
  rejectionReason?: string;
  withdrawalReason?: string;
  expiryReason?: string;
}

function createMockApplication(
  stage: ApplicationStage = 'APPLIED',
  status: ApplicationStatus = 'ACTIVE'
): TestApplication {
  return {
    currentStage: stage,
    status,
    stageHistory: [
      {
        stage,
        enteredAt: new Date(Date.now() - 60000),
      },
    ],
  };
}

const asDoc = (app: TestApplication): IApplicationDocument => app as unknown as IApplicationDocument;

describe('ApplicationStateMachine — Complete State Machine Specification Suite (TASK P6.1)', () => {
  describe('1. Legal Sequential Forward Pipeline Transitions', () => {
    it('should transition APPLIED -> ATS_SCREENING', () => {
      const app = createMockApplication('APPLIED');
      ApplicationStateMachine.advanceStage(asDoc(app), 'ATS_SCREENING');

      expect(app.currentStage).toBe('ATS_SCREENING');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory).toHaveLength(2);
      expect(app.stageHistory[0].exitedAt).toBeDefined();
      expect(app.stageHistory[0].result).toBe('ADVANCED_TO_ATS_SCREENING');
      expect(app.stageHistory[1].stage).toBe('ATS_SCREENING');
      expect(app.stageHistory[1].exitedAt).toBeUndefined();
    });

    it('should transition ATS_SCREENING -> SCREENING', () => {
      const app = createMockApplication('ATS_SCREENING');
      ApplicationStateMachine.advanceStage(asDoc(app), 'SCREENING');

      expect(app.currentStage).toBe('SCREENING');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory[0].result).toBe('ADVANCED_TO_SCREENING');
    });

    it('should transition SCREENING -> ASSESSMENT', () => {
      const app = createMockApplication('SCREENING');
      ApplicationStateMachine.advanceStage(asDoc(app), 'ASSESSMENT');

      expect(app.currentStage).toBe('ASSESSMENT');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory[0].result).toBe('ADVANCED_TO_ASSESSMENT');
    });

    it('should transition ASSESSMENT -> INTERVIEW', () => {
      const app = createMockApplication('ASSESSMENT');
      ApplicationStateMachine.advanceStage(asDoc(app), 'INTERVIEW');

      expect(app.currentStage).toBe('INTERVIEW');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory[0].result).toBe('ADVANCED_TO_INTERVIEW');
    });

    it('should transition INTERVIEW -> FINAL_REVIEW', () => {
      const app = createMockApplication('INTERVIEW');
      ApplicationStateMachine.advanceStage(asDoc(app), 'FINAL_REVIEW');

      expect(app.currentStage).toBe('FINAL_REVIEW');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory[0].result).toBe('ADVANCED_TO_FINAL_REVIEW');
    });

    it('should transition FINAL_REVIEW -> OFFER', () => {
      const app = createMockApplication('FINAL_REVIEW');
      ApplicationStateMachine.advanceStage(asDoc(app), 'OFFER');

      expect(app.currentStage).toBe('OFFER');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory[0].result).toBe('ADVANCED_TO_OFFER');
    });

    it('should transition OFFER -> ACCEPTED (terminal acceptance)', () => {
      const app = createMockApplication('OFFER');
      ApplicationStateMachine.acceptOffer(asDoc(app));

      expect(app.currentStage).toBe('ACCEPTED');
      expect(app.status).toBe('ACCEPTED');
      expect(app.stageHistory).toHaveLength(2);
      expect(app.stageHistory[0].exitedAt).toBeDefined();
      expect(app.stageHistory[0].result).toBe('OFFER_ACCEPTED');
      expect(app.stageHistory[1].stage).toBe('ACCEPTED');
      expect(app.stageHistory[1].exitedAt).toBeDefined();
      expect(app.stageHistory[1].result).toBe('OFFER_ACCEPTED');
    });

    it('should traverse the complete 8-stage forward pipeline end-to-end', () => {
      const app = createMockApplication('APPLIED');

      const stages: ApplicationStage[] = [
        'ATS_SCREENING',
        'SCREENING',
        'ASSESSMENT',
        'INTERVIEW',
        'FINAL_REVIEW',
        'OFFER',
      ];

      for (const nextStage of stages) {
        ApplicationStateMachine.advanceStage(asDoc(app), nextStage);
        expect(app.currentStage).toBe(nextStage);
        expect(app.status).toBe('ACTIVE');
      }

      ApplicationStateMachine.acceptOffer(asDoc(app));
      expect(app.currentStage).toBe('ACCEPTED');
      expect(app.status).toBe('ACCEPTED');
      expect(app.stageHistory).toHaveLength(8);
    });
  });

  describe('2. Legal Terminal Rejection Transitions', () => {
    const rejectableStages: ApplicationStage[] = [
      'APPLIED',
      'ATS_SCREENING',
      'SCREENING',
      'ASSESSMENT',
      'INTERVIEW',
      'FINAL_REVIEW',
      'OFFER',
    ];

    for (const stage of rejectableStages) {
      it(`should permit rejection at stage '${stage}'`, () => {
        const app = createMockApplication(stage);
        ApplicationStateMachine.reject(asDoc(app), {
          reason: `Failed criteria at ${stage}`,
        });

        expect(app.currentStage).toBe(stage);
        expect(app.status).toBe('REJECTED');
        expect(app.rejectionReason).toBe(`Failed criteria at ${stage}`);
        expect(app.stageHistory[0].exitedAt).toBeDefined();
        expect(app.stageHistory[0].result).toBe('REJECTED');
      });
    }
  });

  describe('3. Legal Candidate Voluntary Withdrawal Transitions', () => {
    const withdrawableStages: ApplicationStage[] = [
      'APPLIED',
      'ATS_SCREENING',
      'SCREENING',
      'ASSESSMENT',
      'INTERVIEW',
      'FINAL_REVIEW',
      'OFFER',
    ];

    for (const stage of withdrawableStages) {
      it(`should permit withdrawal at stage '${stage}'`, () => {
        const app = createMockApplication(stage);
        ApplicationStateMachine.withdraw(asDoc(app), {
          reason: `Withdrawn at ${stage} by candidate`,
        });

        expect(app.currentStage).toBe(stage);
        expect(app.status).toBe('WITHDRAWN');
        expect(app.withdrawalReason).toBe(`Withdrawn at ${stage} by candidate`);
        expect(app.stageHistory[0].exitedAt).toBeDefined();
        expect(app.stageHistory[0].result).toBe('WITHDRAWN');
      });
    }
  });

  describe('4. Legal Application Inactivity Expiry Transitions', () => {
    const expirableStages: ApplicationStage[] = [
      'APPLIED',
      'ATS_SCREENING',
      'SCREENING',
      'ASSESSMENT',
      'INTERVIEW',
      'FINAL_REVIEW',
      'OFFER',
    ];

    for (const stage of expirableStages) {
      it(`should permit expiry at stage '${stage}'`, () => {
        const app = createMockApplication(stage);
        ApplicationStateMachine.expire(asDoc(app), {
          reason: `Expired due to staleness at ${stage}`,
        });

        expect(app.currentStage).toBe(stage);
        expect(app.status).toBe('EXPIRED');
        expect(app.expiryReason).toBe(`Expired due to staleness at ${stage}`);
        expect(app.stageHistory[0].exitedAt).toBeDefined();
        expect(app.stageHistory[0].result).toBe('EXPIRED');
      });
    }
  });

  describe('5. Illegal Transitions From Terminal States (Must Throw)', () => {
    for (const terminalStatus of TERMINAL_STATUSES) {
      it(`should throw when attempting ANY forward transition from terminal status '${terminalStatus}'`, () => {
        const app = createMockApplication('OFFER', terminalStatus);

        expect(() =>
          ApplicationStateMachine.advanceStage(asDoc(app), 'ACCEPTED')
        ).toThrowError(/terminal status/i);

        expect(() =>
          ApplicationStateMachine.advanceStage(asDoc(app), 'FINAL_REVIEW')
        ).toThrowError(/terminal status/i);
      });

      it(`should throw when attempting rejection from terminal status '${terminalStatus}'`, () => {
        const app = createMockApplication('INTERVIEW', terminalStatus);

        expect(() =>
          ApplicationStateMachine.reject(asDoc(app), { reason: 'Another rejection' })
        ).toThrowError(/terminal status/i);
      });

      it(`should throw when attempting withdrawal from terminal status '${terminalStatus}'`, () => {
        const app = createMockApplication('INTERVIEW', terminalStatus);

        expect(() =>
          ApplicationStateMachine.withdraw(asDoc(app), { reason: 'Another withdrawal' })
        ).toThrowError(/terminal status/i);
      });

      it(`should throw when attempting expiry from terminal status '${terminalStatus}'`, () => {
        const app = createMockApplication('INTERVIEW', terminalStatus);

        expect(() =>
          ApplicationStateMachine.expire(asDoc(app), { reason: 'Another expiry' })
        ).toThrowError(/terminal status/i);
      });
    }
  });

  describe('6. Illegal Stage Skipping Transitions (Must Throw)', () => {
    it('should throw when skipping from APPLIED directly to SCREENING', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'SCREENING')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from APPLIED directly to ASSESSMENT', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'ASSESSMENT')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from APPLIED directly to INTERVIEW', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'INTERVIEW')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from APPLIED directly to FINAL_REVIEW', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'FINAL_REVIEW')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from APPLIED directly to OFFER', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'OFFER')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from APPLIED directly to ACCEPTED', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'ACCEPTED')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from ATS_SCREENING directly to ASSESSMENT', () => {
      const app = createMockApplication('ATS_SCREENING');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'ASSESSMENT')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from SCREENING directly to OFFER', () => {
      const app = createMockApplication('SCREENING');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'OFFER')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when skipping from INTERVIEW directly to OFFER', () => {
      const app = createMockApplication('INTERVIEW');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'OFFER')).toThrowError(
        /illegal stage transition/i
      );
    });
  });

  describe('7. Illegal Backward Stage Transitions (Must Throw)', () => {
    it('should throw when moving backward from ATS_SCREENING to APPLIED', () => {
      const app = createMockApplication('ATS_SCREENING');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'APPLIED')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when moving backward from SCREENING to ATS_SCREENING', () => {
      const app = createMockApplication('SCREENING');
      expect(() =>
        ApplicationStateMachine.advanceStage(asDoc(app), 'ATS_SCREENING')
      ).toThrowError(/illegal stage transition/i);
    });

    it('should throw when moving backward from INTERVIEW to SCREENING', () => {
      const app = createMockApplication('INTERVIEW');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'SCREENING')).toThrowError(
        /illegal stage transition/i
      );
    });

    it('should throw when moving backward from OFFER to FINAL_REVIEW', () => {
      const app = createMockApplication('OFFER');
      expect(() =>
        ApplicationStateMachine.advanceStage(asDoc(app), 'FINAL_REVIEW')
      ).toThrowError(/illegal stage transition/i);
    });
  });

  describe('8. Illegal ACCEPTED Transitions from Non-OFFER Stages (Must Throw)', () => {
    const nonOfferStages: ApplicationStage[] = [
      'APPLIED',
      'ATS_SCREENING',
      'SCREENING',
      'ASSESSMENT',
      'INTERVIEW',
      'FINAL_REVIEW',
    ];

    for (const stage of nonOfferStages) {
      it(`should throw when attempting acceptOffer from stage '${stage}'`, () => {
        const app = createMockApplication(stage);
        expect(() => ApplicationStateMachine.acceptOffer(asDoc(app))).toThrowError(
          /can only be reached from/i
        );
      });
    }
  });

  describe('9. Illegal Self-Transitions & Malformed Targets (Must Throw)', () => {
    it('should throw on self-transition to identical stage without status change', () => {
      const app = createMockApplication('APPLIED');
      expect(() => ApplicationStateMachine.advanceStage(asDoc(app), 'APPLIED')).toThrowError(
        /already in stage/i
      );
    });

    it('should throw when target has neither nextStage nor terminalStatus', () => {
      const app = createMockApplication('APPLIED');
      expect(() =>
        ApplicationStateMachine.transition(asDoc(app), {})
      ).toThrowError(/must specify either nextStage or terminalStatus/i);
    });

    it('should throw on invalid stage name', () => {
      const app = createMockApplication('APPLIED');
      expect(() =>
        ApplicationStateMachine.advanceStage(asDoc(app), 'NON_EXISTENT_STAGE' as unknown as ApplicationStage)
      ).toThrowError(/invalid stage/i);
    });

    it('should throw on invalid terminal status', () => {
      const app = createMockApplication('APPLIED');
      expect(() =>
        ApplicationStateMachine.transition(asDoc(app), {
          terminalStatus: 'INVALID_STATUS' as unknown as 'REJECTED',
        })
      ).toThrowError(/invalid terminal status/i);
    });
  });

  describe('10. canTransition Boolean Helper Method', () => {
    it('should accurately return true for valid transitions and false for invalid ones', () => {
      expect(
        ApplicationStateMachine.canTransition('APPLIED', 'ACTIVE', {
          nextStage: 'ATS_SCREENING',
        })
      ).toBe(true);

      expect(
        ApplicationStateMachine.canTransition('APPLIED', 'ACTIVE', {
          nextStage: 'INTERVIEW',
        })
      ).toBe(false);

      expect(
        ApplicationStateMachine.canTransition('INTERVIEW', 'REJECTED', {
          nextStage: 'FINAL_REVIEW',
        })
      ).toBe(false);

      expect(
        ApplicationStateMachine.canTransition('OFFER', 'ACTIVE', {
          terminalStatus: 'ACCEPTED',
        })
      ).toBe(true);

      expect(
        ApplicationStateMachine.canTransition('SCREENING', 'ACTIVE', {
          terminalStatus: 'ACCEPTED',
        })
      ).toBe(false);
    });
  });
});
