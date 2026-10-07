import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { ConfigService } from '../services/config/config.service.js';
import { AuditServiceStub } from '../services/audit/audit.service.js';
import { DEFAULT_PLATFORM_CONFIG, PlatformConfig } from '../config/platformConfig.schema.js';
import { AppError } from '../utils/errors.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_config';

describe('ConfigService & PlatformConfig Model Integration', () => {
  let auditStub: AuditServiceStub;
  let service: ConfigService;

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await PlatformConfigModel.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await PlatformConfigModel.deleteMany({});
    auditStub = new AuditServiceStub();
    service = new ConfigService(auditStub);
    service.invalidateCache();
  });

  describe('Defaults Seeding', () => {
    it('should seed default platform configuration once', async () => {
      const seeded = await service.seedDefaultsIfMissing();

      expect(seeded).toBeDefined();
      expect(seeded.version).toBe(1);
      expect(seeded.isActive).toBe(true);
      expect(seeded.config.career.founderUnlockExp).toBe(12000);
      expect(seeded.config.employee.warningThreshold).toBe(4);

      // Verify MongoDB collection count is exactly 1
      const count = await PlatformConfigModel.countDocuments();
      expect(count).toBe(1);
    });

    it('should be idempotent and not create duplicate records on repeated calls', async () => {
      const doc1 = await service.seedDefaultsIfMissing();
      const doc2 = await service.seedDefaultsIfMissing();

      expect(doc1._id.toString()).toBe(doc2._id.toString());
      expect(doc2.version).toBe(1);

      const count = await PlatformConfigModel.countDocuments();
      expect(count).toBe(1);
    });

    it('should auto-seed defaults if getConfig() is called when database is empty', async () => {
      expect(service.isCached()).toBe(false);

      const config = await service.getConfig();
      expect(config.version).toBe(1);
      expect(config.bots.hiring).toBe(250);

      const count = await PlatformConfigModel.countDocuments();
      expect(count).toBe(1);
      expect(service.isCached()).toBe(true);
    });
  });

  describe('Typed Getters', () => {
    beforeEach(async () => {
      await service.seedDefaultsIfMissing();
    });

    it('should return typed sections accurately', async () => {
      const career = await service.getCareerConfig();
      expect(career).toEqual({ founderUnlockExp: 12000, maxLevel: 10 });

      const employee = await service.getEmployeeConfig();
      expect(employee.warningThreshold).toBe(4);
      expect(employee.primaryTasksPerDay).toBe(1);
      expect(employee.minimumPromotionScore).toBe(70);

      const apps = await service.getApplicationsConfig();
      expect(apps.maxActive).toBe(5);

      const founder = await service.getFounderConfig();
      expect(founder.starterCorpCoin).toBe(1000);
      expect(founder.companyCreationCost).toBe(100);

      const company = await service.getCompanyConfig();
      expect(company.maxEmployees).toBe(20);
      expect(company.bankruptcyThreshold).toBe(-1000);

      const bots = await service.getBotsConfig();
      expect(bots.hiring).toBe(250);
      expect(bots.advancedHiring).toBe(400);

      const ats = await service.getAtsConfig();
      expect(ats.passingScore).toBe(70);
      expect(ats.domainWeight).toBe(40);

      const ai = await service.getAiConfig();
      expect(ai.retryPerProvider).toBe(3);
      expect(ai.demoPool.providerPriority).toEqual(['gemini', 'openai', 'groq']);
      expect(ai.demoPool.groqModel).toBe('configured-demo-groq-model');

      const security = await service.getSecurityConfig();
      expect(security.accessTokenMinutes).toBe(15);
      expect(security.lockoutMinutes).toBe(15);

      const version = await service.getVersion();
      expect(version).toBe(1);
    });
  });

  describe('In-Memory Caching & Invalidation', () => {
    beforeEach(async () => {
      await service.seedDefaultsIfMissing();
    });

    it('should serve subsequent reads from memory without querying database', async () => {
      // First read loads into cache
      await service.getConfig();
      expect(service.isCached()).toBe(true);

      const findSpy = vi.spyOn(PlatformConfigModel, 'findOne');

      // Call getConfig 3 more times
      await service.getConfig();
      await service.getCareerConfig();
      await service.getEmployeeConfig();

      // Ensure database was not queried during cached reads
      expect(findSpy).not.toHaveBeenCalled();

      findSpy.mockRestore();
    });

    it('should re-query database after manual cache invalidation', async () => {
      await service.getConfig();
      expect(service.isCached()).toBe(true);

      service.invalidateCache();
      expect(service.isCached()).toBe(false);

      const findSpy = vi.spyOn(PlatformConfigModel, 'findOne');
      const refreshed = await service.getConfig();

      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(refreshed.version).toBe(1);

      findSpy.mockRestore();
    });
  });

  describe('Admin Update Path & Audit Logging', () => {
    const adminObjectId = new Types.ObjectId().toString();

    beforeEach(async () => {
      await service.seedDefaultsIfMissing();
    });

    it('should reject update with missing or empty reason', async () => {
      await expect(
        service.updateConfig({
          newConfig: { ...DEFAULT_PLATFORM_CONFIG },
          adminId: adminObjectId,
          reason: '   ',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject update with missing adminId', async () => {
      await expect(
        service.updateConfig({
          newConfig: { ...DEFAULT_PLATFORM_CONFIG },
          adminId: '',
          reason: 'Adjusting thresholds',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject update with invalid schema values (e.g., warningThreshold = 0)', async () => {
      const invalidConfig = {
        ...DEFAULT_PLATFORM_CONFIG,
        employee: {
          ...DEFAULT_PLATFORM_CONFIG.employee,
          warningThreshold: 0,
        },
      };

      await expect(
        service.updateConfig({
          newConfig: invalidConfig,
          adminId: adminObjectId,
          reason: 'Setting zero warnings',
        })
      ).rejects.toThrow(AppError);

      // Verify no new document was created
      const totalDocs = await PlatformConfigModel.countDocuments();
      expect(totalDocs).toBe(1);
    });

    it('should successfully update config, increment version, refresh cache, and record audit log', async () => {
      const modifiedConfig = {
        ...DEFAULT_PLATFORM_CONFIG,
        employee: {
          ...DEFAULT_PLATFORM_CONFIG.employee,
          warningThreshold: 5,
        },
      };

      const updated = await service.updateConfig({
        newConfig: modifiedConfig,
        adminId: adminObjectId,
        reason: 'Increased warning threshold to 5 for grace period trial',
      });

      // Verify version incremented
      expect(updated.version).toBe(2);
      expect(updated.employee.warningThreshold).toBe(5);

      // Verify in-memory cache refreshed immediately
      expect(service.isCached()).toBe(true);
      const cached = service.getCachedConfig();
      expect(cached?.version).toBe(2);
      expect(cached?.employee.warningThreshold).toBe(5);

      // Verify single active document in database
      const activeDocs = await PlatformConfigModel.find({ isActive: true });
      expect(activeDocs).toHaveLength(1);
      expect(activeDocs[0]?.version).toBe(2);
      expect(activeDocs[0]?.config.employee.warningThreshold).toBe(5);

      // Verify total documents is 2 (version 1 archived as inactive, version 2 active)
      const allDocs = await PlatformConfigModel.find().sort({ version: 1 });
      expect(allDocs).toHaveLength(2);
      expect(allDocs[0]?.version).toBe(1);
      expect(allDocs[0]?.isActive).toBe(false);
      expect(allDocs[1]?.version).toBe(2);
      expect(allDocs[1]?.isActive).toBe(true);

      // Verify audit log recorded
      const logs = auditStub.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.action).toBe('UPDATE_PLATFORM_CONFIG');
      expect(logs[0]?.actorId).toBe(adminObjectId);
      expect(logs[0]?.actorRole).toBe('ADMIN');
      expect(logs[0]?.targetCollection).toBe('platformConfigs');
      expect(logs[0]?.reason).toBe('Increased warning threshold to 5 for grace period trial');
      expect((logs[0]?.oldValue as PlatformConfig | null)?.employee?.warningThreshold).toBe(4);
      expect((logs[0]?.newValue as PlatformConfig | null)?.employee?.warningThreshold).toBe(5);
    });

    it('should support multiple sequential updates with strict single active document invariant', async () => {
      // First update -> version 2
      await service.updateConfig({
        newConfig: {
          ...DEFAULT_PLATFORM_CONFIG,
          applications: { maxActive: 7 },
        },
        adminId: adminObjectId,
        reason: 'First update to max applications',
      });

      // Second update -> version 3
      const current = await service.getConfig();
      await service.updateConfig({
        newConfig: {
          ...current,
          bots: { ...current.bots, hiring: 300 },
        },
        adminId: adminObjectId,
        reason: 'Second update to bot prices',
      });

      const activeDocs = await PlatformConfigModel.find({ isActive: true });
      expect(activeDocs).toHaveLength(1);
      expect(activeDocs[0]?.version).toBe(3);
      expect(activeDocs[0]?.config.applications.maxActive).toBe(7);
      expect(activeDocs[0]?.config.bots.hiring).toBe(300);

      const totalDocs = await PlatformConfigModel.countDocuments();
      expect(totalDocs).toBe(3);

      expect(auditStub.getLogs()).toHaveLength(2);
    });
  });
});
