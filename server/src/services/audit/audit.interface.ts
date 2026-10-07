import { Types } from 'mongoose';
import { AuditActorRole } from '../../types/enums.js';
import { IAuditLogDocument } from '../../models/AuditLog.js';

export interface RecordAuditLogParams {
  actorId: string | Types.ObjectId;
  actorRole: AuditActorRole;
  action: string;
  targetType: string;
  targetId: string | Types.ObjectId;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason: string;
}

export interface CreateAuditLogParams {
  actorId: string;
  actorRole: AuditActorRole;
  action: string;
  targetCollection: string;
  targetId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason: string;
}

export interface IAuditService {
  record(params: RecordAuditLogParams): Promise<IAuditLogDocument>;
  log(params: CreateAuditLogParams): Promise<void>;
}
