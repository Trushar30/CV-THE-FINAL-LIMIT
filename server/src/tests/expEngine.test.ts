import { describe, it, expect } from 'vitest';
import {
  levelForExp,
  calculateTaskExp,
  performanceBand,
  performanceBandLabel,
  getPerformanceBandDetails,
  getLevelDetails,
  clampScore,
  sanitizeExp,
} from '../services/economy/expEngine.js';
import { DEFAULT_LEVEL_TABLE, LevelDefinition } from '../config/platformConfig.schema.js';

describe('Level and EXP Engine (TASK P7.1)', () => {
  describe('clampScore', () => {
    it('should pass through valid numbers between 0 and 100', () => {
      expect(clampScore(0)).toBe(0);
      expect(clampScore(50)).toBe(50);
      expect(clampScore(100)).toBe(100);
      expect(clampScore(72.5)).toBe(72.5);
    });

    it('should clamp negative numbers to 0', () => {
      expect(clampScore(-1)).toBe(0);
      expect(clampScore(-50)).toBe(0);
      expect(clampScore(-9999)).toBe(0);
    });

    it('should clamp numbers greater than 100 to 100', () => {
      expect(clampScore(101)).toBe(100);
      expect(clampScore(150)).toBe(100);
      expect(clampScore(9999)).toBe(100);
    });

    it('should parse and clamp valid numeric strings', () => {
      expect(clampScore('85')).toBe(85);
      expect(clampScore(' 92 ')).toBe(92);
      expect(clampScore('-10')).toBe(0);
      expect(clampScore('150')).toBe(100);
    });

    it('should handle absurd values (NaN, null, undefined, non-numeric strings, non-finite)', () => {
      expect(clampScore(NaN)).toBe(0);
      expect(clampScore(null)).toBe(0);
      expect(clampScore(undefined)).toBe(0);
      expect(clampScore('absurd_ai_output')).toBe(0);
      expect(clampScore('')).toBe(0);
      expect(clampScore({})).toBe(0);
      expect(clampScore([])).toBe(0);
      expect(clampScore(true)).toBe(0);
      expect(clampScore(false)).toBe(0);
      expect(clampScore(Infinity)).toBe(0);
      expect(clampScore(-Infinity)).toBe(0);
    });
  });

  describe('sanitizeExp', () => {
    it('should pass through positive integers', () => {
      expect(sanitizeExp(0)).toBe(0);
      expect(sanitizeExp(500)).toBe(500);
      expect(sanitizeExp(12000)).toBe(12000);
    });

    it('should floor floating-point numbers', () => {
      expect(sanitizeExp(499.9)).toBe(499);
      expect(sanitizeExp(1200.1)).toBe(1200);
    });

    it('should clamp negative numbers to 0', () => {
      expect(sanitizeExp(-1)).toBe(0);
      expect(sanitizeExp(-500)).toBe(0);
    });

    it('should parse numeric strings', () => {
      expect(sanitizeExp('500')).toBe(500);
      expect(sanitizeExp(' 12000 ')).toBe(12000);
      expect(sanitizeExp('-50')).toBe(0);
    });

    it('should fallback to 0 for invalid types', () => {
      expect(sanitizeExp(NaN)).toBe(0);
      expect(sanitizeExp(null)).toBe(0);
      expect(sanitizeExp(undefined)).toBe(0);
      expect(sanitizeExp('invalid')).toBe(0);
      expect(sanitizeExp(Infinity)).toBe(0);
    });
  });

  describe('levelForExp (GEMINI.md Section 5 Table)', () => {
    it('should map Level 1 boundaries (0 to 499 EXP)', () => {
      expect(levelForExp(0)).toBe(1);
      expect(levelForExp(1)).toBe(1);
      expect(levelForExp(250)).toBe(1);
      expect(levelForExp(499)).toBe(1);
    });

    it('should map Level 2 boundaries (500 to 1199 EXP)', () => {
      expect(levelForExp(500)).toBe(2);
      expect(levelForExp(501)).toBe(2);
      expect(levelForExp(850)).toBe(2);
      expect(levelForExp(1199)).toBe(2);
    });

    it('should map Level 3 boundaries (1200 to 1999 EXP)', () => {
      expect(levelForExp(1200)).toBe(3);
      expect(levelForExp(1201)).toBe(3);
      expect(levelForExp(1600)).toBe(3);
      expect(levelForExp(1999)).toBe(3);
    });

    it('should map Level 4 boundaries (2000 to 2999 EXP)', () => {
      expect(levelForExp(2000)).toBe(4);
      expect(levelForExp(2001)).toBe(4);
      expect(levelForExp(2500)).toBe(4);
      expect(levelForExp(2999)).toBe(4);
    });

    it('should map Level 5 boundaries (3000 to 4499 EXP)', () => {
      expect(levelForExp(3000)).toBe(5);
      expect(levelForExp(3001)).toBe(5);
      expect(levelForExp(3800)).toBe(5);
      expect(levelForExp(4499)).toBe(5);
    });

    it('should map Level 6 boundaries (4500 to 6499 EXP)', () => {
      expect(levelForExp(4500)).toBe(6);
      expect(levelForExp(4501)).toBe(6);
      expect(levelForExp(5500)).toBe(6);
      expect(levelForExp(6499)).toBe(6);
    });

    it('should map Level 7 boundaries (6500 to 8999 EXP)', () => {
      expect(levelForExp(6500)).toBe(7);
      expect(levelForExp(6501)).toBe(7);
      expect(levelForExp(7700)).toBe(7);
      expect(levelForExp(8999)).toBe(7);
    });

    it('should map Level 8 boundaries (9000 to 11999 EXP)', () => {
      expect(levelForExp(9000)).toBe(8);
      expect(levelForExp(9001)).toBe(8);
      expect(levelForExp(10500)).toBe(8);
      expect(levelForExp(11999)).toBe(8);
    });

    it('should map Level 9 boundaries (12000 to 15999 EXP - Founder Mode Unlock)', () => {
      expect(levelForExp(12000)).toBe(9);
      expect(levelForExp(12001)).toBe(9);
      expect(levelForExp(14000)).toBe(9);
      expect(levelForExp(15999)).toBe(9);
    });

    it('should map Level 10 boundaries (>= 16000 EXP - Max Level Principal)', () => {
      expect(levelForExp(16000)).toBe(10);
      expect(levelForExp(16001)).toBe(10);
      expect(levelForExp(25000)).toBe(10);
      expect(levelForExp(1000000)).toBe(10);
    });

    it('should clamp absurd/negative values to Level 1', () => {
      expect(levelForExp(-1)).toBe(1);
      expect(levelForExp(-500)).toBe(1);
      expect(levelForExp(-9999)).toBe(1);
      expect(levelForExp(NaN)).toBe(1);
      expect(levelForExp(null)).toBe(1);
      expect(levelForExp(undefined)).toBe(1);
      expect(levelForExp('not-a-number')).toBe(1);
    });

    it('should handle string EXP inputs correctly', () => {
      expect(levelForExp('0')).toBe(1);
      expect(levelForExp('500')).toBe(2);
      expect(levelForExp('1200')).toBe(3);
      expect(levelForExp('12000')).toBe(9);
      expect(levelForExp(' 16000 ')).toBe(10);
    });

    it('should support custom level tables', () => {
      const customTable: LevelDefinition[] = [
        { level: 1, title: 'Apprentice', minExp: 0 },
        { level: 2, title: 'Journeyman', minExp: 100 },
        { level: 3, title: 'Master', minExp: 300 },
      ];

      expect(levelForExp(50, customTable)).toBe(1);
      expect(levelForExp(100, customTable)).toBe(2);
      expect(levelForExp(299, customTable)).toBe(2);
      expect(levelForExp(300, customTable)).toBe(3);
      expect(levelForExp(1000, customTable)).toBe(3);
    });

    it('should use DEFAULT_LEVEL_TABLE when explicitly provided', () => {
      expect(levelForExp(12000, DEFAULT_LEVEL_TABLE)).toBe(9);
      expect(levelForExp(16000, DEFAULT_LEVEL_TABLE)).toBe(10);
    });
  });

  describe('calculateTaskExp (Approved D2 & Spec Section 10.3 Formula)', () => {
    it('should compute exact proportional EXP for Easy tasks (maxExp: 30)', () => {
      expect(calculateTaskExp(0, 30)).toBe(0);
      expect(calculateTaskExp(50, 30)).toBe(15);
      expect(calculateTaskExp(100, 30)).toBe(30);
      // 75% of 30 is 22.5 -> rounds to 23
      expect(calculateTaskExp(75, 30)).toBe(23);
      // 33% of 30 is 9.9 -> rounds to 10
      expect(calculateTaskExp(33, 30)).toBe(10);
      // 90% of 30 is 27
      expect(calculateTaskExp(90, 30)).toBe(27);
    });

    it('should compute exact proportional EXP for Medium tasks (maxExp: 60)', () => {
      expect(calculateTaskExp(0, 60)).toBe(0);
      expect(calculateTaskExp(50, 60)).toBe(30);
      expect(calculateTaskExp(100, 60)).toBe(60);
      expect(calculateTaskExp(75, 60)).toBe(45);
      // 33% of 60 is 19.8 -> rounds to 20
      expect(calculateTaskExp(33, 60)).toBe(20);
      expect(calculateTaskExp(80, 60)).toBe(48);
    });

    it('should compute exact proportional EXP for Hard tasks (maxExp: 100)', () => {
      expect(calculateTaskExp(0, 100)).toBe(0);
      expect(calculateTaskExp(50, 100)).toBe(50);
      expect(calculateTaskExp(100, 100)).toBe(100);
      expect(calculateTaskExp(75, 100)).toBe(75);
      expect(calculateTaskExp(88, 100)).toBe(88);
      expect(calculateTaskExp(95, 100)).toBe(95);
    });

    it('should strictly clamp absurd negative scores to 0 EXP', () => {
      expect(calculateTaskExp(-1, 30)).toBe(0);
      expect(calculateTaskExp(-50, 60)).toBe(0);
      expect(calculateTaskExp(-9999, 100)).toBe(0);
    });

    it('should strictly clamp absurd scores above 100 to maxExp', () => {
      expect(calculateTaskExp(105, 30)).toBe(30);
      expect(calculateTaskExp(150, 60)).toBe(60);
      expect(calculateTaskExp(9999, 100)).toBe(100);
    });

    it('should handle absurd AI values (NaN, null, undefined, strings, booleans)', () => {
      expect(calculateTaskExp(NaN, 60)).toBe(0);
      expect(calculateTaskExp(null, 60)).toBe(0);
      expect(calculateTaskExp(undefined, 60)).toBe(0);
      expect(calculateTaskExp('invalid_score', 60)).toBe(0);
      expect(calculateTaskExp(true, 60)).toBe(0);
      expect(calculateTaskExp(false, 60)).toBe(0);
    });

    it('should safely parse numeric string scores', () => {
      expect(calculateTaskExp('100', 30)).toBe(30);
      expect(calculateTaskExp('50', 60)).toBe(30);
      expect(calculateTaskExp(' 75 ', 100)).toBe(75);
      expect(calculateTaskExp('150', 30)).toBe(30);
      expect(calculateTaskExp('-20', 30)).toBe(0);
    });

    it('should safely handle invalid or negative maxExp values', () => {
      expect(calculateTaskExp(100, 0)).toBe(0);
      expect(calculateTaskExp(100, -30)).toBe(0);
      expect(calculateTaskExp(100, NaN)).toBe(0);
      expect(calculateTaskExp(100, 'invalid')).toBe(0);
      expect(calculateTaskExp(100, '30')).toBe(30);
    });
  });

  describe('performanceBand & Labels (GEMINI.md Section 5 & Spec Section 11.1)', () => {
    it('should map score band: POOR (0 to 39)', () => {
      expect(performanceBand(0)).toBe('POOR');
      expect(performanceBand(10)).toBe('POOR');
      expect(performanceBand(39)).toBe('POOR');

      expect(performanceBandLabel(0)).toBe('Poor');
      expect(performanceBandLabel(39)).toBe('Poor');

      const details = getPerformanceBandDetails(39);
      expect(details.band).toBe('POOR');
      expect(details.label).toBe('Poor');
      expect(details.isWarningCandidate).toBe(true);
      expect(details.isPerformanceIssue).toBe(false);
    });

    it('should map score band: NEEDS_IMPROVEMENT (40 to 59)', () => {
      expect(performanceBand(40)).toBe('NEEDS_IMPROVEMENT');
      expect(performanceBand(50)).toBe('NEEDS_IMPROVEMENT');
      expect(performanceBand(59)).toBe('NEEDS_IMPROVEMENT');

      expect(performanceBandLabel(40)).toBe('Needs Improvement');
      expect(performanceBandLabel(59)).toBe('Needs Improvement');

      const details = getPerformanceBandDetails(40);
      expect(details.band).toBe('NEEDS_IMPROVEMENT');
      expect(details.label).toBe('Needs Improvement');
      expect(details.isWarningCandidate).toBe(false);
      expect(details.isPerformanceIssue).toBe(true);
    });

    it('should map score band: ACCEPTABLE (60 to 74)', () => {
      expect(performanceBand(60)).toBe('ACCEPTABLE');
      expect(performanceBand(68)).toBe('ACCEPTABLE');
      expect(performanceBand(74)).toBe('ACCEPTABLE');

      expect(performanceBandLabel(60)).toBe('Acceptable');
      expect(performanceBandLabel(74)).toBe('Acceptable');

      const details = getPerformanceBandDetails(60);
      expect(details.band).toBe('ACCEPTABLE');
      expect(details.label).toBe('Acceptable');
      expect(details.isWarningCandidate).toBe(false);
      expect(details.isPerformanceIssue).toBe(false);
    });

    it('should map score band: GOOD (75 to 89)', () => {
      expect(performanceBand(75)).toBe('GOOD');
      expect(performanceBand(80)).toBe('GOOD');
      expect(performanceBand(89)).toBe('GOOD');

      expect(performanceBandLabel(75)).toBe('Good');
      expect(performanceBandLabel(89)).toBe('Good');

      const details = getPerformanceBandDetails(89);
      expect(details.band).toBe('GOOD');
      expect(details.label).toBe('Good');
      expect(details.isWarningCandidate).toBe(false);
      expect(details.isPerformanceIssue).toBe(false);
    });

    it('should map score band: EXCELLENT (90 to 100)', () => {
      expect(performanceBand(90)).toBe('EXCELLENT');
      expect(performanceBand(95)).toBe('EXCELLENT');
      expect(performanceBand(100)).toBe('EXCELLENT');

      expect(performanceBandLabel(90)).toBe('Excellent');
      expect(performanceBandLabel(100)).toBe('Excellent');

      const details = getPerformanceBandDetails(95);
      expect(details.band).toBe('EXCELLENT');
      expect(details.label).toBe('Excellent');
      expect(details.isWarningCandidate).toBe(false);
      expect(details.isPerformanceIssue).toBe(false);
    });

    it('should clamp absurd scores for performance bands', () => {
      expect(performanceBand(-10)).toBe('POOR');
      expect(performanceBand(150)).toBe('EXCELLENT');
      expect(performanceBand(NaN)).toBe('POOR');
      expect(performanceBand(null)).toBe('POOR');
      expect(performanceBand(undefined)).toBe('POOR');
      expect(performanceBand('garbage')).toBe('POOR');
      expect(performanceBand('85')).toBe('GOOD');
      expect(performanceBand(' 95 ')).toBe('EXCELLENT');
    });
  });

  describe('getLevelDetails', () => {
    it('should provide correct details for Level 1 user', () => {
      const details = getLevelDetails(250);
      expect(details.level).toBe(1);
      expect(details.title).toBe('Intern');
      expect(details.minExp).toBe(0);
      expect(details.maxLevel).toBe(10);
      expect(details.isMaxLevel).toBe(false);
      expect(details.nextLevel).toBe(2);
      expect(details.nextLevelTitle).toBe('Junior');
      expect(details.nextLevelMinExp).toBe(500);
      expect(details.currentLevelProgressExp).toBe(250);
      expect(details.expNeededForNextLevel).toBe(250);
      expect(details.progressPercentage).toBe(50);
      expect(details.founderUnlocked).toBe(false);
    });

    it('should calculate progress percentage across Level 2 (500 to 1200, range 700)', () => {
      // 500 + 350 = 850 EXP -> 50%
      const details = getLevelDetails(850);
      expect(details.level).toBe(2);
      expect(details.title).toBe('Junior');
      expect(details.currentLevelProgressExp).toBe(350);
      expect(details.expNeededForNextLevel).toBe(350);
      expect(details.progressPercentage).toBe(50);
      expect(details.founderUnlocked).toBe(false);
    });

    it('should indicate Founder Mode unlock when EXP reaches 12,000 (Level 9)', () => {
      const details = getLevelDetails(12000);
      expect(details.level).toBe(9);
      expect(details.title).toBe('Lead');
      expect(details.founderUnlocked).toBe(true);
      expect(details.nextLevel).toBe(10);
      expect(details.nextLevelTitle).toBe('Principal');
      expect(details.nextLevelMinExp).toBe(16000);
    });

    it('should cap progress at max level (Level 10 Principal >= 16000 EXP)', () => {
      const details = getLevelDetails(18000);
      expect(details.level).toBe(10);
      expect(details.title).toBe('Principal');
      expect(details.isMaxLevel).toBe(true);
      expect(details.nextLevel).toBeNull();
      expect(details.nextLevelTitle).toBeNull();
      expect(details.nextLevelMinExp).toBeNull();
      expect(details.expNeededForNextLevel).toBeNull();
      expect(details.progressPercentage).toBe(100);
      expect(details.founderUnlocked).toBe(true);
    });
  });
});
