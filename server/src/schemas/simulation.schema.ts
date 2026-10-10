import { z } from 'zod';
import type { IScenarioModifier } from '../models/CompanyScenario.js';

// Strict modifier boundaries per docs/SIMULATION_DESIGN.md Section 4.3
export const MODIFIER_BOUNDS = {
  revenueModifier: { min: -50, max: 150 },
  expenseModifier: { min: -30, max: 100 },
  immediateCost: { min: 0, max: 200 },
  satisfactionDelta: { min: -15, max: 15 },
  reputationDelta: { min: -10, max: 10 },
  productivityDelta: { min: -0.15, max: 0.15 },
} as const;

/**
 * Pure numeric modifier clamp helper
 */
export function clampModifier(modifier: Partial<IScenarioModifier>): IScenarioModifier {
  return {
    revenueModifier: Math.max(
      MODIFIER_BOUNDS.revenueModifier.min,
      Math.min(MODIFIER_BOUNDS.revenueModifier.max, Math.round(Number(modifier.revenueModifier) || 0))
    ),
    expenseModifier: Math.max(
      MODIFIER_BOUNDS.expenseModifier.min,
      Math.min(MODIFIER_BOUNDS.expenseModifier.max, Math.round(Number(modifier.expenseModifier) || 0))
    ),
    immediateCost: Math.max(
      MODIFIER_BOUNDS.immediateCost.min,
      Math.min(MODIFIER_BOUNDS.immediateCost.max, Math.round(Number(modifier.immediateCost) || 0))
    ),
    satisfactionDelta: Math.max(
      MODIFIER_BOUNDS.satisfactionDelta.min,
      Math.min(MODIFIER_BOUNDS.satisfactionDelta.max, Math.round(Number(modifier.satisfactionDelta) || 0))
    ),
    reputationDelta: Math.max(
      MODIFIER_BOUNDS.reputationDelta.min,
      Math.min(MODIFIER_BOUNDS.reputationDelta.max, Math.round(Number(modifier.reputationDelta) || 0))
    ),
    productivityDelta: Number(
      Math.max(
        MODIFIER_BOUNDS.productivityDelta.min,
        Math.min(MODIFIER_BOUNDS.productivityDelta.max, Number(modifier.productivityDelta) || 0)
      ).toFixed(2)
    ),
  };
}

/**
 * Backend Authoritative Modifier Template Catalog
 * AI ONLY references these template IDs; numbers are strictly defined and validated here.
 */
export const MODIFIER_TEMPLATES: Record<string, IScenarioModifier> = {
  // Example 1 from SIMULATION_DESIGN.md:
  ACCEPT_ENTERPRISE_CONTRACT: clampModifier({
    revenueModifier: 40,
    expenseModifier: 15,
    immediateCost: 0,
    satisfactionDelta: 2,
    reputationDelta: 3,
    productivityDelta: 0,
  }),
  // Example 2 from SIMULATION_DESIGN.md:
  EMERGENCY_CONTRACTOR_PATCH: clampModifier({
    revenueModifier: -20,
    expenseModifier: 30,
    immediateCost: 50,
    satisfactionDelta: -8,
    reputationDelta: -4,
    productivityDelta: 0,
  }),
  // Example 3 Bankruptcy Path Traces:
  DAY_1_LOSS: clampModifier({
    revenueModifier: -30,
    expenseModifier: 40,
    immediateCost: 0,
    satisfactionDelta: -2,
    reputationDelta: -1,
    productivityDelta: 0,
  }),
  DAY_2_LOSS: clampModifier({
    revenueModifier: -50,
    expenseModifier: 50,
    immediateCost: 0,
    satisfactionDelta: -5,
    reputationDelta: -3,
    productivityDelta: 0,
  }),
  DAY_4_PENALTY: clampModifier({
    revenueModifier: -28,
    expenseModifier: 60,
    immediateCost: 0,
    satisfactionDelta: -10,
    reputationDelta: -5,
    productivityDelta: 0,
  }),
  // Standard Strategic Profiles:
  STATUS_QUO: clampModifier({
    revenueModifier: 0,
    expenseModifier: 0,
    immediateCost: 0,
    satisfactionDelta: 0,
    reputationDelta: 0,
    productivityDelta: 0,
  }),
  AGGRESSIVE_EXPANSION: clampModifier({
    revenueModifier: 70,
    expenseModifier: 35,
    immediateCost: 40,
    satisfactionDelta: -2,
    reputationDelta: 4,
    productivityDelta: 0.05,
  }),
  AUSTERITY_MEASURES: clampModifier({
    revenueModifier: -10,
    expenseModifier: -20,
    immediateCost: 0,
    satisfactionDelta: -8,
    reputationDelta: -2,
    productivityDelta: -0.04,
  }),
  EMPLOYEE_WELLBEING: clampModifier({
    revenueModifier: 0,
    expenseModifier: 20,
    immediateCost: 25,
    satisfactionDelta: 10,
    reputationDelta: 2,
    productivityDelta: 0.06,
  }),
  MARKETING_PUSH: clampModifier({
    revenueModifier: 45,
    expenseModifier: 15,
    immediateCost: 30,
    satisfactionDelta: 0,
    reputationDelta: 7,
    productivityDelta: 0,
  }),
  TECH_DEBT_REFACTOR: clampModifier({
    revenueModifier: -15,
    expenseModifier: 0,
    immediateCost: 20,
    satisfactionDelta: 5,
    reputationDelta: 1,
    productivityDelta: 0.08,
  }),
  DEFAULT_EXPIRED: clampModifier({
    revenueModifier: 0,
    expenseModifier: 0,
    immediateCost: 0,
    satisfactionDelta: -2,
    reputationDelta: -1,
    productivityDelta: 0,
  }),
};

export const VALID_TEMPLATE_IDS = Object.keys(MODIFIER_TEMPLATES) as [string, ...string[]];

const DEFAULT_EXPIRED_MODIFIER: IScenarioModifier = MODIFIER_TEMPLATES['DEFAULT_EXPIRED'] as IScenarioModifier;

/**
 * Resolves modifiers from template ID with fallback to DEFAULT_EXPIRED
 */
export function resolveTemplateModifiers(templateId: string): IScenarioModifier {
  const template = MODIFIER_TEMPLATES[templateId];
  if (template) {
    return template;
  }
  return DEFAULT_EXPIRED_MODIFIER;
}

// ---------------------------------------------------------------------------
// AI Gateway Schema: AI generates narrative ONLY and selects template IDs
// ---------------------------------------------------------------------------

export const SCENARIO_OPTION_IDS_TUPLE = ['A', 'B', 'C', 'D'] as const;
export const SCENARIO_CATEGORIES_TUPLE = ['PRODUCT', 'ENGINEERING', 'CLIENT', 'CULTURE', 'FINANCE'] as const;

export const aiOptionSchema = z.object({
  optionId: z.enum(SCENARIO_OPTION_IDS_TUPLE),
  title: z.string().min(2).max(120),
  description: z.string().min(5).max(500),
  expectedOutcome: z.string().min(5).max(500),
  modifierTemplateId: z.string().refine(
    (id) => id in MODIFIER_TEMPLATES,
    { message: 'modifierTemplateId must reference a registered backend template ID' }
  ),
});

export const aiScenarioGenerationSchema = z.object({
  scenarioPrompt: z.string().min(20).max(2000),
  category: z.enum(SCENARIO_CATEGORIES_TUPLE),
  options: z.array(aiOptionSchema).min(2).max(4),
});

export type AIScenarioGenerationOutput = z.infer<typeof aiScenarioGenerationSchema>;

export const aiScenarioGenerationJsonSchema = {
  type: 'object',
  properties: {
    scenarioPrompt: {
      type: 'string',
      description: 'Realistic business and technical dilemma confronting the founder',
    },
    category: {
      type: 'string',
      enum: SCENARIO_CATEGORIES_TUPLE,
      description: 'Strategic category of the dilemma',
    },
    options: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          optionId: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          title: { type: 'string', description: 'Brief summary of choice' },
          description: { type: 'string', description: 'Action plan details' },
          expectedOutcome: { type: 'string', description: 'Qualitative advisory forecast' },
          modifierTemplateId: {
            type: 'string',
            enum: Object.keys(MODIFIER_TEMPLATES),
            description: 'Backend template ID defining numeric consequences',
          },
        },
        required: ['optionId', 'title', 'description', 'expectedOutcome', 'modifierTemplateId'],
      },
    },
  },
  required: ['scenarioPrompt', 'category', 'options'],
};

// ---------------------------------------------------------------------------
// Founder Decision Request Schema
// ---------------------------------------------------------------------------

export const submitDecisionSchema = z.object({
  scenarioId: z.string().min(1, 'scenarioId is required'),
  chosenOptionId: z.enum(SCENARIO_OPTION_IDS_TUPLE),
  rationale: z.string().max(1000).optional(),
});

export type SubmitDecisionInput = z.infer<typeof submitDecisionSchema>;
