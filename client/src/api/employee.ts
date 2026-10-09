import { apiClient } from './client';

export interface EmployeeTaskScenario {
  title: string;
  scenario: string;
  requirements: string[];
  difficulty: string;
  evaluationCriteria: string[];
}

export type TaskKind = 'PRIMARY' | 'BONUS';
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type TaskStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'EXPIRED'
  | 'WAITING_FOR_PROVIDER';

export interface EmployeeTask {
  _id: string;
  employeeId?: string;
  userId: string;
  companyId: string;
  domain: string;
  level: number;
  kind: TaskKind;
  difficulty: TaskDifficulty;
  title: string;
  description: string;
  scenario: EmployeeTaskScenario;
  maxExp: number;
  status: TaskStatus;
  dayKey: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubmission {
  _id: string;
  taskId: string;
  userId: string;
  content: string;
  submittedAt: string;
  createdAt: string;
}

export type PerformanceScoreBand =
  | 'POOR'
  | 'NEEDS_IMPROVEMENT'
  | 'ACCEPTABLE'
  | 'GOOD'
  | 'EXCELLENT';

export interface RubricCriterionScore {
  criterion: string;
  score: number;
  comment: string;
}

export interface PerformanceRecord {
  _id: string;
  taskSubmissionId: string;
  taskId: string;
  userId: string;
  companyId: string;
  aiScore: number;
  scoreBand: PerformanceScoreBand;
  awardedExp: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  criteriaScores: RubricCriterionScore[];
  createdAt: string;
}

export interface PromotionCriterionProgress {
  current: number;
  required: number;
  met: boolean;
  missing: number;
}

export interface PromotionWarningsProgress {
  current: number;
  maxAllowed: number;
  met: boolean;
  excess: number;
}

export interface PromotionProgress {
  currentLevel: number;
  currentTitle: string;
  targetLevel: number | null;
  targetTitle: string | null;
  isMaxLevel: boolean;
  criteria: {
    exp: PromotionCriterionProgress;
    completedTasks: PromotionCriterionProgress;
    averageScore: PromotionCriterionProgress;
    activeWarnings: PromotionWarningsProgress;
  };
  isEligible: boolean;
  missingRequirements: string[];
}

export interface EmployeeWarning {
  _id: string;
  userId: string;
  companyId: string;
  taskSubmissionId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'RESOLVED' | 'ESCALATED';
  reason: string;
  issuedAt: string;
  expiresAt: string;
}

export interface EmployeeCompanyInfo {
  employee: {
    _id: string;
    userId: string;
    companyId: string;
    level: number;
    positionTitle: string;
    salarySimulated: number;
    status: string;
    startedAt: string;
  };
  company: {
    _id: string;
    name: string;
    domain: string;
    tier: string;
    description?: string;
  };
}

export interface ExpTransaction {
  _id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  sourceId?: string;
  createdAt: string;
}

export interface TaskHistoryItem {
  record: PerformanceRecord;
  task: EmployeeTask | null;
}

export interface SubmitTaskResponse {
  submission: TaskSubmission;
  task: EmployeeTask;
  performanceRecord: PerformanceRecord | null;
}

export interface TaskEvaluationResponse {
  task: EmployeeTask;
  submission: TaskSubmission | null;
  performanceRecord: PerformanceRecord | null;
}

export async function fetchTodayTasks(): Promise<EmployeeTask[]> {
  const response = await apiClient.get<{ tasks: EmployeeTask[] }>('/employee/tasks/today');
  return response.tasks;
}

export async function fetchTaskById(taskId: string): Promise<EmployeeTask> {
  const response = await apiClient.get<{ task: EmployeeTask }>(`/employee/tasks/${taskId}`);
  return response.task;
}

export async function submitTaskWork(taskId: string, content: string): Promise<SubmitTaskResponse> {
  return await apiClient.post<SubmitTaskResponse>(`/employee/tasks/${taskId}/submit`, {
    content,
  });
}

export async function fetchTaskEvaluation(taskId: string): Promise<TaskEvaluationResponse> {
  return await apiClient.get<TaskEvaluationResponse>(`/employee/tasks/${taskId}/evaluation`);
}

export async function fetchPromotionProgress(): Promise<PromotionProgress> {
  return await apiClient.get<PromotionProgress>('/employee/promotion/progress');
}

export async function fetchActiveWarnings(): Promise<{ activeCount: number; warnings: EmployeeWarning[] }> {
  return await apiClient.get<{ activeCount: number; warnings: EmployeeWarning[] }>('/employee/warnings');
}

export async function fetchEmployeeCompany(): Promise<EmployeeCompanyInfo> {
  return await apiClient.get<EmployeeCompanyInfo>('/employee/company');
}

export async function fetchTaskHistory(): Promise<TaskHistoryItem[]> {
  const response = await apiClient.get<{ history: TaskHistoryItem[] }>('/employee/tasks/history');
  return response.history;
}

export async function fetchExpLedger(): Promise<ExpTransaction[]> {
  const response = await apiClient.get<{ transactions: ExpTransaction[] }>('/employee/ledger/exp');
  return response.transactions;
}
