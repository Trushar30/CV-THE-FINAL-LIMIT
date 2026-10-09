import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAnswer {
  questionId: Types.ObjectId;
  interviewId: Types.ObjectId;
  candidateResponse: string;
  score?: number;
  strengths?: string[];
  weaknesses?: string[];
  notes?: string;
  submittedAt: Date;
  evaluatedAt?: Date;
}

export interface IAnswerDocument extends IAnswer, Document {
  _id: Types.ObjectId;
}

const AnswerSchema = new Schema<IAnswerDocument>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
    },
    candidateResponse: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: false,
    },
    strengths: {
      type: [String],
      required: false,
      default: [],
    },
    weaknesses: {
      type: [String],
      required: false,
      default: [],
    },
    notes: {
      type: String,
      required: false,
      trim: true,
      maxlength: 3000,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    evaluatedAt: {
      type: Date,
      required: false,
    },
  },
  {
    collection: 'answers',
    timestamps: false,
  }
);

// Indexes per Spec Section 26.14
AnswerSchema.index({ questionId: 1 }, { unique: true });
AnswerSchema.index({ interviewId: 1 });

export const AnswerModel =
  (mongoose.models.Answer as mongoose.Model<IAnswerDocument>) ||
  mongoose.model<IAnswerDocument>('Answer', AnswerSchema);
