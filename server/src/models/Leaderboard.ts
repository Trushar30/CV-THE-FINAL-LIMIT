import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type LeaderboardCategory,
  LEADERBOARD_CATEGORIES,
  type LeaderboardPeriod,
  LEADERBOARD_PERIODS,
} from '../types/enums.js';

export interface ILeaderboardRankingItem {
  rank: number;
  entityId: string;
  name: string;
  score: number;
  domain?: string;
  careerRole?: string;
  isPlatformCompany?: boolean;
  companyRating?: number;
  secondaryMetric?: string | number;
  details?: Record<string, unknown>;
}

export interface ILeaderboard {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  rankings: ILeaderboardRankingItem[];
  totalEntries: number;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaderboardDocument extends ILeaderboard, Document {
  _id: Types.ObjectId;
}

const LeaderboardRankingItemSchema = new Schema<ILeaderboardRankingItem>(
  {
    rank: { type: Number, required: true, min: 1 },
    entityId: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true },
    domain: { type: String, required: false },
    careerRole: { type: String, required: false },
    isPlatformCompany: { type: Boolean, required: false },
    companyRating: { type: Number, required: false },
    secondaryMetric: { type: Schema.Types.Mixed, required: false },
    details: { type: Schema.Types.Mixed, required: false, default: {} },
  },
  { _id: false }
);

const LeaderboardSchema = new Schema<ILeaderboardDocument>(
  {
    category: {
      type: String,
      enum: LEADERBOARD_CATEGORIES,
      required: true,
      index: true,
    },
    period: {
      type: String,
      enum: LEADERBOARD_PERIODS,
      required: true,
      default: 'ALL_TIME',
    },
    rankings: {
      type: [LeaderboardRankingItemSchema],
      required: true,
      default: [],
    },
    totalEntries: {
      type: Number,
      required: true,
      default: 0,
    },
    calculatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'leaderboards',
  }
);

// Unique Compound Index per Spec Section 26 Collection 35
LeaderboardSchema.index({ category: 1, period: 1 }, { unique: true });

export const LeaderboardModel =
  (mongoose.models.Leaderboard as mongoose.Model<ILeaderboardDocument>) ||
  mongoose.model<ILeaderboardDocument>('Leaderboard', LeaderboardSchema);
