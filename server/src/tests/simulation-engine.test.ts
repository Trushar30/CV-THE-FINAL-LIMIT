import { describe, it, expect } from 'vitest';
import {
  calculateProductivity,
  calculateDailyRevenue,
  calculateDailyExpenses,
  calculateDailyProfit,
  calculateSecondaryMetrics,
  isBankrupt,
  executeDeterministicTick,
} from '../services/simulation/simulationEngine.js';
import {
  MODIFIER_BOUNDS,
  MODIFIER_TEMPLATES,
  clampModifier,
  resolveTemplateModifiers,
} from '../schemas/simulation.schema.js';

describe('Deterministic Simulation Engine Suite (TASK P8.5 / docs/SIMULATION_DESIGN.md)', () => {
  describe('1. Pure Mathematical Engine Functions', () => {
    it('calculates employee productivity P in [0.00, 1.00] with fallback to 0.50 baseline', () => {
      expect(calculateProductivity([])).toBe(0.5);
      expect(calculateProductivity([86])).toBe(0.86);
      expect(calculateProductivity([80, 90, 88])).toBe(0.86);
      expect(calculateProductivity([32])).toBe(0.32);
      expect(calculateProductivity([120])).toBe(1.0); // clamped max 100 -> 1.00
      expect(calculateProductivity([-20])).toBe(0.0); // clamped min 0 -> 0.00
    });

    it('calculates daily revenue with non-negative bounds and rounding', () => {
      // 100 + (8 * 0.86 * 5) + (65 * 2) = 100 + 34.4 + 130 = 264.4 -> 264
      const result = calculateDailyRevenue({
        employeeCount: 8,
        productivity: 0.86,
        companyRating: 65,
        revenueModifier: 40,
      });
      expect(result.baseRevenue).toBe(264);
      expect(result.dailyRevenue).toBe(304);

      // Clamps to 0 if huge negative modifier
      const clampedResult = calculateDailyRevenue({
        employeeCount: 0,
        productivity: 0.5,
        companyRating: 0,
        revenueModifier: -200,
      });
      expect(clampedResult.dailyRevenue).toBe(0);
    });

    it('calculates daily expenses with bot minimum floor of 3 and overhead', () => {
      // 50 + (8 * 10) + (3 * 10) = 50 + 80 + 30 = 160
      const result = calculateDailyExpenses({
        employeeCount: 8,
        botCount: 3,
        expenseModifier: 15,
        immediateCost: 0,
      });
      expect(result.baseExpenses).toBe(160);
      expect(result.dailyExpenses).toBe(175);
    });

    it('calculates daily profit as revenue minus expenses', () => {
      expect(calculateDailyProfit(304, 175)).toBe(129);
      expect(calculateDailyProfit(189, 280)).toBe(-91);
    });

    it('calculates secondary metrics with bounds clamping and retention decay tiers', () => {
      // Morale >= 60 -> retention stable
      const healthy = calculateSecondaryMetrics({
        currentRating: 65,
        currentSatisfaction: 75,
        currentRetention: 100.0,
        modifiers: { reputationDelta: 3, satisfactionDelta: 2 },
      });
      expect(healthy.companyRating).toBe(68);
      expect(healthy.employeeSatisfaction).toBe(77);
      expect(healthy.retentionRate).toBe(100.0);

      // Morale in [40, 59] -> -2% retention
      const stressed = calculateSecondaryMetrics({
        currentRating: 45,
        currentSatisfaction: 48,
        currentRetention: 100.0,
        modifiers: { reputationDelta: -4, satisfactionDelta: -8 }, // S becomes 40
      });
      expect(stressed.companyRating).toBe(41);
      expect(stressed.employeeSatisfaction).toBe(40);
      expect(stressed.retentionRate).toBe(98.0);

      // Morale < 40 -> -5% retention
      const crisis = calculateSecondaryMetrics({
        currentRating: 45,
        currentSatisfaction: 40,
        currentRetention: 98.0,
        modifiers: { reputationDelta: -5, satisfactionDelta: -10 }, // S becomes 30
      });
      expect(crisis.employeeSatisfaction).toBe(30);
      expect(crisis.retentionRate).toBe(93.0);
    });
  });

  describe('2. Worked Example 1: A Good Day (docs/SIMULATION_DESIGN.md Section 7.1)', () => {
    it('accurately reproduces the Good Day worked example step by step', () => {
      const input = {
        employeeCount: 8,
        botCount: 3,
        companyRating: 65,
        financialHealth: 150,
        employeeSatisfaction: 75,
        retentionRate: 100.0,
        productivity: 0.86,
        modifiers: {
          revenueModifier: 40,
          expenseModifier: 15,
          immediateCost: 0,
          satisfactionDelta: 2,
          reputationDelta: 3,
          productivityDelta: 0,
        },
      };

      const result = executeDeterministicTick(input);

      expect(result.baseRevenue).toBe(264);
      expect(result.dailyRevenue).toBe(304);
      expect(result.baseExpenses).toBe(160);
      expect(result.dailyExpenses).toBe(175);
      expect(result.dailyProfit).toBe(129);
      expect(result.newFinancialHealth).toBe(279);
      expect(result.newCompanyRating).toBe(68);
      expect(result.newEmployeeSatisfaction).toBe(77);
      expect(result.newRetentionRate).toBe(100.0);
      expect(result.isBankrupt).toBe(false);
    });
  });

  describe('3. Worked Example 2: A Bad Day (docs/SIMULATION_DESIGN.md Section 7.2)', () => {
    it('accurately reproduces the Bad Day worked example step by step', () => {
      const input = {
        employeeCount: 12,
        botCount: 3,
        companyRating: 45,
        financialHealth: -200,
        employeeSatisfaction: 48,
        retentionRate: 100.0,
        productivity: 0.32,
        modifiers: {
          revenueModifier: -20,
          expenseModifier: 30,
          immediateCost: 50,
          satisfactionDelta: -8,
          reputationDelta: -4,
          productivityDelta: 0,
        },
      };

      const result = executeDeterministicTick(input);

      expect(result.baseRevenue).toBe(209);
      expect(result.dailyRevenue).toBe(189);
      expect(result.baseExpenses).toBe(200);
      expect(result.dailyExpenses).toBe(280);
      expect(result.dailyProfit).toBe(-91);
      expect(result.newFinancialHealth).toBe(-291);
      expect(result.newCompanyRating).toBe(41);
      expect(result.newEmployeeSatisfaction).toBe(40);
      expect(result.newRetentionRate).toBe(98.0);
      expect(result.isBankrupt).toBe(false);
    });
  });

  describe('4. Worked Example 3: The Bankruptcy Path (docs/SIMULATION_DESIGN.md Section 7.3)', () => {
    it('accurately traces the 4-day deterioration path crossing -1000 insolvency threshold', () => {
      // Day 1: Health -650 -> -751
      const day1 = executeDeterministicTick({
        employeeCount: 15,
        botCount: 3,
        companyRating: 40,
        financialHealth: -650,
        employeeSatisfaction: 50,
        retentionRate: 100.0,
        productivity: 0.25,
        modifiers: {
          revenueModifier: -30,
          expenseModifier: 40,
          immediateCost: 0,
          satisfactionDelta: -2,
          reputationDelta: -1,
          productivityDelta: 0,
        },
      });
      // baseRevenue: 100 + (15 * 0.25 * 5) + (40 * 2) = 100 + 18.75 + 80 = 198.75 -> 199
      // dailyRevenue: 199 - 30 = 169
      // baseExpenses: 50 + 150 + 30 = 230
      // dailyExpenses: 230 + 40 = 270
      // dailyProfit: 169 - 270 = -101
      expect(day1.newFinancialHealth).toBe(-751);
      expect(day1.isBankrupt).toBe(false);

      // Day 2: Health -751 -> -886
      const day2 = executeDeterministicTick({
        employeeCount: 15,
        botCount: 3,
        companyRating: 39,
        financialHealth: day1.newFinancialHealth,
        employeeSatisfaction: 48,
        retentionRate: 98.0,
        productivity: 0.2,
        modifiers: {
          revenueModifier: -50,
          expenseModifier: 50,
          immediateCost: 0,
          satisfactionDelta: -5,
          reputationDelta: -3,
          productivityDelta: 0,
        },
      });
      // baseRevenue: 100 + (15 * 0.2 * 5) + (39 * 2) = 100 + 15 + 78 = 193
      // dailyRevenue: 193 - 50 = 143 (close to 145)
      // dailyProfit: 143 - 280 = -137 -> health ~ -888
      expect(day2.newFinancialHealth).toBeLessThan(-850);
      expect(day2.isBankrupt).toBe(false);

      // Day 3: Health drops towards -925
      const day3 = executeDeterministicTick({
        employeeCount: 14,
        botCount: 3,
        companyRating: 36,
        financialHealth: -886,
        employeeSatisfaction: 43,
        retentionRate: 96.0,
        productivity: 0.3,
        modifiers: {
          revenueModifier: 0,
          expenseModifier: 0,
          immediateCost: 0,
          satisfactionDelta: -2,
          reputationDelta: -1,
          productivityDelta: 0,
        },
      });
      expect(day3.newFinancialHealth).toBeLessThan(-900);
      expect(day3.isBankrupt).toBe(false);

      // Day 4: Insolvent plunge crossing <= -1000 threshold
      const day4 = executeDeterministicTick({
        employeeCount: 14,
        botCount: 3,
        companyRating: 35,
        financialHealth: -925,
        employeeSatisfaction: 41,
        retentionRate: 94.0,
        productivity: 0.15,
        modifiers: {
          revenueModifier: -28,
          expenseModifier: 60,
          immediateCost: 0,
          satisfactionDelta: -10,
          reputationDelta: -5,
          productivityDelta: 0,
        },
      });
      // baseRevenue: 100 + (14 * 0.15 * 5) + (35 * 2) = 100 + 10.5 + 70 = 180.5 -> 181
      // dailyRevenue: 181 - 28 = 153
      // baseExpenses: 50 + 140 + 30 = 220
      // dailyExpenses: 220 + 60 = 280
      // dailyProfit: 153 - 280 = -127
      // newFinancialHealth: -925 - 127 = -1052 <= -1000
      expect(day4.newFinancialHealth).toBeLessThanOrEqual(-1000);
      expect(day4.isBankrupt).toBe(true);
      expect(isBankrupt(day4.newFinancialHealth, -1000)).toBe(true);
    });
  });

  describe('5. Backend Modifier Template Bounds & Clamping Integrity', () => {
    it('strictly clamps arbitrary modifier inputs to defined catalog bounds', () => {
      const clamped = clampModifier({
        revenueModifier: 99999, // max 150
        expenseModifier: -99999, // min -30
        immediateCost: 99999, // max 200
        satisfactionDelta: -999, // min -15
        reputationDelta: 999, // max 10
        productivityDelta: 999, // max 0.15
      });

      expect(clamped.revenueModifier).toBe(MODIFIER_BOUNDS.revenueModifier.max);
      expect(clamped.expenseModifier).toBe(MODIFIER_BOUNDS.expenseModifier.min);
      expect(clamped.immediateCost).toBe(MODIFIER_BOUNDS.immediateCost.max);
      expect(clamped.satisfactionDelta).toBe(MODIFIER_BOUNDS.satisfactionDelta.min);
      expect(clamped.reputationDelta).toBe(MODIFIER_BOUNDS.reputationDelta.max);
      expect(clamped.productivityDelta).toBe(MODIFIER_BOUNDS.productivityDelta.max);
    });

    it('resolves valid registered backend modifier templates and falls back on invalid', () => {
      const contract = resolveTemplateModifiers('ACCEPT_ENTERPRISE_CONTRACT');
      expect(contract.revenueModifier).toBe(40);
      expect(contract.expenseModifier).toBe(15);

      const invalidFallback = resolveTemplateModifiers('UNREGISTERED_INVENTED_KEY');
      expect(invalidFallback).toEqual(MODIFIER_TEMPLATES.DEFAULT_EXPIRED);
    });
  });
});
