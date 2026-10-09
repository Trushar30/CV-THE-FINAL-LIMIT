import mongoose, { Document, Schema, Types } from 'mongoose';
import { type ApplicationStage, APPLICATION_STAGES } from '../types/enums.js';

export interface IEvaluation {
  applicationId: Types.ObjectId;
  stage: ApplicationStage;
  score: number;
  scoreBreakdown?: Record<string, unknown>;
  summary: string;
  createdAt: Date;
}

export interface IEvaluationDocument extends IEvaluation, Document {
  _id: Types.ObjectId;
}

const EvaluationSchema = new Schema<IEvaluationDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    stage: {
      type: String,
      enum: APPLICATION_STAGES,
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    scoreBreakdown: {
      type: Schema.Types.Mixed,
      required: false,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'evaluations',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index per Spec Section 26.15
EvaluationSchema.index({ applicationId: 1, stage: 1 });

export const EvaluationModel =
  (mongoose.models.Evaluation as mongoose.Model<IEvaluationDocument>) ||
  mongoose.model<IEvaluationDocument>('Evaluation', EvaluationSchema);
