import { Types } from 'mongoose';
import { DomainModel, IDomainDocument } from '../../models/Domain.js';
import { SkillModel, ISkillDocument } from '../../models/Skill.js';
import { auditService } from '../audit/audit.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { type AuditActorRole } from '../../types/enums.js';
import { CreateDomainInput, UpdateDomainInput } from '../../schemas/domain.schema.js';

export const V1_DOMAINS = [
  {
    code: 'SOFTWARE_ENGINEERING',
    name: 'Software Engineering',
    description:
      'Architect robust backend systems, distributed services, and scalable web platforms.',
    isActive: true,
  },
  {
    code: 'CLOUD_ENGINEERING',
    name: 'Cloud Engineering',
    description:
      'Design resilient infrastructure, Kubernetes orchestrations, and high-availability cloud pipelines.',
    isActive: true,
  },
  {
    code: 'AI_ENGINEERING',
    name: 'AI Engineering',
    description:
      'Build generative pipelines, LLM fine-tuning loops, prompt engineering, and vector storage.',
    isActive: true,
  },
] as const;

export const V1_SKILLS = [
  // Software Engineering
  { name: 'TypeScript', domainCode: 'SOFTWARE_ENGINEERING', category: 'Language' },
  { name: 'Node.js', domainCode: 'SOFTWARE_ENGINEERING', category: 'Backend' },
  { name: 'PostgreSQL', domainCode: 'SOFTWARE_ENGINEERING', category: 'Database' },
  { name: 'MongoDB', domainCode: 'SOFTWARE_ENGINEERING', category: 'Database' },
  { name: 'Docker', domainCode: 'SOFTWARE_ENGINEERING', category: 'DevOps' },
  { name: 'REST APIs', domainCode: 'SOFTWARE_ENGINEERING', category: 'Architecture' },
  { name: 'System Design', domainCode: 'SOFTWARE_ENGINEERING', category: 'Architecture' },
  { name: 'GraphQL', domainCode: 'SOFTWARE_ENGINEERING', category: 'API' },
  // Cloud Engineering
  { name: 'Kubernetes', domainCode: 'CLOUD_ENGINEERING', category: 'Orchestration' },
  { name: 'AWS', domainCode: 'CLOUD_ENGINEERING', category: 'Cloud Provider' },
  { name: 'Terraform', domainCode: 'CLOUD_ENGINEERING', category: 'IaC' },
  { name: 'CI/CD', domainCode: 'CLOUD_ENGINEERING', category: 'Pipeline' },
  { name: 'Linux', domainCode: 'CLOUD_ENGINEERING', category: 'OS' },
  { name: 'Observability', domainCode: 'CLOUD_ENGINEERING', category: 'Monitoring' },
  { name: 'Prometheus', domainCode: 'CLOUD_ENGINEERING', category: 'Monitoring' },
  // AI Engineering
  { name: 'Python', domainCode: 'AI_ENGINEERING', category: 'Language' },
  { name: 'PyTorch', domainCode: 'AI_ENGINEERING', category: 'Framework' },
  { name: 'LangChain', domainCode: 'AI_ENGINEERING', category: 'Framework' },
  { name: 'Vector DBs', domainCode: 'AI_ENGINEERING', category: 'Database' },
  { name: 'Prompt Engineering', domainCode: 'AI_ENGINEERING', category: 'Technique' },
  { name: 'FastAPI', domainCode: 'AI_ENGINEERING', category: 'Backend' },
  { name: 'HuggingFace', domainCode: 'AI_ENGINEERING', category: 'Platform' },
] as const;

export class DomainService {
  /**
   * Seed the exactly 3 v1 domains idempotently.
   */
  async seedDefaultDomains(): Promise<void> {
    for (const d of V1_DOMAINS) {
      await DomainModel.findOneAndUpdate(
        { code: d.code },
        {
          $setOnInsert: {
            code: d.code,
            name: d.name,
            description: d.description,
            isActive: d.isActive,
          },
        },
        { upsert: true, new: true }
      );
    }
    logger.info('[DomainService] Successfully verified/seeded default v1 domains');
  }

  /**
   * Seed default skills idempotently.
   */
  async seedDefaultSkills(): Promise<void> {
    for (const s of V1_SKILLS) {
      await SkillModel.findOneAndUpdate(
        { name: s.name },
        {
          $setOnInsert: {
            name: s.name,
            domainCode: s.domainCode,
            category: s.category,
          },
        },
        { upsert: true, new: true }
      );
    }
    logger.info('[DomainService] Successfully verified/seeded default skills');
  }

  /**
   * List all active domains (public/candidate facing).
   */
  async listActiveDomains(): Promise<IDomainDocument[]> {
    return DomainModel.find({ isActive: true }).sort({ code: 1 });
  }

  /**
   * List all domains including inactive (Admin facing).
   */
  async listAllDomains(): Promise<IDomainDocument[]> {
    return DomainModel.find({}).sort({ code: 1 });
  }

  /**
   * Get domain by ObjectId or uppercase code.
   */
  async getDomain(idOrCode: string): Promise<IDomainDocument> {
    const isObjectId = Types.ObjectId.isValid(idOrCode);
    const domain = isObjectId
      ? await DomainModel.findById(idOrCode)
      : await DomainModel.findOne({ code: idOrCode.toUpperCase() });

    if (!domain) {
      throw AppError.notFound(`Domain '${idOrCode}' not found`);
    }
    return domain;
  }

  /**
   * Admin Create Domain with mandatory audit logging.
   */
  async createDomain(
    actorId: string,
    actorRole: AuditActorRole,
    input: CreateDomainInput
  ): Promise<IDomainDocument> {
    const uppercaseCode = input.code.toUpperCase();
    const existing = await DomainModel.findOne({ code: uppercaseCode });
    if (existing) {
      throw AppError.conflict(`Domain with code '${uppercaseCode}' already exists`);
    }

    const domain = await DomainModel.create({
      code: uppercaseCode,
      name: input.name.trim(),
      description: input.description.trim(),
      isActive: true,
    });

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_CREATE_DOMAIN',
      targetType: 'Domain',
      targetId: domain._id,
      oldValue: null,
      newValue: {
        code: domain.code,
        name: domain.name,
        description: domain.description,
        isActive: domain.isActive,
      },
      reason: input.reason,
    });

    logger.info(`[DomainService] Admin created domain ${domain.code} (${domain._id})`);
    return domain;
  }

  /**
   * Admin Update Domain with mandatory audit logging.
   */
  async updateDomain(
    actorId: string,
    actorRole: AuditActorRole,
    idOrCode: string,
    input: UpdateDomainInput
  ): Promise<IDomainDocument> {
    const domain = await this.getDomain(idOrCode);

    const oldValue = {
      name: domain.name,
      description: domain.description,
      isActive: domain.isActive,
    };

    if (input.name !== undefined) {
      domain.name = input.name.trim();
    }
    if (input.description !== undefined) {
      domain.description = input.description.trim();
    }
    if (input.isActive !== undefined) {
      domain.isActive = input.isActive;
    }

    await domain.save();

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_UPDATE_DOMAIN',
      targetType: 'Domain',
      targetId: domain._id,
      oldValue,
      newValue: {
        name: domain.name,
        description: domain.description,
        isActive: domain.isActive,
      },
      reason: input.reason,
    });

    logger.info(`[DomainService] Admin updated domain ${domain.code} (${domain._id})`);
    return domain;
  }

  /**
   * Admin Soft-Delete / Deactivate Domain with mandatory audit logging.
   */
  async deleteDomain(
    actorId: string,
    actorRole: AuditActorRole,
    idOrCode: string,
    reason: string
  ): Promise<IDomainDocument> {
    const domain = await this.getDomain(idOrCode);

    const oldValue = { isActive: domain.isActive };
    domain.isActive = false;
    await domain.save();

    await auditService.record({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: 'ADMIN_DEACTIVATE_DOMAIN',
      targetType: 'Domain',
      targetId: domain._id,
      oldValue,
      newValue: { isActive: false },
      reason,
    });

    logger.info(`[DomainService] Admin deactivated domain ${domain.code} (${domain._id})`);
    return domain;
  }

  /**
   * List skills with optional domain filtering.
   */
  async listSkills(domainCode?: string): Promise<ISkillDocument[]> {
    const filter = domainCode ? { domainCode: domainCode.toUpperCase() } : {};
    return SkillModel.find(filter).sort({ name: 1 });
  }
}

export const domainService = new DomainService();
