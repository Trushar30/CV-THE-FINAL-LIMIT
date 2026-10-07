import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRefreshTokenDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  family: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date | null;
  replacedByTokenHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    family: {
      type: String,
      required: true,
      index: true,
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
    isRevoked: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
  },
  {
    collection: 'refreshTokens',
    timestamps: true,
    versionKey: false,
  }
);

export const RefreshTokenModel = mongoose.model<IRefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema,
  'refreshTokens'
);
