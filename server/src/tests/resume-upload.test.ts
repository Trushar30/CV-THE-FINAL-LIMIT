import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { ResumeFile } from '../models/ResumeFile.js';
import { configService } from '../services/config/config.service.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_resume_upload';

function createValidPdfBuffer(content = 'Curriculum Vitae candidate info'): Buffer {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
0000000210 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF
`);
}

function createEncryptedPdfBuffer(): Buffer {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Filter /Standard /V 2 /R 3 /P -1052 >>
endobj
trailer
<< /Encrypt 1 0 R >>
startxref
100
%%EOF
`);
}

function createCorruptPdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\nCorrupted binary without EOF termination');
}

function createValidDocxBuffer(): Buffer {
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
  const e1 = makeZipEntry('[Content_Types].xml', contentTypesXml);
  const e2 = makeZipEntry('word/document.xml', '<w:document><w:body><w:p/></w:body></w:document>');

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
  const cdOffset = offset;
  const cdTotalSize = cdHeaders.reduce((s, h) => s + h.length, 0);

  const eocd = Buffer.alloc(22);
  eocd.write('PK\x05\x06', 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdTotalSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);

  return Buffer.concat([...entries.flatMap((e) => [e.lfh, e.dataBuf]), ...cdHeaders, eocd]);
}

function createEncryptedDocxBuffer(): Buffer {
  // ZIP header with general purpose bit 0 set (encryption flag)
  const lfh = Buffer.alloc(40);
  lfh.write('PK\x03\x04', 0);
  lfh.writeUInt16LE(20, 4);
  lfh.writeUInt16LE(1, 6); // Encryption bit flag = 1
  return lfh;
}

function createCorruptDocxBuffer(): Buffer {
  // Starts with PK\x03\x04 but has no EOCD PK\x05\x06
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12, 0x34]);
}

describe('Resume Upload & Ingestion Engine (TASK P4.2)', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await ProfileModel.collection.deleteMany({});
      await ResumeFile.collection.deleteMany({});
      // Clean up GridFS collections
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('resumes.files').deleteMany({});
        await mongoose.connection.db.collection('resumes.chunks').deleteMany({});
      }
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await UserModel.collection.deleteMany({});
    await ProfileModel.collection.deleteMany({});
    await ResumeFile.collection.deleteMany({});
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('resumes.files').deleteMany({});
      await mongoose.connection.db.collection('resumes.chunks').deleteMany({});
    }
    await configService.seedDefaultsIfMissing();
  });

  async function createUser(
    overrides: Partial<Record<string, unknown>> = {}
  ): Promise<IUserDocument> {
    const passwordHash = await hashPassword('ValidPass123!');
    return UserModel.create({
      email: `candidate_${Date.now()}_${Math.random().toString(36).substring(7)}@corpverse.dev`,
      passwordHash,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'SKILLS',
      failedLoginAttempts: 0,
      totalExp: 0,
      corpCoinBalance: 0,
      ...overrides,
    });
  }

  it('1. Rejects wrong file type with a renamed extension (text file disguised as .pdf)', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const fakePdfContent = Buffer.from(
      'This is a plain text file that was maliciously renamed to candidate_resume.pdf'
    );

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', fakePdfContent, 'candidate_resume.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.reason).toBe('INVALID_FILE_TYPE');
  });

  it('2. Rejects wrong file type with a renamed extension (PNG disguised as .docx)', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    // PNG magic bytes 0x89 0x50 0x4E 0x47 followed by standard chunk data (>= 32 bytes)
    const fakeDocxPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0x42),
    ]);

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', fakeDocxPng, 'fake_resume.docx');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.reason).toBe('INVALID_FILE_TYPE');
  });

  it('3. Rejects corrupt or truncated PDF file (missing %%EOF marker)', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const corruptPdf = createCorruptPdfBuffer();

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', corruptPdf, 'corrupt.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.reason).toBe('CORRUPT_FILE');
  });

  it('4. Rejects corrupt or truncated DOCX file (missing ZIP EOCD structure)', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const corruptDocx = createCorruptDocxBuffer();

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', corruptDocx, 'corrupt.docx');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.reason).toBe('CORRUPT_FILE');
  });

  it('5. Rejects password-protected / encrypted PDF files with clear error', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const encryptedPdf = createEncryptedPdfBuffer();

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', encryptedPdf, 'protected.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.reason).toBe('PASSWORD_PROTECTED_FILE');
  });

  it('6. Rejects password-protected / encrypted DOCX files with clear error', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const encryptedDocx = createEncryptedDocxBuffer();

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', encryptedDocx, 'protected.docx');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.reason).toBe('PASSWORD_PROTECTED_FILE');
  });

  it('7. Rejects oversized file exceeding PlatformConfig.security.resumeMaxSizeBytes with HTTP 413', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    // Temporarily set resumeMaxSizeBytes to 20 KB to test boundary without huge heap allocations
    const currentConfig = await configService.getConfig();
    await configService.updateConfig({
      newConfig: {
        ...currentConfig,
        security: {
          ...currentConfig.security,
          resumeMaxSizeBytes: 20 * 1024, // 20 KB
        },
      },
      adminId: user._id.toString(),
      reason: 'Testing max resume size boundary',
    });

    // Create a valid PDF that is ~25 KB
    const largePadding = 'A'.repeat(25 * 1024);
    const oversizePdf = createValidPdfBuffer(largePadding);

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', oversizePdf, 'oversized_resume.pdf');

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8. Successfully uploads a valid PDF, stores binary in GridFS, records metadata, and updates onboardingStep', async () => {
    const user = await createUser({ onboardingStep: 'SKILLS' });
    await ProfileModel.create({
      userId: user._id,
      displayName: 'Alice Engineer',
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['TypeScript', 'Node.js'],
    });

    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const validPdf = createValidPdfBuffer('Alice Engineer - Senior Software Engineer');

    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', validPdf, 'Alice_Resume_2026.pdf');

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resumeId).toBeDefined();
    expect(res.body.data.filename).toBe('Alice_Resume_2026.pdf');
    expect(res.body.data.mimeType).toBe('application/pdf');
    expect(res.body.data.status).toBe('UPLOADED');
    expect(res.body.data.checksum).toBeDefined();

    // Verify metadata document in resumes collection
    const resumeRecord = await ResumeFile.findById(res.body.data.resumeId);
    expect(resumeRecord).not.toBeNull();
    expect(resumeRecord!.userId.toString()).toBe(user._id.toString());
    expect(resumeRecord!.gridFsFileId).toBeDefined();
    expect(resumeRecord!.sizeBytes).toBe(validPdf.length);

    // Verify Profile linkage
    const updatedProfile = await ProfileModel.findOne({ userId: user._id });
    expect(updatedProfile!.resumeId?.toString()).toBe(res.body.data.resumeId);

    // Verify User onboarding step advanced to RESUME
    const updatedUser = await UserModel.findById(user._id);
    expect(updatedUser!.onboardingStep).toBe('RESUME');

    // Verify GridFS storage
    const bucketFiles = await mongoose.connection.db
      ?.collection('resumes.files')
      .findOne({ _id: resumeRecord!.gridFsFileId });
    expect(bucketFiles).not.toBeNull();
    expect(bucketFiles!.length).toBe(validPdf.length);
  });

  it('9. Successfully uploads a valid DOCX file and sanitizes malicious path traversal filename', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    const validDocx = createValidDocxBuffer();

    // Malicious traversal filename
    const res = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', validDocx, '../../../../etc/malicious_resume.docx');

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.filename).toBe('malicious_resume.docx');
    expect(res.body.data.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('10. Re-upload archives previous resume per ADR-039 (Archive & Preserve)', async () => {
    const user = await createUser();
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });

    // 1st Upload
    const firstPdf = createValidPdfBuffer('First Version');
    const res1 = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', firstPdf, 'resume_v1.pdf');
    expect(res1.status).toBe(202);
    const resume1Id = res1.body.data.resumeId;

    // 2nd Upload
    const secondPdf = createValidPdfBuffer('Second Version');
    const res2 = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', secondPdf, 'resume_v2.pdf');
    expect(res2.status).toBe(202);
    const resume2Id = res2.body.data.resumeId;

    // Verify first resume is archived but preserved in storage
    const record1 = await ResumeFile.findById(resume1Id);
    expect(record1!.status).toBe('ARCHIVED');

    // Verify second resume is active
    const record2 = await ResumeFile.findById(resume2Id);
    expect(record2!.status).toBe('UPLOADED');

    // Verify both binaries still exist in GridFS
    const file1 = await mongoose.connection.db
      ?.collection('resumes.files')
      .findOne({ _id: record1!.gridFsFileId });
    const file2 = await mongoose.connection.db
      ?.collection('resumes.files')
      .findOne({ _id: record2!.gridFsFileId });
    expect(file1).not.toBeNull();
    expect(file2).not.toBeNull();
  });

  it('11. Prevents unauthorized candidate B from downloading candidate A resume with HTTP 403', async () => {
    const candidateA = await createUser();
    const candidateB = await createUser();

    const tokenA = signAccessToken({
      userId: candidateA._id.toString(),
      email: candidateA.email,
      platformRole: candidateA.platformRole,
      careerRole: candidateA.careerRole,
    });

    const tokenB = signAccessToken({
      userId: candidateB._id.toString(),
      email: candidateB.email,
      platformRole: candidateB.platformRole,
      careerRole: candidateB.careerRole,
    });

    const pdfBuffer = createValidPdfBuffer('Confidential candidate A info');
    const uploadRes = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('resume', pdfBuffer, 'candidate_a.pdf');

    const resumeId = uploadRes.body.data.resumeId;

    // Candidate B attempts to download Candidate A's resume
    const downloadRes = await request(app)
      .get(`/api/profile/resume/${resumeId}/download`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(downloadRes.status).toBe(403);
    expect(downloadRes.body.success).toBe(false);
    expect(downloadRes.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('12. Prevents unauthenticated request from downloading resume with HTTP 401', async () => {
    const candidate = await createUser();
    const token = signAccessToken({
      userId: candidate._id.toString(),
      email: candidate.email,
      platformRole: candidate.platformRole,
      careerRole: candidate.careerRole,
    });

    const pdfBuffer = createValidPdfBuffer('Candidate info');
    const uploadRes = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdfBuffer, 'resume.pdf');

    const resumeId = uploadRes.body.data.resumeId;

    const res = await request(app).get(`/api/profile/resume/${resumeId}/download`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('13. Allows owner candidate to stream and download their resume', async () => {
    const candidate = await createUser();
    const token = signAccessToken({
      userId: candidate._id.toString(),
      email: candidate.email,
      platformRole: candidate.platformRole,
      careerRole: candidate.careerRole,
    });

    const pdfBuffer = createValidPdfBuffer('Candidate Original Resume Content');
    const uploadRes = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdfBuffer, 'my_resume.pdf');

    const resumeId = uploadRes.body.data.resumeId;

    const downloadRes = await request(app)
      .get(`/api/profile/resume/${resumeId}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toBe('application/pdf');
    expect(downloadRes.headers['content-disposition']).toContain('my_resume.pdf');
    expect(downloadRes.body).toBeInstanceOf(Buffer);
    expect(downloadRes.body.toString('latin1')).toBe(pdfBuffer.toString('latin1'));
  });

  it('14. Allows platform ADMIN to stream and download any candidate resume', async () => {
    const candidate = await createUser();
    const admin = await createUser({ platformRole: 'ADMIN' });

    const candidateToken = signAccessToken({
      userId: candidate._id.toString(),
      email: candidate.email,
      platformRole: candidate.platformRole,
      careerRole: candidate.careerRole,
    });

    const adminToken = signAccessToken({
      userId: admin._id.toString(),
      email: admin.email,
      platformRole: admin.platformRole,
      careerRole: admin.careerRole,
    });

    const pdfBuffer = createValidPdfBuffer('Candidate Content For Admin Review');
    const uploadRes = await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${candidateToken}`)
      .attach('resume', pdfBuffer, 'admin_check.pdf');

    const resumeId = uploadRes.body.data.resumeId;

    // Admin downloads candidate resume
    const downloadRes = await request(app)
      .get(`/api/profile/resume/${resumeId}/download`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toBe('application/pdf');
    expect(downloadRes.body.toString('latin1')).toBe(pdfBuffer.toString('latin1'));
  });

  it('15. Retrieves active resume metadata via GET /api/profile/resume/active', async () => {
    const candidate = await createUser();
    const token = signAccessToken({
      userId: candidate._id.toString(),
      email: candidate.email,
      platformRole: candidate.platformRole,
      careerRole: candidate.careerRole,
    });

    const pdfBuffer = createValidPdfBuffer('Active metadata test');
    await request(app)
      .post('/api/profile/resume/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdfBuffer, 'active_meta.pdf');

    const activeRes = await request(app)
      .get('/api/profile/resume/active')
      .set('Authorization', `Bearer ${token}`);

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.success).toBe(true);
    expect(activeRes.body.data.resume.filename).toBe('active_meta.pdf');
    expect(activeRes.body.data.resume.status).toBe('UPLOADED');
  });
});
