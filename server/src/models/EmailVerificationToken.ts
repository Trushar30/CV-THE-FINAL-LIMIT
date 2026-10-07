import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmailVerificationTokenDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const emailVerificationTokenSchema = new Schema<IEmailVerificationTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'emailVerificationTokens',
    timestamps: true,
    versionKey: false,
  }
);

export const EmailVerificationTokenModel = mongoose.model<IEmailVerificationTokenDocument>(
  'EmailVerificationToken',
  emailVerificationTokenSchema,
  'emailVerificationTokens'
);
