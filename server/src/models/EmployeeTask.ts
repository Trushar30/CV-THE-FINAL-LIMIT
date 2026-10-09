import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type CareerDomain,
  CAREER_DOMAINS,
  type TaskKind,
  TASK_KINDS,
  type TaskDifficulty,
  TASK_DIFFICULTIES,
  type EmployeeTaskStatus,
  EMPLOYEE_TASK_STATUSES,
} from '../types/enums.js';
import type { TaskGenerationOutput } from '../schemas/task.schema.js';

export interface IEmployeeTask {
  employeeId: Types.ObjectId;
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  domain: CareerDomain;
  level: number;
  kind: TaskKind;
  difficulty: TaskDifficulty;
  scenario: TaskGenerationOutput;
  title: string;
  description: string;
  maxExp: number;
  status: EmployeeTaskStatus;
  dayKey: string;
  dueAt: Date;
  aiJobId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmployeeTaskDocument extends IEmployeeTask, Document {
  _id: Types.ObjectId;
}

const ScenarioSubSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    scenario: { type: String, required: true, trim: true },
    requirements: { type: [String], required: true, default: [] },
    difficulty: { type: String, enum: TASK_DIFFICULTIES, required: true },
    evaluationCriteria: { type: [String], required: true, default: [] },
  },
  { _id: false }
);

const EmployeeTaskSchema = new Schema<IEmployeeTaskDocument>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyEmployee',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    domain: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
    },
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    kind: {
      type: String,
      enum: TASK_KINDS,
      required: true,
    },
    difficulty: {
      type: String,
      enum: TASK_DIFFICULTIES,
      required: true,
    },
    scenario: {
      type: ScenarioSubSchema,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    maxExp: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: EMPLOYEE_TASK_STATUSES,
      required: true,
      default: 'ASSIGNED',
      index: true,
    },
    dayKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    aiJobId: {
      type: Schema.Types.ObjectId,
      ref: 'AIJob',
      required: false,
      default: null,
    },
  },
  {
    collection: 'employeeTasks',
    timestamps: true,
  }
);

// Unique compound index: One primary and one bonus task per employee per day
EmployeeTaskSchema.index({ employeeId: 1, dayKey: 1, kind: 1 }, { unique: true });

// Secondary lookup indexes
EmployeeTaskSchema.index({ userId: 1, dayKey: 1 });
EmployeeTaskSchema.index({ companyId: 1, dayKey: 1 });

export const EmployeeTaskModel =
  (mongoose.models.EmployeeTask as mongoose.Model<IEmployeeTaskDocument>) ||
  mongoose.model<IEmployeeTaskDocument>('EmployeeTask', EmployeeTaskSchema);
