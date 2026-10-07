import mongoose, { Document, Schema, Types } from 'mongoose';
import { CorpCoinTransactionType, CORP_COIN_TRANSACTION_TYPES } from '../types/enums.js';

export interface ICorpCoinTransactionDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  companyId?: Types.ObjectId | null;
  amount: number;
  balanceAfter: number;
  type: CorpCoinTransactionType;
  referenceId?: Types.ObjectId | null;
  reason: string;
  createdAt: Date;
}

export const corpCoinTransactionSchema = new Schema<ICorpCoinTransactionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: CORP_COIN_TRANSACTION_TYPES,
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'corpCoinTransactions',
    timestamps: false,
    versionKey: false,
  }
);

// Indexes per Spec Section 26 Collection 28
corpCoinTransactionSchema.index({ userId: 1, createdAt: -1 });
corpCoinTransactionSchema.index({ companyId: 1 });

// Strict Append-Only Protection Hooks: Ledger entries cannot be modified or deleted
corpCoinTransactionSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'],
  function () {
    throw new Error('corpCoinTransactions documents are immutable and cannot be updated');
  }
);

corpCoinTransactionSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('corpCoinTransactions documents are immutable and cannot be deleted');
});

corpCoinTransactionSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(
      new Error('corpCoinTransactions documents are immutable and cannot be modified once created')
    );
  }
  next();
});

export const CorpCoinTransactionModel = mongoose.model<ICorpCoinTransactionDocument>(
  'CorpCoinTransaction',
  corpCoinTransactionSchema,
  'corpCoinTransactions'
);
