import mongoose, { Document, Schema, Types } from 'mongoose';
import { type QuestionDifficulty, QUESTION_DIFFICULTIES } from './Interview.js';

export interface IQuestion {
  interviewId: Types.ObjectId;
  sequenceNumber: number;
  content: string;
  type: string;
  difficulty: QuestionDifficulty;
  expectedPoints: string[];
  expectedCriteria?: string;
  createdAt: Date;
}

export interface IQuestionDocument extends IQuestion, Document {
  _id: Types.ObjectId;
}

const QuestionSchema = new Schema<IQuestionDocument>(
  {
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      default: 'DOMAIN_KNOWLEDGE',
    },
    difficulty: {
      type: String,
      enum: QUESTION_DIFFICULTIES,
      required: true,
      default: 'MEDIUM',
    },
    expectedPoints: {
      type: [String],
      required: true,
      default: [],
    },
    expectedCriteria: {
      type: String,
      required: false,
      trim: true,
      maxlength: 3000,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'questions',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index per Spec Section 26.13
QuestionSchema.index({ interviewId: 1, sequenceNumber: 1 }, { unique: true });

export const QuestionModel =
  (mongoose.models.Question as mongoose.Model<IQuestionDocument>) ||
  mongoose.model<IQuestionDocument>('Question', QuestionSchema);
