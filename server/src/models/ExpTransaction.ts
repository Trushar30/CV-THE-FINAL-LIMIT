import mongoose, { Document, Schema, Types } from 'mongoose';
import { ExpTransactionType, EXP_TRANSACTION_TYPES } from '../types/enums.js';

export interface IExpTransactionDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  balanceAfter: number;
  type: ExpTransactionType;
  sourceId: Types.ObjectId;
  reason: string;
  createdAt: Date;
}

export const expTransactionSchema = new Schema<IExpTransactionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      enum: EXP_TRANSACTION_TYPES,
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
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
    collection: 'expTransactions',
    timestamps: false,
    versionKey: false,
  }
);

// Indexes per Spec Section 26 Collection 27
expTransactionSchema.index({ userId: 1, createdAt: -1 });

// Strict Append-Only Protection Hooks: Ledger entries cannot be modified or deleted
expTransactionSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'],
  function () {
    throw new Error('expTransactions documents are immutable and cannot be updated');
  }
);

expTransactionSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('expTransactions documents are immutable and cannot be deleted');
});

expTransactionSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(
      new Error('expTransactions documents are immutable and cannot be modified once created')
    );
  }
  next();
});

export const ExpTransactionModel = mongoose.model<IExpTransactionDocument>(
  'ExpTransaction',
  expTransactionSchema,
  'expTransactions'
);
