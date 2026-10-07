import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  CareerRole,
  CAREER_ROLES,
  OnboardingStep,
  ONBOARDING_STEPS,
  PlatformRole,
  PLATFORM_ROLES,
  UserStatus,
  USER_STATUSES,
} from '../types/enums.js';

export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  careerRole: CareerRole;
  platformRole: PlatformRole;
  status: UserStatus;
  isSuspended: boolean; // Backwards compatibility
  emailVerified: boolean;
  isEmailVerified: boolean; // Backwards compatibility
  onboardingStep: OnboardingStep;
  failedLoginAttempts: number;
  lockUntil?: Date | null;
  lockoutUntil?: Date | null; // Backwards compatibility
  totalExp: number;
  totalExpCached: number; // Backwards compatibility
  corpCoinBalance: number;
  corpCoinBalanceCached: number; // Backwards compatibility
  founderModeUnlockedAt?: Date | null;
  founderStarterCoinGranted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    careerRole: {
      type: String,
      enum: CAREER_ROLES,
      required: true,
      default: 'NONE', // Default is NONE before profile setup; JOB_SEEKER after
      index: true,
    },
    platformRole: {
      type: String,
      enum: PLATFORM_ROLES,
      required: true,
      default: 'NONE',
      index: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      required: true,
      default: 'ACTIVE',
      index: true,
    },
    isSuspended: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    onboardingStep: {
      type: String,
      enum: ONBOARDING_STEPS,
      required: true,
      default: 'REGISTERED',
      index: true,
    },
    failedLoginAttempts: {
      type: Number,
      required: true,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    totalExp: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalExpCached: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    corpCoinBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    corpCoinBalanceCached: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    founderModeUnlockedAt: {
      type: Date,
      default: null,
    },
    founderStarterCoinGranted: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    collection: 'users',
    timestamps: true,
    versionKey: false,
  }
);

// Pre-validate hook to keep compatibility fields in sync
userSchema.pre('validate', function (next) {
  // Sync emailVerified and isEmailVerified
  if (this.emailVerified !== undefined) {
    this.isEmailVerified = this.emailVerified;
  } else if (this.isEmailVerified !== undefined) {
    this.emailVerified = this.isEmailVerified;
  }

  // Sync status and isSuspended
  if (this.status !== undefined) {
    this.isSuspended = this.status === 'SUSPENDED';
  } else if (this.isSuspended !== undefined) {
    this.status = this.isSuspended ? 'SUSPENDED' : 'ACTIVE';
  }

  // Sync lockUntil and lockoutUntil
  if (this.lockUntil !== undefined) {
    this.lockoutUntil = this.lockUntil;
  } else if (this.lockoutUntil !== undefined) {
    this.lockUntil = this.lockoutUntil;
  }

  // Sync totalExp and totalExpCached
  if (
    this.totalExp !== undefined &&
    (this.totalExpCached === undefined || this.totalExpCached === 0)
  ) {
    this.totalExpCached = this.totalExp;
  } else if (
    this.totalExpCached !== undefined &&
    (this.totalExp === undefined || this.totalExp === 0)
  ) {
    this.totalExp = this.totalExpCached;
  }

  // Sync corpCoinBalance and corpCoinBalanceCached
  if (
    this.corpCoinBalance !== undefined &&
    (this.corpCoinBalanceCached === undefined || this.corpCoinBalanceCached === 0)
  ) {
    this.corpCoinBalanceCached = this.corpCoinBalance;
  } else if (
    this.corpCoinBalanceCached !== undefined &&
    (this.corpCoinBalance === undefined || this.corpCoinBalance === 0)
  ) {
    this.corpCoinBalance = this.corpCoinBalanceCached;
  }

  next();
});

export const UserModel = mongoose.model<IUserDocument>('User', userSchema, 'users');
