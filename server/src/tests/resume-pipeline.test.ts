import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { ResumeFile } from '../models/ResumeFile.js';
import { ResumeAnalysis } from '../models/ResumeAnalysis.js';
import { AIJobModel } from '../models/AIJob.js';
import {
  ProviderRouter,
  HealthTracker,
  AIGateway,
  AIWorker,
  MockAdapter,
  defaultRouter,
} from '../ai/index.js';
import { ResumeAnalysisService } from '../services/resume/resumeAnalysis.service.js';
import { textExtractionService } from '../services/resume/textExtraction.service.js';
import { resumeAnalysisOutputSchema } from '../schemas/resumeAnalysis.schema.js';
import { resumeService } from '../services/resume/resume.service.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_resume_pipeline';

// ---------------------------------------------------------------------------
// Binary Document Fixture Helpers
// ---------------------------------------------------------------------------

function createPdfBuffer(textContent: string): Buffer {
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${textContent}) Tj\nET`;
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamContent.length} >>
stream
${streamContent}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
0000000250 00000 n 
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF
`);
}

function createDocxBuffer(textContent: string): Buffer {
  function makeZipEntry(filename: string, content: string) {
    const nameBuf = Buffer.from(filename);
    const dataBuf = Buffer.from(content);
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.write('PK\x03\x04', 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(0, 8);
    lfh.writeUInt32LE(dataBuf.length, 18);
    lfh.writeUInt32LE(dataBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(lfh, 30);
    return { lfh, dataBuf, nameBuf, len: lfh.length + dataBuf.length };
  }

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${textContent}</w:t></w:r></w:p></w:body></w:document>`;

  const e1 = makeZipEntry('[Content_Types].xml', contentTypesXml);
  const e2 = makeZipEntry('word/document.xml', documentXml);

  let offset = 0;
  const entries = [e1, e2];
  const cdHeaders: Buffer[] = [];
  for (const e of entries) {
    const cdh = Buffer.alloc(46 + e.nameBuf.length);
    cdh.write('PK\x01\x02', 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt32LE(e.dataBuf.length, 20);
    cdh.writeUInt32LE(e.dataBuf.length, 24);
    cdh.writeUInt16LE(e.nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);
    e.nameBuf.copy(cdh, 46);
    cdHeaders.push(cdh);
    offset += e.len;
  }

  const cdTotalSize = cdHeaders.reduce((acc, h) => acc + h.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.write('PK\x05\x06', 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdTotalSize, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([e1.lfh, e1.dataBuf, e2.lfh, e2.dataBuf, ...cdHeaders, eocd]);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Resume Processing Pipeline Suite (TASK P4.3)', () => {
  let app: ReturnType<typeof createApp>;
  let candidateUser: IUserDocument;
  let candidateToken: string;
  let otherUser: IUserDocument;
  let otherToken: string;
  let adminUser: IUserDocument;
  let adminToken: string;

  let testRouter: ProviderRouter;
  let testTracker: HealthTracker;
  let testGateway: AIGateway;
  let testWorker: AIWorker;
  let mockAdapter: MockAdapter;
  let testPipelineService: ResumeAnalysisService;
  let httpMockAdapter: MockAdapter;

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
    app = createApp();

    const passwordHash = await hashPassword('StrongPassword123!');

    candidateUser = await UserModel.create({
      email: `candidate_pipe_${Date.now()}@corpverse.dev`,
      passwordHash,
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'SKILLS',
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
    });
    candidateToken = signAccessToken({
      userId: candidateUser._id.toString(),
      email: candidateUser.email,
      platformRole: 'NONE',
      careerRole: 'JOB_SEEKER',
    });

    await ProfileModel.create({
      userId: candidateUser._id,
      displayName: `Candidate Pipe ${Date.now()}`,
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['TypeScript'],
    });

    otherUser = await UserModel.create({
      email: `other_pipe_${Date.now()}@corpverse.dev`,
      passwordHash,
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'SKILLS',
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
    });
    otherToken = signAccessToken({
      userId: otherUser._id.toString(),
      email: otherUser.email,
      platformRole: 'NONE',
      careerRole: 'JOB_SEEKER',
    });

    adminUser = await UserModel.create({
      email: `admin_pipe_${Date.now()}@corpverse.dev`,
      passwordHash,
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETE',
      careerRole: 'NONE',
      platformRole: 'ADMIN',
    });
    adminToken = signAccessToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      platformRole: 'ADMIN',
      careerRole: 'NONE',
    });

    // Wire mock adapter into defaultRouter for HTTP endpoints (upload route uses default router)
    httpMockAdapter = new MockAdapter({ provider: 'gemini' });
    defaultRouter.registerAdapter('PIPELINE', httpMockAdapter, 1);
  });

  afterAll(async () => {
    await UserModel.deleteMany({
      email: { $in: [candidateUser.email, otherUser.email, adminUser.email] },
    });
    await ResumeFile.deleteMany({});
    await ResumeAnalysis.deleteMany({});
    await AIJobModel.deleteMany({});
    await ProfileModel.deleteMany({});
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Setup isolated ProviderRouter, AIGateway, AIWorker, and ResumeAnalysisService
    testRouter = new ProviderRouter();
    testTracker = new HealthTracker(testRouter);
    testGateway = new AIGateway(testRouter, testTracker);
    testWorker = new AIWorker(testRouter, testTracker, {
      pools: ['PIPELINE'],
      pollIntervalMs: 1000,
      maxAttemptsPerProvider: 3,
    });

    mockAdapter = new MockAdapter({
      provider: 'openai',
      defaultResponse: 'Mock AI Response',
    });
    testRouter.registerAdapter('PIPELINE', mockAdapter, 1);

    testPipelineService = new ResumeAnalysisService(testGateway, testWorker);
  });

  // =========================================================================
  // 1. Text Extraction Service Unit Tests
  // =========================================================================
  describe('1. TextExtractionService', () => {
    it('extracts text accurately from a valid PDF buffer', async () => {
      const samplePdfText =
        'Jane Doe is a Staff Software Engineer with expertise in TypeScript, Express, and Docker.';
      const buffer = createPdfBuffer(samplePdfText);

      const result = await textExtractionService.extractText(buffer, 'application/pdf');
      expect(result.text).toContain('Jane Doe is a Staff Software Engineer');
      expect(result.isScannedOrEmpty).toBe(false);
      expect(result.charCount).toBeGreaterThanOrEqual(40);
    });

    it('extracts text accurately from a valid DOCX buffer', async () => {
      const sampleDocxText =
        'Bob Smith - Senior Cloud Architect specializing in AWS, Terraform, and Kubernetes infrastructure.';
      const buffer = createDocxBuffer(sampleDocxText);

      const result = await textExtractionService.extractText(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(result.text).toContain('Bob Smith - Senior Cloud Architect');
      expect(result.isScannedOrEmpty).toBe(false);
      expect(result.charCount).toBeGreaterThanOrEqual(40);
    });

    it('flags scanned PDF or blank file (< 40 alphanumeric characters) as isScannedOrEmpty', async () => {
      // PDF with short non-meaningful content (e.g. only a few chars, simulating scanned image without OCR)
      const scannedBuffer = createPdfBuffer('Page 1');

      const result = await textExtractionService.extractText(scannedBuffer, 'application/pdf');
      expect(result.isScannedOrEmpty).toBe(true);
      expect(result.text).toBe('');
      expect(result.charCount).toBeLessThan(40);
    });

    it('throws validation error when provided with an empty buffer', async () => {
      await expect(
        textExtractionService.extractText(Buffer.alloc(0), 'application/pdf')
      ).rejects.toThrow('Cannot extract text from an empty buffer.');
    });

    it('throws bad request error for unsupported MIME types', async () => {
      await expect(
        textExtractionService.extractText(Buffer.from('hello'), 'image/png')
      ).rejects.toThrow('Unsupported MIME type for text extraction');
    });
  });

  // =========================================================================
  // 2. Strict Zod Schema Validation
  // =========================================================================
  describe('2. resumeAnalysisOutputSchema Zod Validation', () => {
    it('accepts fully compliant AI structured output', () => {
      const validPayload = {
        name: 'Jane Doe',
        contact: {
          email: 'jane@example.com',
          phone: '+1-555-0100',
          location: 'San Francisco, CA',
          github: 'https://github.com/janedoe',
        },
        skills: ['TypeScript', 'Node.js', 'MongoDB', 'Docker', 'AWS'],
        education: [
          {
            institution: 'University of California, Berkeley',
            degree: 'B.S.',
            fieldOfStudy: 'Computer Science',
            graduationYear: 2021,
          },
        ],
        experience: [
          {
            company: 'TechCorp',
            role: 'Software Engineer',
            duration: '2021 - Present',
            description: 'Building distributed microservices and APIs',
            highlights: ['Improved latency by 35%'],
          },
        ],
        projects: [
          {
            title: 'CloudMesh',
            description: 'Service mesh observability platform',
            techStack: ['Go', 'Kubernetes'],
          },
        ],
        certifications: [
          {
            name: 'AWS Solutions Architect Associate',
            issuer: 'Amazon Web Services',
            year: 2022,
          },
        ],
        summary: 'Passionate software engineer focused on cloud infrastructure.',
        domainClassification: 'SOFTWARE_ENGINEERING',
        yearsOfExperience: 3,
      };

      const parsed = resumeAnalysisOutputSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Jane Doe');
        expect(parsed.data.skills).toHaveLength(5);
        expect(parsed.data.domainClassification).toBe('SOFTWARE_ENGINEERING');
      }
    });

    it('rejects output missing mandatory name', () => {
      const invalidPayload = {
        name: '',
        skills: ['Python'],
        domainClassification: 'AI_ENGINEERING',
      };
      const parsed = resumeAnalysisOutputSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejects invalid domain classification not in CAREER_DOMAINS', () => {
      const invalidPayload = {
        name: 'Alex Johnson',
        domainClassification: 'HARDWARE_ENGINEERING', // Not in v1 domains
      };
      const parsed = resumeAnalysisOutputSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejects negative years of experience', () => {
      const invalidPayload = {
        name: 'Alex Johnson',
        yearsOfExperience: -2,
      };
      const parsed = resumeAnalysisOutputSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Pipeline Integration & Queue Processing
  // =========================================================================
  describe('3. Asynchronous Pipeline Integration & Worker Processing', () => {
    it('processes a PDF resume through the pipeline and populates ResumeAnalysis and Profile', async () => {
      // 1. Upload valid PDF
      const resumeContent =
        'Alice Smith - Principal Software Engineer with 8 years experience in TypeScript, React, Node.js, and Distributed Systems.';
      const pdfBuffer = createPdfBuffer(resumeContent);

      const resumeDoc = await resumeService.uploadResume(candidateUser._id, {
        buffer: pdfBuffer,
        originalname: 'alice_resume.pdf',
        size: pdfBuffer.length,
        mimetype: 'application/pdf',
      });

      // 2. Configure mock adapter with valid structured data
      mockAdapter.setPersistentResponse({
        structuredData: {
          name: 'Alice Smith',
          contact: { email: 'alice@example.com', location: 'New York, NY' },
          skills: ['TypeScript', 'React', 'Node.js', 'Distributed Systems'],
          education: [{ institution: 'MIT', degree: 'B.S.', fieldOfStudy: 'Computer Science' }],
          experience: [
            { company: 'GlobalTech', role: 'Principal Software Engineer', duration: '8 years' },
          ],
          projects: [{ title: 'CorpNet', description: 'Real-time message broker' }],
          certifications: [],
          summary: 'Experienced software engineer',
          domainClassification: 'SOFTWARE_ENGINEERING',
          yearsOfExperience: 8,
        },
      });

      // 3. Trigger analysis pipeline
      const analysisDoc = await testPipelineService.createAndEnqueueJob(
        resumeDoc._id,
        candidateUser._id
      );

      expect(analysisDoc.status).toBe('PROCESSING');
      expect(analysisDoc.aiJobId).toBeDefined();

      // 4. Tick worker to claim and process the queued AI job
      await testWorker.tick();

      // 5. Verify ResumeAnalysis updated to COMPLETED with parsed data
      const updatedAnalysis = await ResumeAnalysis.findById(analysisDoc._id);
      expect(updatedAnalysis?.status).toBe('COMPLETED');
      expect(updatedAnalysis?.name).toBe('Alice Smith');
      expect(updatedAnalysis?.parsedSkills).toEqual(
        expect.arrayContaining(['TypeScript', 'React', 'Node.js'])
      );
      expect(updatedAnalysis?.yearsOfExperience).toBe(8);
      expect(updatedAnalysis?.domainClassification).toBe('SOFTWARE_ENGINEERING');

      // 6. Verify candidate Profile updated with resumeAnalysisId
      const profile = await ProfileModel.findOne({ userId: candidateUser._id });
      expect(profile?.resumeAnalysisId?.toString()).toBe(analysisDoc._id.toString());
    });

    it('processes a DOCX resume end-to-end through the queue', async () => {
      const docxText =
        'David Miller - Cloud Architect with 6 years experience in AWS, Kubernetes, Terraform, and Docker.';
      const docxBuffer = createDocxBuffer(docxText);

      const resumeDoc = await resumeService.uploadResume(candidateUser._id, {
        buffer: docxBuffer,
        originalname: 'david_resume.docx',
        size: docxBuffer.length,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      mockAdapter.setPersistentResponse({
        structuredData: {
          name: 'David Miller',
          contact: { email: 'david@cloud.com' },
          skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker'],
          education: [{ institution: 'Stanford University' }],
          experience: [{ company: 'CloudWorks', role: 'Cloud Architect' }],
          projects: [],
          certifications: [{ name: 'CKA Certified Kubernetes Administrator' }],
          summary: 'Cloud architecture expert',
          domainClassification: 'CLOUD_ENGINEERING',
          yearsOfExperience: 6,
        },
      });

      const analysisDoc = await testPipelineService.createAndEnqueueJob(
        resumeDoc._id,
        candidateUser._id
      );
      expect(analysisDoc.status).toBe('PROCESSING');

      await testWorker.tick();

      const completed = await ResumeAnalysis.findById(analysisDoc._id);
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.name).toBe('David Miller');
      expect(completed?.domainClassification).toBe('CLOUD_ENGINEERING');
      expect(completed?.parsedSkills).toContain('Terraform');
    });

    it('scanned/empty PDF transitions directly to SCANNED_UNREADABLE without invoking AI', async () => {
      // Create PDF with minimal text (< 40 chars)
      const scannedBuffer = createPdfBuffer('Page 1');

      const resumeDoc = await resumeService.uploadResume(candidateUser._id, {
        buffer: scannedBuffer,
        originalname: 'scanned_scan001.pdf',
        size: scannedBuffer.length,
        mimetype: 'application/pdf',
      });

      const initialCallCount = mockAdapter.getCallCount();

      const analysisDoc = await testPipelineService.createAndEnqueueJob(
        resumeDoc._id,
        candidateUser._id
      );

      expect(analysisDoc.status).toBe('SCANNED_UNREADABLE');
      expect(analysisDoc.failureReason).toBe('SCANNED_PDF_NO_TEXT');
      expect(analysisDoc.aiJobId).toBeUndefined();
      expect(mockAdapter.getCallCount()).toBe(initialCallCount); // AI was NEVER invoked
    });

    it('retries on invalid Zod output and NEVER persists invalid data into ResumeAnalysis', async () => {
      const resumeContent =
        'Charlie Brown - Junior AI Engineer with experience in Python, PyTorch, and NLP models.';
      const pdfBuffer = createPdfBuffer(resumeContent);

      const resumeDoc = await resumeService.uploadResume(candidateUser._id, {
        buffer: pdfBuffer,
        originalname: 'charlie_resume.pdf',
        size: pdfBuffer.length,
        mimetype: 'application/pdf',
      });

      // Provider returns invalid structured data (missing required 'name' field)
      mockAdapter.setPersistentResponse({
        structuredData: {
          name: '', // Invalid: fails z.string().min(1)
          skills: ['Python'],
          domainClassification: 'AI_ENGINEERING',
        },
      });

      const analysisDoc = await testPipelineService.createAndEnqueueJob(
        resumeDoc._id,
        candidateUser._id
      );

      // First single attempt: worker generates, Zod validation fails, job marked RETRYING
      await testWorker.processNextJob('PIPELINE');

      const aiJob = await AIJobModel.findById(analysisDoc.aiJobId);
      expect(aiJob?.status).toBe('RETRYING');
      expect(aiJob?.attempts).toBe(1);

      // Verify ResumeAnalysis did NOT store invalid data
      const intermediateAnalysis = await ResumeAnalysis.findById(analysisDoc._id);
      expect(intermediateAnalysis?.status).toBe('PROCESSING');
      expect(intermediateAnalysis?.name).toBeUndefined(); // Never stored invalid data
    });

    it('transitions to WAITING_FOR_PROVIDER when all provider attempts are exhausted', async () => {
      const resumeContent =
        'Eva Green - Cloud Specialist with Docker and Linux background and networking experience.';
      const pdfBuffer = createPdfBuffer(resumeContent);

      const resumeDoc = await resumeService.uploadResume(candidateUser._id, {
        buffer: pdfBuffer,
        originalname: 'eva_resume.pdf',
        size: pdfBuffer.length,
        mimetype: 'application/pdf',
      });

      // Mock permanent provider failure (timeout/500)
      mockAdapter.setPersistentError('TIMEOUT');

      const analysisDoc = await testPipelineService.createAndEnqueueJob(
        resumeDoc._id,
        candidateUser._id
      );

      // Run 3 worker ticks to exhaust the 3 attempts per provider limit
      await testWorker.tick(); // attempt 1 -> RETRYING
      await testWorker.tick(); // attempt 2 -> RETRYING
      await testWorker.tick(); // attempt 3 -> WAITING_FOR_PROVIDER

      const aiJob = await AIJobModel.findById(analysisDoc.aiJobId);
      expect(aiJob?.status).toBe('WAITING_FOR_PROVIDER');

      // Check status via getAnalysisByResumeId
      const statusResult = await testPipelineService.getAnalysisByResumeId(resumeDoc._id, {
        _id: candidateUser._id,
      });

      expect(statusResult.status).toBe('WAITING_FOR_PROVIDER');
      expect(statusResult.message).toContain('waiting for an available provider');
    });
  });

  // =========================================================================
  // 4. HTTP API Endpoints & Access Control
  // =========================================================================
  describe('4. HTTP API Endpoints (GET /analysis, GET /:id/analysis, POST /upload)', () => {
    it('POST /api/profile/resume/upload enqueues analysis and returns analysisId in 202 response', async () => {
      const validText =
        'Grace Hopper - Pioneer Computer Scientist and Systems Architect with Naval background.';
      const pdfBuffer = createPdfBuffer(validText);

      const res = await request(app)
        .post('/api/profile/resume/upload')
        .set('Authorization', `Bearer ${candidateToken}`)
        .attach('resume', pdfBuffer, 'grace_hopper.pdf');

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resumeId).toBeDefined();
      expect(res.body.data.analysisId).toBeDefined();

      const createdAnalysis = await ResumeAnalysis.findById(res.body.data.analysisId);
      expect(createdAnalysis).not.toBeNull();
      expect(createdAnalysis?.status).toBe('PROCESSING');
    });

    it('GET /api/profile/resume/analysis returns current candidate active resume analysis', async () => {
      const res = await request(app)
        .get('/api/profile/resume/analysis')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBeDefined();
    });

    it('GET /api/profile/resume/:id/analysis returns analysis for specific resume ID', async () => {
      const activeResume = await ResumeFile.findOne({
        userId: candidateUser._id,
        status: 'UPLOADED',
      });
      expect(activeResume).not.toBeNull();

      const res = await request(app)
        .get(`/api/profile/resume/${activeResume!._id.toString()}/analysis`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBeDefined();
    });

    it('GET /api/profile/resume/:id/analysis returns 403 Forbidden when accessed by unauthorized candidate', async () => {
      const activeResume = await ResumeFile.findOne({
        userId: candidateUser._id,
        status: 'UPLOADED',
      });
      expect(activeResume).not.toBeNull();

      const res = await request(app)
        .get(`/api/profile/resume/${activeResume!._id.toString()}/analysis`)
        .set('Authorization', `Bearer ${otherToken}`); // Other candidate

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not authorized');
    });

    it('GET /api/profile/resume/:id/analysis allows ADMIN platformRole to inspect candidate analysis', async () => {
      const activeResume = await ResumeFile.findOne({
        userId: candidateUser._id,
        status: 'UPLOADED',
      });
      expect(activeResume).not.toBeNull();

      const res = await request(app)
        .get(`/api/profile/resume/${activeResume!._id.toString()}/analysis`)
        .set('Authorization', `Bearer ${adminToken}`); // ADMIN

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/profile/resume/:id/analysis returns 404 when resume ID does not exist', async () => {
      const fakeId = new Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/profile/resume/${fakeId}/analysis`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
