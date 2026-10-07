import mongoose, { Document, Schema, Types } from 'mongoose';
import { AuditActorRole, AUDIT_ACTOR_ROLES } from '../types/enums.js';

export interface IAuditLogDocument extends Document {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: AuditActorRole;
  action: string;
  targetType: string;
  targetCollection: string;
  targetId: Types.ObjectId;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason: string;
  createdAt: Date;
}

export const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      enum: AUDIT_ACTOR_ROLES,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
    },
    targetCollection: {
      type: String,
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'auditLogs',
    timestamps: false,
    versionKey: false,
  }
);

// Composite & lookup indexes per Spec Section 26 Collection 37
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

// Strict Append-Only Protection Hooks: Ledger entries cannot be modified or deleted
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function () {
  throw new Error('AuditLog documents are append-only and cannot be updated');
});

auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('AuditLog documents are append-only and cannot be deleted');
});

auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(
      new Error('AuditLog documents are append-only and cannot be modified once created')
    );
  }
  next();
});

export const AuditLogModel = mongoose.model<IAuditLogDocument>(
  'AuditLog',
  auditLogSchema,
  'auditLogs'
);
