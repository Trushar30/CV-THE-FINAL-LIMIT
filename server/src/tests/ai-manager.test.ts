import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, IUserDocument } from '../models/User.js';
import { AIProviderModel } from '../models/AIProvider.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { signAccessToken } from '../utils/jwt.js';
import { encryptSecret, decryptSecret, maskApiKey } from '../utils/crypto.js';
import { ProviderRouter } from '../ai/provider-router.js';
import { HealthTracker } from '../ai/health-tracker.js';
import { AIManagerService } from '../services/ai/aiManager.service.js';
import { AIManagerController } from '../controllers/aiManager.controller.js';
import { AuditService } from '../services/audit/audit.service.js';
import { MockAdapter } from '../ai/adapters/mock.adapter.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_ai_manager';

describe('AI Manager Console, Key Vault & RBAC Integration Suite (TASK P3.6)', () => {
  let router: ProviderRouter;
  let tracker: HealthTracker;
  let auditService: AuditService;
  let aiManagerService: AIManagerService;
  let aiManagerController: AIManagerController;
  let app: ReturnType<typeof createApp>;

  let aiManagerUser: IUserDocument;
  let adminUser: IUserDocument;
  let standardUser: IUserDocument;

  let aiManagerToken: string;
  let adminToken: string;
  let standardToken: string;

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await AIProviderModel.collection.deleteMany({});
      await AuditLogModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await AIProviderModel.collection.deleteMany({});
      await AuditLogModel.collection.deleteMany({});
    }

    // Set up dedicated services and controller for isolation
    router = new ProviderRouter();
    tracker = new HealthTracker(router);
    auditService = new AuditService();
    aiManagerService = new AIManagerService(router, tracker, auditService);
    aiManagerController = new AIManagerController(aiManagerService);

    app = createApp(undefined, { aiManagerController });

    // Seed test users with distinct platformRoles
    aiManagerUser = await UserModel.create({
      email: 'aimanager@corpverse.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      displayName: 'AI Operations Manager',
      careerRole: 'NONE',
      platformRole: 'AI_MANAGER',
      emailVerified: true,
      status: 'ACTIVE',
    });

    adminUser = await UserModel.create({
      email: 'admin@corpverse.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      displayName: 'System Admin',
      careerRole: 'NONE',
      platformRole: 'ADMIN',
      emailVerified: true,
      status: 'ACTIVE',
    });

    standardUser = await UserModel.create({
      email: 'candidate@corpverse.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      displayName: 'Junior Developer',
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      emailVerified: true,
      status: 'ACTIVE',
    });

    aiManagerToken = signAccessToken({
      userId: aiManagerUser._id.toString(),
      email: aiManagerUser.email,
      careerRole: aiManagerUser.careerRole,
      platformRole: aiManagerUser.platformRole,
    });
    adminToken = signAccessToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      careerRole: adminUser.careerRole,
      platformRole: adminUser.platformRole,
    });
    standardToken = signAccessToken({
      userId: standardUser._id.toString(),
      email: standardUser.email,
      careerRole: standardUser.careerRole,
      platformRole: standardUser.platformRole,
    });
  });

  // -------------------------------------------------------------------------
  // 1. Key Vault Encryption & Masking
  // -------------------------------------------------------------------------
  describe('AES-256-GCM Key Vault & Masking', () => {
    it('should encrypt and decrypt secrets cleanly with round-trip accuracy', () => {
      const plaintext = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encryptSecret(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption if ciphertext or auth tag is tampered with', () => {
      const plaintext = 'sensitive_api_key_secret_value';
      const encrypted = encryptSecret(plaintext);
      const parts = encrypted.split(':');

      // Tamper with ciphertext
      const corruptedCipher = parts[2].slice(0, -2) + 'ff';
      const corruptedPayload = `${parts[0]}:${parts[1]}:${corruptedCipher}`;

      expect(() => decryptSecret(corruptedPayload)).toThrow();
    });

    it('should mask API keys exposing only the last 4 characters', () => {
      expect(maskApiKey('sk-proj-1234567890')).toBe('sk-••••••••7890');
      expect(maskApiKey('AIzaSyD9876543210')).toBe('••••••••3210');
      expect(maskApiKey('short')).toBe('••••••••hort');
      expect(maskApiKey('123')).toBe('••••••••');
    });

    it('should never expose plaintext API keys or encryptedApiKey in database JSON response', async () => {
      const rawApiKey = 'gsk_ultra_secret_api_key_test_9999';

      const res = await request(app)
        .post('/api/ai-manager/providers')
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          code: 'groq',
          name: 'Groq Cloud LPU',
          priority: 3,
          pool: 'PIPELINE',
          apiKey: rawApiKey,
          modelId: 'llama-3.3-70b-versatile',
          reason: 'Initial provider onboarding',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const providerData = res.body.data.provider;
      expect(providerData.maskedApiKey).toBe('••••••••9999');
      expect(providerData.encryptedApiKey).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(rawApiKey);

      // Verify DB storage: encryptedApiKey is stored, not plaintext
      const dbDoc = await AIProviderModel.findById(providerData.id).select('+encryptedApiKey');
      expect(dbDoc?.encryptedApiKey).toBeDefined();
      expect(dbDoc?.encryptedApiKey).not.toContain(rawApiKey);

      // Decryption verifies stored key matches raw key
      const decrypted = decryptSecret(dbDoc!.encryptedApiKey!);
      expect(decrypted).toBe(rawApiKey);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Role-Based Access Control (RBAC)
  // -------------------------------------------------------------------------
  describe('RBAC Governance: AI Manager vs Admin vs Non-privileged', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/ai-manager/providers');
      expect(res.status).toBe(401);
    });

    it('should reject standard users (platformRole NONE) with 403', async () => {
      const res = await request(app)
        .get('/api/ai-manager/providers')
        .set('Authorization', `Bearer ${standardToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow AI_MANAGER to access mutation endpoints', async () => {
      const res = await request(app)
        .post('/api/ai-manager/providers')
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          code: 'gemini',
          name: 'Google Gemini Flash',
          priority: 1,
          pool: 'PIPELINE',
          reason: 'Enable Gemini for pipeline pool',
        });

      expect(res.status).toBe(201);
    });

    it('should forbid AI_MANAGER from accessing Admin routes (spec constraint)', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${aiManagerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('ADMIN');
    });

    it('should allow ADMIN to access read-only AI Manager endpoints', async () => {
      const res = await request(app)
        .get('/api/ai-manager/providers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const healthRes = await request(app)
        .get('/api/ai-manager/health-usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(healthRes.status).toBe(200);
      expect(healthRes.body.data.queueStats).toBeDefined();
      expect(healthRes.body.data.queueStats).toHaveProperty('depth');
      expect(healthRes.body.data.queueStats).toHaveProperty('waitingForProvider');
    });

    it('should forbid ADMIN from accessing AI Manager mutation endpoints', async () => {
      const res = await request(app)
        .post('/api/ai-manager/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'openai',
          name: 'OpenAI GPT-4o',
          priority: 2,
          pool: 'PIPELINE',
          reason: 'Admin attempting direct provider addition',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('AI_MANAGER');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Provider CRUD, Priority Routing & Disabled Skipping
  // -------------------------------------------------------------------------
  describe('Provider CRUD, Priority Routing & Skipping Disabled Providers', () => {
    it('should alter provider selection routing when priority is updated', async () => {
      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      const openaiAdapter = new MockAdapter({ provider: 'openai' });

      // Initially Gemini is priority 1, OpenAI is priority 2
      router.registerAdapter('PIPELINE', geminiAdapter, 1);
      router.registerAdapter('PIPELINE', openaiAdapter, 2);

      await AIProviderModel.create({
        code: 'gemini',
        name: 'Gemini',
        priority: 1,
        pool: 'PIPELINE',
        status: 'HEALTHY',
        rateLimitRpm: 60,
      });

      await AIProviderModel.create({
        code: 'openai',
        name: 'OpenAI',
        priority: 2,
        pool: 'PIPELINE',
        status: 'HEALTHY',
        rateLimitRpm: 60,
      });

      // Initially selects Gemini
      expect(router.selectProvider('PIPELINE')?.provider).toBe('gemini');

      // AI Manager deprioritizes Gemini (priority 5), making OpenAI (priority 2) the primary!
      const patchRes = await request(app)
        .patch('/api/ai-manager/providers/gemini')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          priority: 5,
          reason: 'Promoting OpenAI to primary due to Gemini maintenance',
        });

      expect(patchRes.status).toBe(200);

      // Router immediately picks OpenAI as first priority!
      expect(router.selectProvider('PIPELINE')?.provider).toBe('openai');
    });

    it('should skip DISABLED providers during routing selection', async () => {
      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      const openaiAdapter = new MockAdapter({ provider: 'openai' });

      router.registerAdapter('PIPELINE', geminiAdapter, 1);
      router.registerAdapter('PIPELINE', openaiAdapter, 2);

      await AIProviderModel.create({
        code: 'gemini',
        name: 'Gemini',
        priority: 1,
        pool: 'PIPELINE',
        status: 'HEALTHY',
        rateLimitRpm: 60,
      });

      // Initially Gemini is selected
      expect(router.selectProvider('PIPELINE')?.provider).toBe('gemini');

      // AI Manager disables Gemini
      const disableRes = await request(app)
        .post('/api/ai-manager/providers/gemini/disable')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          reason: 'Emergency provider disablement',
        });

      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.provider.status).toBe('DISABLED');

      // Router now skips Gemini and selects OpenAI!
      expect(router.selectProvider('PIPELINE')?.provider).toBe('openai');

      // Enabling Gemini restores it to first priority
      const enableRes = await request(app)
        .post('/api/ai-manager/providers/gemini/enable')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          reason: 'Maintenance complete, re-enabling Gemini',
        });

      expect(enableRes.status).toBe(200);
      expect(enableRes.body.data.provider.status).toBe('HEALTHY');
      expect(router.selectProvider('PIPELINE')?.provider).toBe('gemini');
    });

    it('should remove a provider cleanly from DB and router', async () => {
      const groqAdapter = new MockAdapter({ provider: 'groq' });
      router.registerAdapter('PIPELINE', groqAdapter, 1);

      await AIProviderModel.create({
        code: 'groq',
        name: 'Groq',
        priority: 1,
        pool: 'PIPELINE',
        status: 'HEALTHY',
        rateLimitRpm: 60,
      });

      const deleteRes = await request(app)
        .delete('/api/ai-manager/providers/groq')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          reason: 'Decommissioning Groq test instance',
        });

      expect(deleteRes.status).toBe(200);

      // Verify removed from DB
      const dbDoc = await AIProviderModel.findOne({ code: 'groq', pool: 'PIPELINE' });
      expect(dbDoc).toBeNull();

      // Verify removed from router
      expect(router.getAdapter('PIPELINE', 'groq')).toBeUndefined();
    });

    it('should write an audit log for every change with mandatory reason', async () => {
      // 1. Create
      await request(app)
        .post('/api/ai-manager/providers')
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          code: 'gemini',
          name: 'Google Gemini',
          priority: 1,
          pool: 'PIPELINE',
          reason: 'Audited provider creation reason',
        });

      // 2. Update
      await request(app)
        .patch('/api/ai-manager/providers/gemini')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          rateLimitRpm: 120,
          reason: 'Upgrading tier rate limit',
        });

      // 3. Disable
      await request(app)
        .post('/api/ai-manager/providers/gemini/disable')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          reason: 'Temporary pause',
        });

      const auditLogs = await AuditLogModel.find({ actorRole: 'AI_MANAGER' });
      expect(auditLogs.length).toBe(3);

      expect(auditLogs[0].action).toBe('AI_PROVIDER_CREATE');
      expect(auditLogs[0].reason).toBe('Audited provider creation reason');

      expect(auditLogs[1].action).toBe('AI_PROVIDER_UPDATE');
      expect(auditLogs[1].reason).toBe('Upgrading tier rate limit');

      expect(auditLogs[2].action).toBe('AI_PROVIDER_UPDATE');
      expect(auditLogs[2].reason).toBe('Temporary pause');
    });

    it('should execute live test health ping returning diagnostics', async () => {
      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      router.registerAdapter('PIPELINE', geminiAdapter, 1);

      await AIProviderModel.create({
        code: 'gemini',
        name: 'Gemini',
        priority: 1,
        pool: 'PIPELINE',
        status: 'DEGRADED',
        rateLimitRpm: 60,
      });

      const testRes = await request(app)
        .post('/api/ai-manager/providers/gemini/test')
        .query({ pool: 'PIPELINE' })
        .set('Authorization', `Bearer ${aiManagerToken}`);

      expect(testRes.status).toBe(200);
      expect(testRes.body.success).toBe(true);
      expect(testRes.body.data.status).toBe('HEALTHY');
      expect(testRes.body.data.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
