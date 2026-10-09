import { Types } from 'mongoose';
import {
  PlatformConfig,
  platformConfigSchema,
  DEFAULT_PLATFORM_CONFIG,
  CareerConfig,
  EmployeeConfig,
  ApplicationsConfig,
  FounderConfig,
  CompanyConfig,
  BotsConfig,
  AtsConfig,
  StagesConfig,
  StageSettingsConfig,
  SalaryBandConfig,
  FinalReviewWeightsConfig,
  OfferSettingsConfig,
  AiConfig,
  SecurityConfig,
} from '../../config/platformConfig.schema.js';
import { PlatformConfigModel, IPlatformConfigDocument } from '../../models/PlatformConfig.js';
import { IAuditService } from '../audit/audit.interface.js';
import { auditService as defaultAuditService } from '../audit/audit.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface UpdatePlatformConfigParams {
  newConfig: PlatformConfig;
  adminId: string;
  reason: string;
}

export class ConfigService {
  private cachedConfig: PlatformConfig | null = null;
  private cachedDocId: string | null = null;
  private cachedVersion: number | null = null;
  private auditService: IAuditService;

  constructor(auditService: IAuditService = defaultAuditService) {
    this.auditService = auditService;
  }

  /**
   * Invalidate the in-memory cache so subsequent reads re-fetch from MongoDB.
   */
  invalidateCache(): void {
    logger.debug('[ConfigService] In-memory cache invalidated');
    this.cachedConfig = null;
    this.cachedDocId = null;
    this.cachedVersion = null;
  }

  /**
   * Check if cache is populated synchronously
   */
  isCached(): boolean {
    return this.cachedConfig !== null;
  }

  /**
   * Returns currently cached config without querying database (or null if unpopulated).
   */
  getCachedConfig(): PlatformConfig | null {
    return this.cachedConfig;
  }

  /**
   * Returns active configuration document ID if cached in-memory.
   */
  getCachedDocId(): string | null {
    return this.cachedDocId;
  }

  /**
   * Returns active configuration version number if cached in-memory.
   */
  getCachedVersion(): number | null {
    return this.cachedVersion;
  }

  /**
   * Seeds default platform configuration if no active configuration document exists.
   * Guarantees default configuration seeds exactly once.
   */
  async seedDefaultsIfMissing(systemUserId?: string): Promise<IPlatformConfigDocument> {
    const existing = await PlatformConfigModel.findOne({ isActive: true });
    if (existing) {
      const plain = existing.toObject().config;
      this.cachedConfig = platformConfigSchema.parse(plain);
      this.cachedDocId = existing._id.toString();
      this.cachedVersion = existing.version;
      return existing;
    }

    try {
      const initialDoc = new PlatformConfigModel({
        version: 1,
        isActive: true,
        config: { ...DEFAULT_PLATFORM_CONFIG },
        updatedBy:
          systemUserId && Types.ObjectId.isValid(systemUserId)
            ? new Types.ObjectId(systemUserId)
            : null,
        updatedAt: new Date(),
      });

      await initialDoc.save();
      logger.info('[ConfigService] Default PlatformConfig seeded successfully at version 1');

      const plain = initialDoc.toObject().config;
      this.cachedConfig = platformConfigSchema.parse(plain);
      this.cachedDocId = initialDoc._id.toString();
      this.cachedVersion = initialDoc.version;
      return initialDoc;
    } catch (err: unknown) {
      // In case of race conditions with duplicate key, recover by finding the newly created active document
      const raceDoc = await PlatformConfigModel.findOne({ isActive: true });
      if (raceDoc) {
        const plain = raceDoc.toObject().config;
        this.cachedConfig = platformConfigSchema.parse(plain);
        this.cachedDocId = raceDoc._id.toString();
        this.cachedVersion = raceDoc.version;
        return raceDoc;
      }
      throw err;
    }
  }

  /**
   * Gets the authoritative active platform configuration.
   * Serves from memory cache when available; queries database on cache miss.
   */
  async getConfig(): Promise<PlatformConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const doc = await PlatformConfigModel.findOne({ isActive: true });
    if (!doc) {
      await this.seedDefaultsIfMissing();
      return this.cachedConfig!;
    }

    const plain = doc.toObject().config;
    const validation = platformConfigSchema.safeParse(plain);
    if (!validation.success) {
      logger.error('[ConfigService] Stored active PlatformConfig failed Zod validation', {
        issues: validation.error.issues,
      });
      throw AppError.internal('Corrupted PlatformConfig found in database');
    }

    this.cachedConfig = validation.data;
    this.cachedDocId = doc._id.toString();
    this.cachedVersion = doc.version;
    return this.cachedConfig;
  }

  /**
   * Typed section getters
   */
  async getCareerConfig(): Promise<CareerConfig> {
    return (await this.getConfig()).career;
  }

  async getEmployeeConfig(): Promise<EmployeeConfig> {
    return (await this.getConfig()).employee;
  }

  async getApplicationsConfig(): Promise<ApplicationsConfig> {
    return (await this.getConfig()).applications;
  }

  async getFounderConfig(): Promise<FounderConfig> {
    return (await this.getConfig()).founder;
  }

  async getCompanyConfig(): Promise<CompanyConfig> {
    return (await this.getConfig()).company;
  }

  async getBotsConfig(): Promise<BotsConfig> {
    return (await this.getConfig()).bots;
  }

  async getAtsConfig(): Promise<AtsConfig> {
    return (await this.getConfig()).ats;
  }

  async getStagesConfig(): Promise<StagesConfig> {
    return (await this.getConfig()).stages;
  }

  async getStageSettings(
    stage: 'SCREENING' | 'ASSESSMENT' | 'INTERVIEW'
  ): Promise<StageSettingsConfig> {
    const stages = await this.getStagesConfig();
    switch (stage) {
      case 'SCREENING':
        return stages.screening;
      case 'ASSESSMENT':
        return stages.assessment;
      case 'INTERVIEW':
        return stages.interview;
      default:
        return stages.screening;
    }
  }

  async getSalaryBands(): Promise<SalaryBandConfig[]> {
    return (await this.getCareerConfig()).salaryBands;
  }

  async getSalaryBandForLevel(level: number): Promise<SalaryBandConfig | undefined> {
    const bands = await this.getSalaryBands();
    return bands.find((b) => b.level === level);
  }

  async getFinalReviewSettings(): Promise<FinalReviewWeightsConfig> {
    return (await this.getStagesConfig()).finalReview;
  }

  async getOfferSettings(): Promise<OfferSettingsConfig> {
    return (await this.getStagesConfig()).offer;
  }

  async getAiConfig(): Promise<AiConfig> {
    return (await this.getConfig()).ai;
  }

  async getSecurityConfig(): Promise<SecurityConfig> {
    return (await this.getConfig()).security;
  }

  async getVersion(): Promise<number> {
    return (await this.getConfig()).version;
  }

  /**
   * Admin-only update path (service method).
   * Validates new configuration via Zod, archives current version, increments version number,
   * creates new active configuration document, invalidates and updates cache, and records audit trail.
   */
  async updateConfig(params: UpdatePlatformConfigParams): Promise<PlatformConfig> {
    if (!params.reason || typeof params.reason !== 'string' || params.reason.trim().length === 0) {
      throw AppError.validation('Audit reason is required when updating PlatformConfig');
    }

    if (
      !params.adminId ||
      typeof params.adminId !== 'string' ||
      params.adminId.trim().length === 0
    ) {
      throw AppError.validation('Admin ID is required when updating PlatformConfig');
    }

    const parseResult = platformConfigSchema.safeParse(params.newConfig);
    if (!parseResult.success) {
      throw AppError.validation('Invalid PlatformConfig parameters', {
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const currentDoc = await PlatformConfigModel.findOne({ isActive: true });
    const nextVersion = (currentDoc?.version ?? 0) + 1;

    const validatedConfig: PlatformConfig = {
      ...parseResult.data,
      version: nextVersion,
    };

    if (currentDoc) {
      currentDoc.isActive = false;
      await PlatformConfigModel.updateOne({ _id: currentDoc._id }, { isActive: false });
    }

    const newDoc = new PlatformConfigModel({
      version: nextVersion,
      isActive: true,
      config: validatedConfig,
      updatedBy: Types.ObjectId.isValid(params.adminId) ? new Types.ObjectId(params.adminId) : null,
      updatedAt: new Date(),
    });

    await newDoc.save();

    // Cache updated configuration
    this.cachedConfig = validatedConfig;
    this.cachedDocId = newDoc._id.toString();
    this.cachedVersion = nextVersion;

    // Record audit log
    await this.auditService.log({
      actorId: params.adminId,
      actorRole: 'ADMIN',
      action: 'UPDATE_PLATFORM_CONFIG',
      targetCollection: 'platformConfigs',
      targetId: newDoc._id.toString(),
      oldValue: currentDoc ? (currentDoc.config as unknown as Record<string, unknown>) : null,
      newValue: validatedConfig as unknown as Record<string, unknown>,
      reason: params.reason.trim(),
    });

    logger.info(
      `[ConfigService] PlatformConfig updated to version ${nextVersion} by admin ${params.adminId}`
    );
    return validatedConfig;
  }
}

export const configService = new ConfigService();
