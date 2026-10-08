import { Types } from 'mongoose';
import { CompanyModel, type ICompanyDocument } from '../../models/Company.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../../models/CompanyJob.js';
import { auditService } from '../audit/audit.service.js';
import { configService } from '../config/config.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { type AuditActorRole, type CareerDomain } from '../../types/enums.js';
import type {
  AdminCreateCompanyInput,
  AdminCreateJobInput,
  AdminUpdateCompanyInput,
  AdminUpdateJobInput,
  ListCompaniesQueryInput,
  ListJobsQueryInput,
} from '../../schemas/company.schema.js';

export interface SeedJobDefinition {
  title: string;
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  description: string;
  requiredSkills: string[];
  openings: number;
}

export interface SeedCompanyDefinition {
  name: string;
  description: string;
  domainsHired: CareerDomain[];
  ratings: {
    overall: number;
    culture: number;
    workLife: number;
    technicalExcellence: number;
  };
  financialHealth: number;
  jobs: SeedJobDefinition[];
}

export const SEEDED_PLATFORM_COMPANIES: readonly SeedCompanyDefinition[] = [
  {
    name: 'Nexus Enterprise Systems',
    description:
      'Premier enterprise architecture, mission-critical cloud backends, and highly scalable distributed systems.',
    domainsHired: ['SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING', 'AI_ENGINEERING'],
    ratings: {
      overall: 88,
      culture: 85,
      workLife: 82,
      technicalExcellence: 92,
    },
    financialHealth: 100000,
    jobs: [
      {
        title: 'Senior Backend Systems Architect',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 4,
        maxLevel: 8,
        description:
          'Design and scale multi-tenant microservices, transactional consistency protocols, and low-latency APIs.',
        requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'System Design'],
        openings: 2,
      },
      {
        title: 'Cloud Platform & Kubernetes Engineer',
        domain: 'CLOUD_ENGINEERING',
        minLevel: 3,
        maxLevel: 7,
        description:
          'Maintain high-availability Kubernetes clusters, automated GitOps deployment pipelines, and cloud security.',
        requiredSkills: ['Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Linux'],
        openings: 3,
      },
      {
        title: 'Enterprise AI & MLOps Platform Specialist',
        domain: 'AI_ENGINEERING',
        minLevel: 3,
        maxLevel: 6,
        description:
          'Deploy, monitor, and scale generative models and vector retrieval architectures in enterprise environments.',
        requiredSkills: ['Python', 'PyTorch', 'LangChain', 'Vector DBs', 'FastAPI'],
        openings: 2,
      },
    ],
  },
  {
    name: 'CloudScale Infrastructure',
    description:
      'Next-generation multi-cloud orchestrator, serverless compute fabric, and resilient edge operations.',
    domainsHired: ['CLOUD_ENGINEERING', 'SOFTWARE_ENGINEERING', 'AI_ENGINEERING'],
    ratings: {
      overall: 85,
      culture: 88,
      workLife: 84,
      technicalExcellence: 86,
    },
    financialHealth: 75000,
    jobs: [
      {
        title: 'Site Reliability & Cloud Operations Engineer',
        domain: 'CLOUD_ENGINEERING',
        minLevel: 2,
        maxLevel: 5,
        description:
          'Ensure zero-downtime platform reliability, implement alerting telemetry, and manage automated incident response.',
        requiredSkills: ['AWS', 'Kubernetes', 'Terraform', 'Observability', 'Linux'],
        openings: 4,
      },
      {
        title: 'Distributed Systems Backend Engineer',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 3,
        maxLevel: 6,
        description:
          'Develop resilient stream-processing engines and caching fabrics powering our global edge infrastructure.',
        requiredSkills: ['TypeScript', 'Node.js', 'REST APIs', 'MongoDB', 'Docker'],
        openings: 2,
      },
      {
        title: 'Cloud Inference Acceleration Specialist',
        domain: 'AI_ENGINEERING',
        minLevel: 4,
        maxLevel: 7,
        description:
          'Optimize model serving latency and distributed batch token processing across heterogeneous compute clusters.',
        requiredSkills: ['Python', 'PyTorch', 'FastAPI', 'Docker', 'Vector DBs'],
        openings: 1,
      },
    ],
  },
  {
    name: 'Synthetix AI Labs',
    description:
      'Pioneering cognitive agents, foundational generative pipelines, and frontier deep learning workflows.',
    domainsHired: ['AI_ENGINEERING', 'SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING'],
    ratings: {
      overall: 92,
      culture: 86,
      workLife: 80,
      technicalExcellence: 96,
    },
    financialHealth: 120000,
    jobs: [
      {
        title: 'Neural Architecture & LLM Systems Engineer',
        domain: 'AI_ENGINEERING',
        minLevel: 3,
        maxLevel: 7,
        description:
          'Construct multi-agent coordination loops, evaluate token efficiency, and fine-tune specialized models.',
        requiredSkills: ['Python', 'PyTorch', 'LangChain', 'Prompt Engineering', 'HuggingFace'],
        openings: 3,
      },
      {
        title: 'Full-Stack AI Interface Engineer',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 2,
        maxLevel: 5,
        description:
          'Bridge real-time model streaming and neural assistants with responsive, high-performance interfaces.',
        requiredSkills: ['TypeScript', 'Node.js', 'REST APIs', 'System Design', 'PostgreSQL'],
        openings: 2,
      },
      {
        title: 'GPU Cluster & Cloud Deployment Specialist',
        domain: 'CLOUD_ENGINEERING',
        minLevel: 4,
        maxLevel: 8,
        description:
          'Architect GPU distributed training clusters, compute interconnects, and scalable container environments.',
        requiredSkills: ['Kubernetes', 'AWS', 'Terraform', 'Linux', 'Observability'],
        openings: 2,
      },
    ],
  },
] as const;

export class CompanyService {
  /**
   * Idempotently seeds exactly the 3 PLATFORM companies from D13 with active jobs
   * across all domains they hire for. AI-powered and using the PIPELINE pool.
   */
  async seedPlatformCompanies(): Promise<void> {
    const config = await configService.getCompanyConfig();
    const maxEmployees = config?.maxEmployees ?? 20;

    for (const compDef of SEEDED_PLATFORM_COMPANIES) {
      let company = await CompanyModel.findOne({ name: compDef.name });

      if (!company) {
        company = await CompanyModel.create({
          name: compDef.name,
          description: compDef.description,
          type: 'PLATFORM',
          isPlatformCompany: true,
          ownerId: null,
          domainsHired: compDef.domainsHired,
          status: 'ACTIVE',
          ratings: compDef.ratings,
          companyRating: compDef.ratings.overall,
          financialHealth: compDef.financialHealth,
          employeeCount: 0,
          maxEmployees,
          aiProviderPool: 'PIPELINE',
        });
        logger.info(`[CompanyService] Seeded platform company: ${company.name} (${company._id})`);
      }

      // Seed jobs for this company
      for (const jobDef of compDef.jobs) {
        const existingJob = await CompanyJobModel.findOne({
          companyId: company._id,
          title: jobDef.title,
        });

        if (!existingJob) {
          await CompanyJobModel.create({
            companyId: company._id,
            title: jobDef.title,
            description: jobDef.description,
            domain: jobDef.domain,
            minLevel: jobDef.minLevel,
            maxLevel: jobDef.maxLevel,
            targetLevel: jobDef.minLevel,
            requiredSkills: jobDef.requiredSkills,
            openings: jobDef.openings,
            status: 'OPEN',
            isOpen: true,
          });
          logger.info(
            `[CompanyService] Seeded job '${jobDef.title}' in domain '${jobDef.domain}' for ${company.name}`
          );
        }
      }
    }

    logger.info('[CompanyService] Platform companies and initial jobs verified successfully');
  }

  /**
   * List companies with optional filtering by domain, status, type, and keyword search.
   * Enriches each company with the count of currently open jobs.
   */
  async listCompanies(query: ListCompaniesQueryInput): Promise<{
    companies: Array<Record<string, unknown>>;
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'ACTIVE';
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.domain) {
      filter.domainsHired = query.domain;
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { description: regex }];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const [totalCount, rawCompanies] = await Promise.all([
      CompanyModel.countDocuments(filter),
      CompanyModel.find(filter).sort({ companyRating: -1, name: 1 }).skip(skip).limit(limit).lean(),
    ]);

    // Aggregate active job counts for returned companies
    const companyIds = rawCompanies.map((c) => c._id);
    const jobCounts = await CompanyJobModel.aggregate([
      {
        $match: {
          companyId: { $in: companyIds },
          status: 'OPEN',
        },
      },
      {
        $group: {
          _id: '$companyId',
          openJobCount: { $sum: 1 },
        },
      },
    ]);

    const jobCountMap = new Map<string, number>();
    for (const item of jobCounts) {
      jobCountMap.set(String(item._id), item.openJobCount);
    }

    const companies = rawCompanies.map((c) => ({
      ...c,
      openJobCount: jobCountMap.get(String(c._id)) ?? 0,
    }));

    return {
      companies,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Get company details by ID, including its currently open jobs.
   */
  async getCompanyDetails(companyId: string): Promise<{
    company: ICompanyDocument;
    openJobs: ICompanyJobDocument[];
  }> {
    if (!Types.ObjectId.isValid(companyId)) {
      throw AppError.badRequest('Invalid company ID format');
    }

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw AppError.notFound(`Company with ID '${companyId}' not found`);
    }

    const openJobs = await CompanyJobModel.find({
      companyId: company._id,
      status: 'OPEN',
    }).sort({ minLevel: 1, title: 1 });

    return { company, openJobs };
  }

  /**
   * List, search, and filter open jobs.
   */
  async listJobs(query: ListJobsQueryInput): Promise<{
    jobs: Array<Record<string, unknown>>;
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'OPEN';
    }

    if (query.domain) {
      filter.domain = query.domain;
    }

    if (query.companyId && Types.ObjectId.isValid(query.companyId)) {
      filter.companyId = new Types.ObjectId(query.companyId);
    }

    if (query.minLevel !== undefined) {
      filter.maxLevel = { $gte: query.minLevel };
    }

    if (query.maxLevel !== undefined) {
      filter.minLevel = { $lte: query.maxLevel };
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ title: regex }, { description: regex }, { requiredSkills: { $in: [regex] } }];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const [totalCount, jobs] = await Promise.all([
      CompanyJobModel.countDocuments(filter),
      CompanyJobModel.find(filter)
        .populate('companyId', 'name type companyRating ratings status isPlatformCompany')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Get single job details with populated company information.
   */
  async getJobDetails(jobId: string): Promise<ICompanyJobDocument> {
    if (!Types.ObjectId.isValid(jobId)) {
      throw AppError.badRequest('Invalid job ID format');
    }

    const job = await CompanyJobModel.findById(jobId).populate(
      'companyId',
      'name type description companyRating ratings status domainsHired isPlatformCompany'
    );

    if (!job) {
      throw AppError.notFound(`Job with ID '${jobId}' not found`);
    }

    return job;
  }

  // ==========================================
  // ADMIN MUTATION METHODS (AUDIT LOGGED)
  // ==========================================

  /**
   * Admin create company with mandatory audit logging.
   */
  async adminCreateCompany(
    actorId: string,
    actorRole: AuditActorRole,
    input: AdminCreateCompanyInput
  ): Promise<ICompanyDocument> {
    const existing = await CompanyModel.findOne({ name: input.name.trim() });
    if (existing) {
      throw AppError.conflict(`Company with name '${input.name}' already exists`);
    }

    const config = await configService.getCompanyConfig();
    const maxEmployees = input.maxEmployees ?? config?.maxEmployees ?? 20;
    const overallRating = input.ratings?.overall ?? input.companyRating ?? 50;

    const company = await CompanyModel.create({
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      isPlatformCompany: input.type === 'PLATFORM',
      ownerId: null,
      domainsHired: input.domainsHired,
      status: 'ACTIVE',
      ratings: input.ratings ?? {
        overall: overallRating,
        culture: overallRating,
        workLife: overallRating,
        technicalExcellence: overallRating,
      },
      companyRating: overallRating,
      financialHealth: input.financialHealth ?? 0,
      employeeCount: 0,
      maxEmployees,
      aiProviderPool: 'PIPELINE',
    });

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_CREATE_COMPANY',
      targetType: 'Company',
      targetId: company._id,
      oldValue: null,
      newValue: {
        name: company.name,
        type: company.type,
        domainsHired: company.domainsHired,
        maxEmployees: company.maxEmployees,
      },
      reason: input.reason,
    });

    logger.info(`[CompanyService] Admin created company '${company.name}' (${company._id})`);
    return company;
  }

  /**
   * Admin update company with mandatory audit logging.
   */
  async adminUpdateCompany(
    actorId: string,
    actorRole: AuditActorRole,
    companyId: string,
    input: AdminUpdateCompanyInput
  ): Promise<ICompanyDocument> {
    if (!Types.ObjectId.isValid(companyId)) {
      throw AppError.badRequest('Invalid company ID format');
    }

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw AppError.notFound(`Company with ID '${companyId}' not found`);
    }

    const oldValue = {
      name: company.name,
      description: company.description,
      status: company.status,
      domainsHired: company.domainsHired,
      companyRating: company.companyRating,
      maxEmployees: company.maxEmployees,
      financialHealth: company.financialHealth,
    };

    if (input.name && input.name.trim() !== company.name) {
      const existing = await CompanyModel.findOne({
        name: input.name.trim(),
        _id: { $ne: company._id },
      });
      if (existing) {
        throw AppError.conflict(`Company with name '${input.name}' already exists`);
      }
      company.name = input.name.trim();
    }

    if (input.description) company.description = input.description.trim();
    if (input.status) company.status = input.status;
    if (input.domainsHired) company.domainsHired = input.domainsHired;
    if (input.maxEmployees) company.maxEmployees = input.maxEmployees;
    if (input.financialHealth !== undefined) company.financialHealth = input.financialHealth;
    if (input.ratings) company.ratings = input.ratings;
    if (input.companyRating !== undefined) {
      company.companyRating = input.companyRating;
      if (!company.ratings) {
        company.ratings = { overall: input.companyRating };
      } else {
        company.ratings.overall = input.companyRating;
      }
    }

    await company.save();

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_UPDATE_COMPANY',
      targetType: 'Company',
      targetId: company._id,
      oldValue,
      newValue: {
        name: company.name,
        description: company.description,
        status: company.status,
        domainsHired: company.domainsHired,
        companyRating: company.companyRating,
        maxEmployees: company.maxEmployees,
        financialHealth: company.financialHealth,
      },
      reason: input.reason,
    });

    logger.info(`[CompanyService] Admin updated company '${company.name}' (${company._id})`);
    return company;
  }

  /**
   * Admin create job with mandatory audit logging.
   */
  async adminCreateJob(
    actorId: string,
    actorRole: AuditActorRole,
    input: AdminCreateJobInput
  ): Promise<ICompanyJobDocument> {
    if (!Types.ObjectId.isValid(input.companyId)) {
      throw AppError.badRequest('Invalid companyId format');
    }

    const company = await CompanyModel.findById(input.companyId);
    if (!company) {
      throw AppError.notFound(`Company with ID '${input.companyId}' not found`);
    }

    const job = await CompanyJobModel.create({
      companyId: company._id,
      title: input.title.trim(),
      description: input.description.trim(),
      domain: input.domain,
      minLevel: input.minLevel,
      maxLevel: input.maxLevel,
      targetLevel: input.minLevel,
      requiredSkills: input.requiredSkills,
      openings: input.openings,
      status: input.status,
      isOpen: input.status === 'OPEN',
    });

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_CREATE_JOB',
      targetType: 'CompanyJob',
      targetId: job._id,
      oldValue: null,
      newValue: {
        companyId: job.companyId,
        title: job.title,
        domain: job.domain,
        minLevel: job.minLevel,
        maxLevel: job.maxLevel,
        openings: job.openings,
        status: job.status,
      },
      reason: input.reason,
    });

    logger.info(`[CompanyService] Admin created job '${job.title}' (${job._id})`);
    return job;
  }

  /**
   * Admin update job with mandatory audit logging.
   */
  async adminUpdateJob(
    actorId: string,
    actorRole: AuditActorRole,
    jobId: string,
    input: AdminUpdateJobInput
  ): Promise<ICompanyJobDocument> {
    if (!Types.ObjectId.isValid(jobId)) {
      throw AppError.badRequest('Invalid job ID format');
    }

    const job = await CompanyJobModel.findById(jobId);
    if (!job) {
      throw AppError.notFound(`Job with ID '${jobId}' not found`);
    }

    const oldValue = {
      title: job.title,
      description: job.description,
      domain: job.domain,
      minLevel: job.minLevel,
      maxLevel: job.maxLevel,
      requiredSkills: job.requiredSkills,
      openings: job.openings,
      status: job.status,
    };

    if (input.title) job.title = input.title.trim();
    if (input.description) job.description = input.description.trim();
    if (input.domain) job.domain = input.domain;
    if (input.minLevel !== undefined) job.minLevel = input.minLevel;
    if (input.maxLevel !== undefined) job.maxLevel = input.maxLevel;
    if (input.requiredSkills) job.requiredSkills = input.requiredSkills;
    if (input.openings !== undefined) job.openings = input.openings;
    if (input.status) {
      job.status = input.status;
      job.isOpen = input.status === 'OPEN';
    }

    await job.save();

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_UPDATE_JOB',
      targetType: 'CompanyJob',
      targetId: job._id,
      oldValue,
      newValue: {
        title: job.title,
        description: job.description,
        domain: job.domain,
        minLevel: job.minLevel,
        maxLevel: job.maxLevel,
        requiredSkills: job.requiredSkills,
        openings: job.openings,
        status: job.status,
      },
      reason: input.reason,
    });

    logger.info(`[CompanyService] Admin updated job '${job.title}' (${job._id})`);
    return job;
  }

  /**
   * Admin delete (close) job with mandatory audit logging.
   */
  async adminDeleteJob(
    actorId: string,
    actorRole: AuditActorRole,
    jobId: string,
    reason: string
  ): Promise<ICompanyJobDocument> {
    if (!Types.ObjectId.isValid(jobId)) {
      throw AppError.badRequest('Invalid job ID format');
    }

    const job = await CompanyJobModel.findById(jobId);
    if (!job) {
      throw AppError.notFound(`Job with ID '${jobId}' not found`);
    }

    const oldValue = { status: job.status, isOpen: job.isOpen };
    job.status = 'CLOSED';
    job.isOpen = false;
    await job.save();

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_DELETE_JOB',
      targetType: 'CompanyJob',
      targetId: job._id,
      oldValue,
      newValue: { status: 'CLOSED', isOpen: false },
      reason,
    });

    logger.info(`[CompanyService] Admin closed job '${job.title}' (${job._id})`);
    return job;
  }
}

export const companyService = new CompanyService();
