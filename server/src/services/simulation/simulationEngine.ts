import type { IScenarioModifier } from '../../models/CompanyScenario.js';

export interface DailyTickInput {
  employeeCount: number; // N (0..20)
  botCount: number; // B (>= 3)
  companyRating: number; // Q (0..100)
  financialHealth: number; // H
  employeeSatisfaction: number; // S (0..100)
  retentionRate: number; // T (0..100)
  productivity: number; // P (0.00..1.00)
  modifiers?: IScenarioModifier;
  bankruptcyThreshold?: number; // default -1000
}

export interface DailyTickResult {
  baseRevenue: number;
  dailyRevenue: number;
  baseExpenses: number;
  dailyExpenses: number;
  dailyProfit: number;
  newFinancialHealth: number;
  newCompanyRating: number;
  newEmployeeSatisfaction: number;
  newRetentionRate: number;
  isBankrupt: boolean;
}

/**
 * Normalizes task performance scores into employee productivity P in [0.00, 1.00]
 */
export function calculateProductivity(taskScores: number[]): number {
  if (!taskScores || taskScores.length === 0) {
    return 0.5; // baseline 50 score
  }

  const validScores = taskScores.filter((s) => typeof s === 'number' && !isNaN(s));
  if (validScores.length === 0) {
    return 0.5;
  }

  const sum = validScores.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / validScores.length;
  const clampedAvg = Math.max(0, Math.min(100, avg));
  return Number((clampedAvg / 100).toFixed(2));
}

/**
 * Step 3: Daily Revenue Computation
 * baseRevenue = 100 + (N * P * 5) + (Q * 2)
 * dailyRevenue = max(0, baseRevenue + revenueModifier)
 */
export function calculateDailyRevenue(params: {
  employeeCount: number;
  productivity: number;
  companyRating: number;
  revenueModifier?: number;
}): { baseRevenue: number; dailyRevenue: number } {
  const N = Math.max(0, Math.min(20, Math.floor(Number(params.employeeCount) || 0)));
  const P = Math.max(0, Math.min(1, Number(params.productivity) || 0));
  const Q = Math.max(0, Math.min(100, Math.floor(Number(params.companyRating) || 0)));
  const revMod = Math.round(Number(params.revenueModifier) || 0);

  // Note: 100 + (N * P * 5) + (Q * 2), rounded to integer
  const rawBase = 100 + N * P * 5 + Q * 2;
  const baseRevenue = Math.round(rawBase);
  const dailyRevenue = Math.max(0, baseRevenue + revMod);

  return { baseRevenue, dailyRevenue };
}

/**
 * Step 4: Daily Expenses Computation
 * baseExpenses = 50 + (N * 10) + (B * 10)
 * dailyExpenses = max(0, baseExpenses + expenseModifier + immediateCost)
 */
export function calculateDailyExpenses(params: {
  employeeCount: number;
  botCount: number;
  expenseModifier?: number;
  immediateCost?: number;
}): { baseExpenses: number; dailyExpenses: number } {
  const N = Math.max(0, Math.min(20, Math.floor(Number(params.employeeCount) || 0)));
  const B = Math.max(3, Math.floor(Number(params.botCount) || 3));
  const expMod = Math.round(Number(params.expenseModifier) || 0);
  const immCost = Math.max(0, Math.round(Number(params.immediateCost) || 0));

  const baseExpenses = 50 + N * 10 + B * 10;
  const dailyExpenses = Math.max(0, baseExpenses + expMod + immCost);

  return { baseExpenses, dailyExpenses };
}

/**
 * Step 5: Net Profit Computation
 * dailyProfit = dailyRevenue - dailyExpenses
 */
export function calculateDailyProfit(dailyRevenue: number, dailyExpenses: number): number {
  return dailyRevenue - dailyExpenses;
}

/**
 * Step 6: Financial Health Update
 * H_new = H_prev + dailyProfit
 */
export function calculateUpdatedHealth(currentHealth: number, dailyProfit: number): number {
  return Math.round(Number(currentHealth) || 0) + dailyProfit;
}

/**
 * Step 6b: Secondary Metrics Clamping & Retention Decay
 */
export function calculateSecondaryMetrics(params: {
  currentRating: number;
  currentSatisfaction: number;
  currentRetention: number;
  modifiers?: Partial<IScenarioModifier>;
}): {
  companyRating: number;
  employeeSatisfaction: number;
  retentionRate: number;
} {
  const Q_prev = Math.max(0, Math.min(100, Math.floor(Number(params.currentRating) || 50)));
  const S_prev = Math.max(0, Math.min(100, Math.floor(Number(params.currentSatisfaction) || 70)));
  const T_prev = Math.max(
    0,
    Math.min(100, typeof params.currentRetention === 'number' ? params.currentRetention : 100)
  );

  const repDelta = Math.round(Number(params.modifiers?.reputationDelta) || 0);
  const satDelta = Math.round(Number(params.modifiers?.satisfactionDelta) || 0);

  const companyRating = Math.max(0, Math.min(100, Q_prev + repDelta));
  const employeeSatisfaction = Math.max(0, Math.min(100, S_prev + satDelta));

  let retentionRate = T_prev;
  if (employeeSatisfaction >= 60) {
    retentionRate = T_prev;
  } else if (employeeSatisfaction >= 40) {
    retentionRate = Math.max(0, Number((T_prev - 2.0).toFixed(1)));
  } else {
    retentionRate = Math.max(0, Number((T_prev - 5.0).toFixed(1)));
  }

  return { companyRating, employeeSatisfaction, retentionRate };
}

/**
 * Step 7: Bankruptcy Check
 * Health <= bankruptcyThreshold (-1000 default)
 */
export function isBankrupt(financialHealth: number, bankruptcyThreshold = -1000): boolean {
  return financialHealth <= bankruptcyThreshold;
}

/**
 * Master Pure Deterministic Daily Tick Runner
 */
export function executeDeterministicTick(input: DailyTickInput): DailyTickResult {
  const threshold = input.bankruptcyThreshold ?? -1000;
  const mods = input.modifiers ?? {
    revenueModifier: 0,
    expenseModifier: 0,
    immediateCost: 0,
    satisfactionDelta: 0,
    reputationDelta: 0,
    productivityDelta: 0,
  };

  const { baseRevenue, dailyRevenue } = calculateDailyRevenue({
    employeeCount: input.employeeCount,
    productivity: input.productivity,
    companyRating: input.companyRating,
    revenueModifier: mods.revenueModifier,
  });

  const { baseExpenses, dailyExpenses } = calculateDailyExpenses({
    employeeCount: input.employeeCount,
    botCount: input.botCount,
    expenseModifier: mods.expenseModifier,
    immediateCost: mods.immediateCost,
  });

  const dailyProfit = calculateDailyProfit(dailyRevenue, dailyExpenses);
  const newFinancialHealth = calculateUpdatedHealth(input.financialHealth, dailyProfit);

  const { companyRating: newCompanyRating, employeeSatisfaction: newEmployeeSatisfaction, retentionRate: newRetentionRate } =
    calculateSecondaryMetrics({
      currentRating: input.companyRating,
      currentSatisfaction: input.employeeSatisfaction,
      currentRetention: input.retentionRate,
      modifiers: mods,
    });

  const bankrupt = isBankrupt(newFinancialHealth, threshold);

  return {
    baseRevenue,
    dailyRevenue,
    baseExpenses,
    dailyExpenses,
    dailyProfit,
    newFinancialHealth,
    newCompanyRating,
    newEmployeeSatisfaction,
    newRetentionRate,
    isBankrupt: bankrupt,
  };
}
