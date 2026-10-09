import { Types } from 'mongoose';
import {
  ResumeAnalysis,
  type IResumeAnalysisDocument,
  type ResumeAnalysisStatus,
} from '../../models/ResumeAnalysis.js';
import { ResumeFile } from '../../models/ResumeFile.js';
import { ProfileModel } from '../../models/Profile.js';
import { AIJobModel, type IAIJobDocument } from '../../models/AIJob.js';
import { resumeService } from './resume.service.js';
import { textExtractionService } from './textExtraction.service.js';
import {
  resumeAnalysisJsonSchema,
  resumeAnalysisOutputSchema,
  type ResumeAnalysisOutput,
} from '../../schemas/resumeAnalysis.schema.js';
import { defaultAIGateway, defaultAIWorker, AIGateway, AIWorker, AIError } from '../../ai/index.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { RequesterIdentity } from './resume.service.js';
import type { CareerDomain } from '../../types/enums.js';
import { env } from '../../config/env.js';

export const RESUME_ANALYSIS_SYSTEM_PROMPT = `You are the authoritative, strict resume parsing and entity extraction engine for CorpVerse.
Your mission is to parse candidate resumes and convert raw text into a verified structured profile.

NON-NEGOTIABLE NON-INVENTION RULES:
1. STRICT ADHERENCE TO SOURCE: Extract ONLY facts, names, contacts, skills, employment dates, roles, and education that are explicitly stated in the resume text.
2. ZERO FABRICATION: Do NOT invent, assume, infer, extrapolate, or hallucinate missing information under any circumstances.
3. ALL SCHEMA KEYS MANDATORY: Every single key defined in the schema must appear in your JSON output. If any string or number field (e.g. phone, location, linkedin, github, website, duration, description, link, graduationYear, year) is not present in the resume, set its value explicitly to null. If any list (e.g. skills, highlights, techStack, projects, certifications, education, experience) is empty, set its value explicitly to []. NEVER omit any key from any object.
4. DOMAIN CLASSIFICATION: Classify the candidate into exactly one of: 'SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING', or 'AI_ENGINEERING' based strictly on the technical evidence present in the text.
5. YEARS OF EXPERIENCE: Extract the total professional experience in years as an integer/float. If unstated and cannot be derived directly from dates, set to 0.
6. STRICT JSON ONLY: Return ONLY the valid JSON object conforming strictly to the required schema. Do NOT include markdown code blocks, explanations, or any conversational text.`;

export interface ResumeAnalysisResponseDto {
  status: ResumeAnalysisStatus | 'WAITING_FOR_PROVIDER';
  isScannedOrEmpty?: boolean;
  message?: string;
  failureReason?: string;
  jobId?: string;
  jobAttempts?: number;
  analysis?: {
    id: string;
    resumeId: string;
    userId: string;
    status: ResumeAnalysisStatus;
    name?: string;
    contact?: Record<string, unknown>;
    skills: string[];
    yearsOfExperience: number;
    domainClassification: string;
    summary?: string;
    education?: unknown[];
    workHistory?: unknown[];
    projects?: unknown[];
    certifications?: unknown[];
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export class ResumeAnalysisService {
  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly aiWorker: AIWorker = defaultAIWorker
  ) {
    this.registerWorkerHooks();
  }

  /**
   * Registers custom Zod validation and lifecycle handlers with AIWorker
   */
  private registerWorkerHooks(): void {
    // 1. Zod schema validation before marking an AIJob as completed
    this.aiWorker.registerValidator('RESUME_ANALYSIS', (_job, response) => {
      if (!response.structuredData) {
        throw new AIError(
          'AI provider returned no structured data for RESUME_ANALYSIS',
          'PROVIDER_ERROR'
        );
      }

      const parseResult = resumeAnalysisOutputSchema.safeParse(response.structuredData);
      if (!parseResult.success) {
        const issuesMsg = parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        logger.warn(`[ResumeAnalysis] AI output failed strict Zod schema validation: ${issuesMsg}`);
        throw new AIError(
          `Zod schema validation failed for RESUME_ANALYSIS: ${issuesMsg}`,
          'PROVIDER_ERROR'
        );
      }
    });

    // 2. Completion hook: persist validated fields to ResumeAnalysis and update Profile
    this.aiWorker.registerHandler('RESUME_ANALYSIS', async (job) => {
      await this.handleJobCompletion(job);
    });

    // 3. State change hook: track WAITING_FOR_PROVIDER or FAILED states
    this.aiWorker.registerStateChangeHandler('RESUME_ANALYSIS', async (job) => {
      await this.handleJobStateChange(job);
    });
  }

  /**
   * Extracts raw binary from GridFS, extracts text, handles scanned PDFs,
   * creates the ResumeAnalysis record, and enqueues an asynchronous AI job.
   */
  public async createAndEnqueueJob(
    resumeId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IResumeAnalysisDocument> {
    const resumeObjectId = typeof resumeId === 'string' ? new Types.ObjectId(resumeId) : resumeId;
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const resumeDoc = await ResumeFile.findById(resumeObjectId);
    if (!resumeDoc) {
      throw AppError.notFound('Resume file not found.');
    }

    // 1. Stream binary payload from GridFS
    const bucket = resumeService.getBucket();
    const downloadStream = bucket.openDownloadStream(resumeDoc.gridFsFileId);
    const chunks: Buffer[] = [];

    for await (const chunk of downloadStream) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    // 2. Extract text with pdf-parse / mammoth
    const extraction = await textExtractionService.extractText(buffer, resumeDoc.mimeType);

    // 3. Find or create ResumeAnalysis record
    let analysis = await ResumeAnalysis.findOne({ resumeId: resumeObjectId });
    if (!analysis) {
      analysis = new ResumeAnalysis({
        resumeId: resumeObjectId,
        userId: userObjectId,
        status: 'PENDING',
        parsedSkills: [],
        yearsOfExperience: 0,
        domainClassification: 'SOFTWARE_ENGINEERING',
        confidenceScore: 100,
      });
    }

    analysis.extractedText = extraction.text;

    // 4. Handle Scanned PDFs or unreadable documents
    if (extraction.isScannedOrEmpty) {
      logger.info(
        `[ResumeAnalysis] Resume ${resumeObjectId.toString()} detected as scanned or unreadable (char count: ${extraction.charCount})`
      );
      analysis.status = 'SCANNED_UNREADABLE';
      analysis.failureReason = 'SCANNED_PDF_NO_TEXT';
      await analysis.save();
      return analysis;
    }

    // 5. Submit AI request to AIGateway queue
    analysis.status = 'PROCESSING';
    analysis.failureReason = undefined;
    await analysis.save();

    try {
      const preferredProvider =
        process.env.GROQ_RESUME_API_KEY || env.GROQ_RESUME_API_KEY ? 'groq' : undefined;

      const jobId = await this.aiGateway.submit(
        {
          taskType: 'RESUME_ANALYSIS',
          userInput: `CANDIDATE RESUME TEXT:\n\n${extraction.text}`,
          systemInstruction: RESUME_ANALYSIS_SYSTEM_PROMPT,
          outputSchema: resumeAnalysisJsonSchema,
          temperature: 0.1,
          maxTokens: 4096,
        },
        {
          pool: 'PIPELINE',
          preferredProvider,
          requestorReference: analysis._id.toString(),
          idempotencyKey: `resume-analysis-${resumeObjectId.toString()}`,
        }
      );

      analysis.aiJobId = new Types.ObjectId(jobId);
      await analysis.save();
    } catch (submitErr) {
      logger.error(
        `[ResumeAnalysis] Failed to submit AI job for resume ${resumeObjectId.toString()}: ${(submitErr as Error).message}`
      );
      analysis.status = 'FAILED';
      analysis.failureReason = (submitErr as Error).message;
      await analysis.save();
      throw submitErr;
    }

    return analysis;
  }

  /**
   * Direct synchronous analysis pipeline (used for immediate processing or tests).
   * Validates with Zod before storing; never stores unvalidated data.
   */
  public async analyzeDirectSync(
    resumeId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IResumeAnalysisDocument> {
    const resumeObjectId = typeof resumeId === 'string' ? new Types.ObjectId(resumeId) : resumeId;
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const resumeDoc = await ResumeFile.findById(resumeObjectId);
    if (!resumeDoc) {
      throw AppError.notFound('Resume file not found.');
    }

    const bucket = resumeService.getBucket();
    const downloadStream = bucket.openDownloadStream(resumeDoc.gridFsFileId);
    const chunks: Buffer[] = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    const extraction = await textExtractionService.extractText(buffer, resumeDoc.mimeType);

    let analysis = await ResumeAnalysis.findOne({ resumeId: resumeObjectId });
    if (!analysis) {
      analysis = new ResumeAnalysis({
        resumeId: resumeObjectId,
        userId: userObjectId,
        status: 'PROCESSING',
        parsedSkills: [],
        yearsOfExperience: 0,
        domainClassification: 'SOFTWARE_ENGINEERING',
        confidenceScore: 100,
      });
    }

    analysis.extractedText = extraction.text;

    if (extraction.isScannedOrEmpty) {
      analysis.status = 'SCANNED_UNREADABLE';
      analysis.failureReason = 'SCANNED_PDF_NO_TEXT';
      await analysis.save();
      return analysis;
    }

    const preferredProvider =
      process.env.GROQ_RESUME_API_KEY || env.GROQ_RESUME_API_KEY ? 'groq' : undefined;

    // Call AIGateway synchronously
    const response = await this.aiGateway.execute(
      {
        taskType: 'RESUME_ANALYSIS',
        userInput: `CANDIDATE RESUME TEXT:\n\n${extraction.text}`,
        systemInstruction: RESUME_ANALYSIS_SYSTEM_PROMPT,
        outputSchema: resumeAnalysisJsonSchema,
        temperature: 0.1,
        maxTokens: 4096,
      },
      {
        pool: 'PIPELINE',
        preferredProvider,
      }
    );

    // Validate with Zod
    const parsed = resumeAnalysisOutputSchema.safeParse(response.structuredData);
    if (!parsed.success) {
      analysis.status = 'FAILED';
      analysis.failureReason = 'INVALID_AI_SCHEMA_OUTPUT';
      await analysis.save();
      throw AppError.badRequest('Resume analysis output failed schema validation', {
        issues: parsed.error.issues,
      });
    }

    // Persist validated output
    this.populateAnalysisData(analysis, parsed.data);
    analysis.status = 'COMPLETED';
    analysis.failureReason = undefined;
    await analysis.save();

    await ProfileModel.findOneAndUpdate(
      { userId: userObjectId },
      { $set: { resumeAnalysisId: analysis._id } }
    );

    return analysis;
  }

  /**
   * Finalizes ResumeAnalysis when an AIJob completes successfully
   */
  public async handleJobCompletion(job: IAIJobDocument): Promise<void> {
    const analysis = await ResumeAnalysis.findOne({
      $or: [{ aiJobId: job._id }, { _id: job.requestorReference }],
    });

    if (!analysis) {
      logger.warn(
        `[ResumeAnalysis] No ResumeAnalysis document found for completed AIJob ${job._id.toString()}`
      );
      return;
    }

    const structured = job.result?.structuredData;
    const parsed = resumeAnalysisOutputSchema.safeParse(structured);
    if (!parsed.success) {
      logger.error(
        `[ResumeAnalysis] AIJob ${job._id.toString()} has invalid output, refusing to store unvalidated data`
      );
      analysis.status = 'FAILED';
      analysis.failureReason = 'INVALID_AI_OUTPUT_SCHEMA';
      await analysis.save();
      return;
    }

    this.populateAnalysisData(analysis, parsed.data);
    analysis.status = 'COMPLETED';
    analysis.failureReason = undefined;
    await analysis.save();

    // Link resumeAnalysisId into candidate profile
    await ProfileModel.findOneAndUpdate(
      { userId: analysis.userId },
      { $set: { resumeAnalysisId: analysis._id } }
    );

    logger.info(
      `[ResumeAnalysis] Analysis completed successfully for resume ${analysis.resumeId.toString()}`
    );
  }

  /**
   * Updates ResumeAnalysis state when an AIJob transitions into WAITING_FOR_PROVIDER or FAILED
   */
  public async handleJobStateChange(job: IAIJobDocument): Promise<void> {
    const analysis = await ResumeAnalysis.findOne({
      $or: [{ aiJobId: job._id }, { _id: job.requestorReference }],
    });

    if (!analysis) return;

    if (job.status === 'WAITING_FOR_PROVIDER') {
      analysis.failureReason = 'WAITING_FOR_PROVIDER';
      await analysis.save();
    } else if (job.status === 'FAILED') {
      analysis.status = 'FAILED';
      analysis.failureReason = job.error?.message || 'AI_JOB_FAILED';
      await analysis.save();
    }
  }

  /**
   * Retrieves analysis status and formatted results for a specific resume.
   * Dynamically evaluates queue job status if processing.
   */
  public async getAnalysisByResumeId(
    resumeId: string | Types.ObjectId,
    requester: RequesterIdentity
  ): Promise<ResumeAnalysisResponseDto> {
    if (!resumeId || !Types.ObjectId.isValid(resumeId)) {
      throw AppError.badRequest('Invalid resume ID format.');
    }

    const resumeObjectId = typeof resumeId === 'string' ? new Types.ObjectId(resumeId) : resumeId;
    const analysis = await ResumeAnalysis.findOne({ resumeId: resumeObjectId });

    if (!analysis) {
      throw AppError.notFound('No analysis found for this resume.');
    }

    // Authorization check
    const requesterId = requester._id.toString();
    const ownerId = analysis.userId.toString();
    const isAdmin = requester.platformRole === 'ADMIN';

    if (requesterId !== ownerId && !isAdmin) {
      throw AppError.forbidden('You are not authorized to view this resume analysis.');
    }

    // 1. Scanned or unreadable document
    if (analysis.status === 'SCANNED_UNREADABLE') {
      return {
        status: 'SCANNED_UNREADABLE',
        isScannedOrEmpty: true,
        message:
          'Scanned PDF or image detected without extractable text layer. Please upload a text-searchable PDF or Word document.',
        failureReason: analysis.failureReason,
        analysis: null,
      };
    }

    // 2. Check if linked to an active AI queue job
    if (analysis.aiJobId && (analysis.status === 'PENDING' || analysis.status === 'PROCESSING')) {
      const job = await AIJobModel.findById(analysis.aiJobId);
      if (job) {
        if (job.status === 'COMPLETED') {
          await this.handleJobCompletion(job);
          return this.formatCompletedResponse(analysis);
        }

        if (job.status === 'WAITING_FOR_PROVIDER') {
          return {
            status: 'WAITING_FOR_PROVIDER',
            message: 'AI analysis job is queued waiting for an available provider.',
            jobId: job._id.toString(),
            jobAttempts: job.attempts,
            analysis: null,
          };
        }

        if (job.status === 'FAILED') {
          analysis.status = 'FAILED';
          analysis.failureReason = job.error?.message || 'AI analysis failed.';
          await analysis.save();
          return {
            status: 'FAILED',
            message: analysis.failureReason,
            failureReason: analysis.failureReason,
            jobId: job._id.toString(),
            analysis: null,
          };
        }

        return {
          status: 'PROCESSING',
          message:
            job.status === 'RETRYING'
              ? 'AI analysis job is retrying due to temporary provider failure.'
              : 'AI analysis job is currently processing.',
          jobId: job._id.toString(),
          jobAttempts: job.attempts,
          analysis: null,
        };
      }
    }

    // 3. Completed state
    if (analysis.status === 'COMPLETED') {
      return this.formatCompletedResponse(analysis);
    }

    // 4. Failed state
    if (analysis.status === 'FAILED') {
      return {
        status: 'FAILED',
        message: analysis.failureReason || 'Resume analysis failed.',
        failureReason: analysis.failureReason,
        analysis: null,
      };
    }

    // 5. Default PENDING / PROCESSING
    return {
      status: analysis.status,
      message: 'Resume analysis is pending.',
      analysis: null,
    };
  }

  /**
   * Retrieves active resume analysis for a candidate user
   */
  public async getActiveAnalysisForUser(
    userId: string | Types.ObjectId
  ): Promise<ResumeAnalysisResponseDto> {
    const activeResume = await resumeService.getActiveResumeForUser(userId);
    if (!activeResume) {
      throw AppError.notFound('No active resume found for this profile.');
    }

    return this.getAnalysisByResumeId(activeResume._id, { _id: userId });
  }

  private populateAnalysisData(
    analysis: IResumeAnalysisDocument,
    data: ResumeAnalysisOutput
  ): void {
    analysis.name = data.name;
    analysis.contact = data.contact;
    analysis.parsedSkills = data.skills;
    analysis.yearsOfExperience = data.yearsOfExperience;
    analysis.domainClassification = data.domainClassification as CareerDomain;
    analysis.extractedSummary = data.summary;
    analysis.education = data.education;
    analysis.workHistory = data.experience;
    analysis.projects = data.projects;
    analysis.certifications = data.certifications;
    analysis.rawAiOutput = data;
  }

  private formatCompletedResponse(analysis: IResumeAnalysisDocument): ResumeAnalysisResponseDto {
    return {
      status: 'COMPLETED',
      message: 'Resume analysis completed successfully.',
      analysis: {
        id: analysis._id.toString(),
        resumeId: analysis.resumeId.toString(),
        userId: analysis.userId.toString(),
        status: 'COMPLETED',
        name: analysis.name,
        contact: analysis.contact,
        skills: analysis.parsedSkills,
        yearsOfExperience: analysis.yearsOfExperience,
        domainClassification: analysis.domainClassification,
        summary: analysis.extractedSummary,
        education: analysis.education,
        workHistory: analysis.workHistory,
        projects: analysis.projects,
        certifications: analysis.certifications,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      },
    };
  }
}

export const resumeAnalysisService = new ResumeAnalysisService();
