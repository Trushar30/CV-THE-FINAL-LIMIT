import { Types } from 'mongoose';
import { IAuditService, RecordAuditLogParams, CreateAuditLogParams } from './audit.interface.js';
import { AuditLogModel, IAuditLogDocument } from '../../models/AuditLog.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * AuditService provides append-only audit trail logging to MongoDB.
 * Implements strict append-only semantics: no update or delete methods are exposed.
 */
export class AuditService implements IAuditService {
  /**
   * Append an audit log entry to the auditLogs collection.
   */
  async record(params: RecordAuditLogParams): Promise<IAuditLogDocument> {
    if (!params.actorId) {
      throw AppError.validation('actorId is required for audit logging');
    }
    if (!params.action || typeof params.action !== 'string' || params.action.trim().length === 0) {
      throw AppError.validation('action is required for audit logging');
    }
    if (!params.reason || typeof params.reason !== 'string' || params.reason.trim().length === 0) {
      throw AppError.validation('reason is required for audit logging');
    }
    if (!params.targetType) {
      throw AppError.validation('targetType is required for audit logging');
    }
    if (!params.targetId) {
      throw AppError.validation('targetId is required for audit logging');
    }

    const actorObjectId =
      params.actorId instanceof Types.ObjectId
        ? params.actorId
        : new Types.ObjectId(params.actorId);
    const targetObjectId =
      params.targetId instanceof Types.ObjectId
        ? params.targetId
        : new Types.ObjectId(params.targetId);

    const doc = new AuditLogModel({
      actorId: actorObjectId,
      actorRole: params.actorRole,
      action: params.action.trim(),
      targetType: params.targetType.trim(),
      targetCollection: params.targetType.trim(),
      targetId: targetObjectId,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      reason: params.reason.trim(),
      createdAt: new Date(),
    });

    await doc.save();

    logger.info(
      `[AuditLog] ${params.actorRole} ${actorObjectId} performed ${params.action} on ${params.targetType}:${targetObjectId}`,
      {
        actorId: actorObjectId.toString(),
        actorRole: params.actorRole,
        action: params.action,
        targetType: params.targetType,
        targetId: targetObjectId.toString(),
        reason: params.reason,
      }
    );

    return doc;
  }

  /**
   * Adapter for existing IAuditService.log() calls.
   */
  async log(params: CreateAuditLogParams): Promise<void> {
    await this.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetCollection,
      targetId: params.targetId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason,
    });
  }

  /**
   * Find audit log by ID.
   */
  async findById(id: string | Types.ObjectId): Promise<IAuditLogDocument | null> {
    return AuditLogModel.findById(id);
  }

  /**
   * Query audit logs by actor.
   */
  async getLogsByActor(actorId: string | Types.ObjectId): Promise<IAuditLogDocument[]> {
    return AuditLogModel.find({ actorId }).sort({ createdAt: -1 });
  }

  /**
   * Query audit logs by target entity.
   */
  async getLogsByTarget(targetId: string | Types.ObjectId): Promise<IAuditLogDocument[]> {
    return AuditLogModel.find({ targetId }).sort({ createdAt: -1 });
  }
}

/**
 * In-memory audit service stub for isolated testing.
 */
export class AuditServiceStub implements IAuditService {
  private inMemoryLogs: CreateAuditLogParams[] = [];

  async record(params: RecordAuditLogParams): Promise<IAuditLogDocument> {
    const doc = {
      ...params,
      _id: new Types.ObjectId(),
      targetCollection: params.targetType,
      createdAt: new Date(),
    } as unknown as IAuditLogDocument;

    this.inMemoryLogs.push({
      actorId: params.actorId.toString(),
      actorRole: params.actorRole,
      action: params.action,
      targetCollection: params.targetType,
      targetId: params.targetId.toString(),
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason,
    });
    return doc;
  }

  async log(params: CreateAuditLogParams): Promise<void> {
    this.inMemoryLogs.push({ ...params });
  }

  getLogs(): readonly CreateAuditLogParams[] {
    return this.inMemoryLogs;
  }

  clearLogs(): void {
    this.inMemoryLogs = [];
  }
}

export const auditService = new AuditService();
