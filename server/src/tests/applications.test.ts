import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { ApplicationService } from '../services/career/application.service.js';
import { ApplicationModel, type IApplicationDocument } from '../models/Application.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ProfileModel, type IProfileDocument } from '../models/Profile.js';
import { ResumeAnalysisModel, type IResumeAnalysisDocument } from '../models/ResumeAnalysis.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../models/CompanyJob.js';
import { configService } from '../services/config/config.service.js';
import type { ApplicationsConfig } from '../config/platformConfig.schema.js';

describe('Job Applications Service & State Machine Integration Suite (TASK P6.1)', () => {
  let applicationService: ApplicationService;

  const mockUserId = new Types.ObjectId();
  const mockJobId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockResumeAnalysisId = new Types.ObjectId();
  const mockResumeId = new Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();
    applicationService = new ApplicationService();

    // Default configService mock
    vi.spyOn(configService, 'getApplicationsConfig').mockResolvedValue({
      maxActive: 5,
    } as ApplicationsConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupValidMocks(overrides: {
    userCareerRole?: string;
    profileExists?: boolean;
    hasResumeAnalysisId?: boolean;
    analysisStatus?: string;
    activeApplicationsCount?: number;
    existingActiveApp?: boolean;
    jobStatus?: string;
    jobIsOpen?: boolean;
    companyStatus?: string;
    companyType?: string;
  } = {}) {
    const {
      userCareerRole = 'JOB_SEEKER',
      profileExists = true,
      hasResumeAnalysisId = true,
      analysisStatus = 'COMPLETED',
      activeApplicationsCount = 0,
      existingActiveApp = false,
      jobStatus = 'OPEN',
      jobIsOpen = true,
      companyStatus = 'ACTIVE',
      companyType = 'PLATFORM',
    } = overrides;

    // User mock
    vi.spyOn(UserModel, 'findById').mockResolvedValue({
      _id: mockUserId,
      careerRole: userCareerRole,
      status: 'ACTIVE',
      emailVerified: true,
    } as unknown as IUserDocument);

    // Profile mock
    vi.spyOn(ProfileModel, 'findOne').mockResolvedValue(
      profileExists
        ? ({
            _id: new Types.ObjectId(),
            userId: mockUserId,
            resumeAnalysisId: hasResumeAnalysisId ? mockResumeAnalysisId : null,
          } as unknown as IProfileDocument)
        : null
    );

    // ResumeAnalysis mock
    vi.spyOn(ResumeAnalysisModel, 'findById').mockResolvedValue(
      hasResumeAnalysisId
        ? ({
            _id: mockResumeAnalysisId,
            resumeId: mockResumeId,
            status: analysisStatus,
            domainClassification: 'SOFTWARE_ENGINEERING',
            parsedSkills: ['TypeScript', 'Node.js', 'React'],
            yearsOfExperience: 3,
            name: 'Jane Candidate',
            extractedSummary: 'Full-stack engineer with React/Node expertise.',
            education: [{ institution: 'Tech University', degree: 'BS Computer Science' }],
            workHistory: [{ company: 'Acme Corp', role: 'Software Engineer' }],
            projects: [{ title: 'CorpVerse System', techStack: ['TypeScript'] }],
            certifications: [{ name: 'AWS Solutions Architect' }],
          } as unknown as IResumeAnalysisDocument)
        : null
    );

    // Active applications count mock
    vi.spyOn(ApplicationModel, 'countDocuments').mockResolvedValue(activeApplicationsCount);

    // Existing active application mock
    vi.spyOn(ApplicationModel, 'findOne').mockResolvedValue(
      existingActiveApp
        ? ({
            _id: new Types.ObjectId(),
            userId: mockUserId,
            jobId: mockJobId,
            status: 'ACTIVE',
          } as unknown as IApplicationDocument)
        : null
    );

    // Job mock
    vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
      _id: mockJobId,
      companyId: mockCompanyId,
      title: 'Full Stack Engineer',
      domain: 'SOFTWARE_ENGINEERING',
      status: jobStatus,
      isOpen: jobIsOpen,
    } as unknown as ICompanyJobDocument);

    // Company mock
    vi.spyOn(CompanyModel, 'findById').mockResolvedValue({
      _id: mockCompanyId,
      name: 'Nexus Enterprise Systems',
      status: companyStatus,
      type: companyType,
    } as unknown as ICompanyDocument);

    // ApplicationModel save mock
    vi.spyOn(ApplicationModel.prototype, 'save').mockImplementation(async function (
      this: IApplicationDocument
    ) {
      this._id = this._id || new Types.ObjectId();
      return this;
    });
  }

  describe('1. Role & Candidate Precondition Enforcement', () => {
    it('should allow JOB_SEEKER to submit an application on the happy path', async () => {
      setupValidMocks();

      const app = await applicationService.applyForJob(mockUserId, {
        jobId: mockJobId,
        mode: 'PRODUCTION',
      });

      expect(app).toBeDefined();
      expect(app.userId.toString()).toBe(mockUserId.toString());
      expect(app.jobId.toString()).toBe(mockJobId.toString());
      expect(app.companyId.toString()).toBe(mockCompanyId.toString());
      expect(app.mode).toBe('PRODUCTION');
      expect(app.currentStage).toBe('APPLIED');
      expect(app.status).toBe('ACTIVE');
      expect(app.stageHistory).toHaveLength(1);
      expect(app.stageHistory[0].stage).toBe('APPLIED');
      expect(app.resumeAnalysisSnapshot.parsedSkills).toContain('TypeScript');
      expect(app.resumeAnalysisSnapshot.yearsOfExperience).toBe(3);
    });

    it('should reject non-JOB_SEEKER users (e.g., EMPLOYEE)', async () => {
      setupValidMocks({ userCareerRole: 'EMPLOYEE' });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/only users with career role job_seeker/i);
    });

    it('should reject non-JOB_SEEKER users with role NONE', async () => {
      setupValidMocks({ userCareerRole: 'NONE' });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/only users with career role job_seeker/i);
    });

    it('should reject when candidate profile does not exist', async () => {
      setupValidMocks({ profileExists: false });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/candidate profile must be created/i);
    });

    it('should reject when profile has no resumeAnalysisId attached', async () => {
      setupValidMocks({ hasResumeAnalysisId: false });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/completed resume analysis is required/i);
    });

    it('should reject when resume analysis is not in COMPLETED status (e.g., PENDING)', async () => {
      setupValidMocks({ analysisStatus: 'PENDING' });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/resume analysis must be in completed status/i);
    });

    it('should reject when resume analysis failed or scanned', async () => {
      setupValidMocks({ analysisStatus: 'SCANNED_UNREADABLE' });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/resume analysis must be in completed status/i);
    });
  });

  describe('2. The 5 Active Applications Limit Enforcement', () => {
    it('should permit application submission when active count is 0, 1, 2, 3, or 4', async () => {
      for (let count = 0; count < 5; count++) {
        setupValidMocks({ activeApplicationsCount: count });

        const app = await applicationService.applyForJob(mockUserId, {
          jobId: mockJobId,
        });

        expect(app).toBeDefined();
        expect(app.status).toBe('ACTIVE');
      }
    });

    it('should REJECT the 6th application when active applications count is 5', async () => {
      setupValidMocks({ activeApplicationsCount: 5 });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/maximum active applications limit reached \(5\)/i);
    });

    it('should REJECT when active applications count exceeds limit (e.g., 6 or more)', async () => {
      setupValidMocks({ activeApplicationsCount: 7 });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/maximum active applications limit reached/i);
    });

    it('should read dynamic maxActive value from PlatformConfig if altered', async () => {
      vi.spyOn(configService, 'getApplicationsConfig').mockResolvedValue({
        maxActive: 3,
      } as ApplicationsConfig);

      setupValidMocks({ activeApplicationsCount: 3 });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/maximum active applications limit reached \(3\)/i);
    });
  });

  describe('3. Duplicate Active Application Prevention', () => {
    it('should reject applying to the same job if an ACTIVE application already exists', async () => {
      setupValidMocks({ existingActiveApp: true });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/an active application already exists for this job/i);
    });

    it('should PERMIT applying to a job if previous application reached a terminal state', async () => {
      // existingActiveApp is false because previous app is REJECTED/WITHDRAWN/EXPIRED
      setupValidMocks({ existingActiveApp: false, activeApplicationsCount: 2 });

      const app = await applicationService.applyForJob(mockUserId, {
        jobId: mockJobId,
      });

      expect(app).toBeDefined();
      expect(app.status).toBe('ACTIVE');
    });
  });

  describe('4. Job & Company Availability Validation', () => {
    it('should reject application when job posting is closed (status: CLOSED)', async () => {
      setupValidMocks({ jobStatus: 'CLOSED', jobIsOpen: false });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/job requisition is closed/i);
    });

    it('should reject application when job posting is not found', async () => {
      setupValidMocks();
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(null);

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/job requisition not found/i);
    });

    it('should reject application when target company is BANKRUPT', async () => {
      setupValidMocks({ companyStatus: 'BANKRUPT' });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/company is bankrupt/i);
    });

    it('should reject application when target company is SUSPENDED', async () => {
      setupValidMocks({ companyStatus: 'SUSPENDED' });

      await expect(
        applicationService.applyForJob(mockUserId, { jobId: mockJobId })
      ).rejects.toThrowError(/company is suspended/i);
    });
  });

  describe('5. Mode-Agnostic and Company-Agnostic Support', () => {
    it('should support mode DEMO cleanly', async () => {
      setupValidMocks();

      const app = await applicationService.applyForJob(mockUserId, {
        jobId: mockJobId,
        mode: 'DEMO',
      });

      expect(app.mode).toBe('DEMO');
    });

    it('should support mode PRODUCTION by default', async () => {
      setupValidMocks();

      const app = await applicationService.applyForJob(mockUserId, {
        jobId: mockJobId,
      });

      expect(app.mode).toBe('PRODUCTION');
    });

    it('should seamlessly support applications to founder-owned companies', async () => {
      setupValidMocks({ companyType: 'FOUNDER' });

      const app = await applicationService.applyForJob(mockUserId, {
        jobId: mockJobId,
      });

      expect(app).toBeDefined();
      expect(app.companyId.toString()).toBe(mockCompanyId.toString());
    });
  });

  describe('6. Candidate Voluntary Withdrawal', () => {
    it('should withdraw an active application and update stageHistory', async () => {
      const mockAppDoc = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        jobId: mockJobId,
        currentStage: 'SCREENING',
        status: 'ACTIVE',
        stageHistory: [
          { stage: 'APPLIED', enteredAt: new Date(), exitedAt: new Date(), result: 'ADVANCED' },
          { stage: 'ATS_SCREENING', enteredAt: new Date(), exitedAt: new Date(), result: 'ADVANCED' },
          { stage: 'SCREENING', enteredAt: new Date() },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockAppDoc);

      const withdrawn = await applicationService.withdrawApplication(
        mockUserId,
        mockAppDoc._id,
        'Found another position'
      );

      expect(withdrawn.status).toBe('WITHDRAWN');
      expect(withdrawn.withdrawalReason).toBe('Found another position');
      expect(withdrawn.stageHistory[2].exitedAt).toBeDefined();
      expect(withdrawn.stageHistory[2].result).toBe('WITHDRAWN');
      expect(mockAppDoc.save).toHaveBeenCalled();
    });

    it('should reject withdrawal when caller is not the application owner', async () => {
      const strangerId = new Types.ObjectId();
      const mockAppDoc = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        status: 'ACTIVE',
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockAppDoc);

      await expect(
        applicationService.withdrawApplication(strangerId, mockAppDoc._id)
      ).rejects.toThrowError(/do not have permission to withdraw/i);
    });

    it('should throw when attempting to withdraw an already terminal application', async () => {
      const mockAppDoc = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        currentStage: 'INTERVIEW',
        status: 'REJECTED',
        stageHistory: [{ stage: 'INTERVIEW', enteredAt: new Date() }],
        save: vi.fn(),
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockAppDoc);

      await expect(
        applicationService.withdrawApplication(mockUserId, mockAppDoc._id)
      ).rejects.toThrowError(/already in terminal status/i);
    });
  });

  describe('7. Stale Application Expiry Background Job', () => {
    it('should expire active applications older than staleDays threshold', async () => {
      const staleDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old

      const staleApp1 = {
        _id: new Types.ObjectId(),
        currentStage: 'ASSESSMENT',
        status: 'ACTIVE',
        stageHistory: [{ stage: 'ASSESSMENT', enteredAt: staleDate }],
        updatedAt: staleDate,
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      const staleApp2 = {
        _id: new Types.ObjectId(),
        currentStage: 'OFFER',
        status: 'ACTIVE',
        stageHistory: [{ stage: 'OFFER', enteredAt: staleDate }],
        updatedAt: staleDate,
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel, 'find').mockResolvedValue([staleApp1, staleApp2]);

      const result = await applicationService.expireStaleApplications(30);

      expect(result.expiredCount).toBe(2);
      expect(result.expiredApplicationIds).toHaveLength(2);
      expect(staleApp1.status).toBe('EXPIRED');
      expect(staleApp1.expiryReason).toContain('30 days of inactivity');
      expect(staleApp2.status).toBe('EXPIRED');
      expect(staleApp1.save).toHaveBeenCalled();
      expect(staleApp2.save).toHaveBeenCalled();
    });

    it('should handle zero stale applications gracefully', async () => {
      vi.spyOn(ApplicationModel, 'find').mockResolvedValue([]);

      const result = await applicationService.expireStaleApplications(30);

      expect(result.expiredCount).toBe(0);
      expect(result.expiredApplicationIds).toEqual([]);
    });
  });
});
