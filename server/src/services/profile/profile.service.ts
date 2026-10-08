import { Types } from 'mongoose';
import { ProfileModel, IProfileDocument } from '../../models/Profile.js';
import { UserModel } from '../../models/User.js';
import { DomainModel } from '../../models/Domain.js';
import {
  ProfileSetupInput,
  ProfileUpdateInput,
  OnboardingStepInput,
} from '../../schemas/profile.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { type CareerDomain } from '../../types/enums.js';

export interface DomainMeta {
  id: CareerDomain | string;
  code?: string;
  title: string;
  name?: string;
  description: string;
  icon?: string;
  recommendedSkills?: string[];
}

export const DOMAIN_METADATA: readonly DomainMeta[] = [
  {
    id: 'SOFTWARE_ENGINEERING',
    code: 'SOFTWARE_ENGINEERING',
    title: 'Software Engineering',
    name: 'Software Engineering',
    description:
      'Architect robust backend systems, distributed services, and scalable web platforms.',
    icon: '💻',
    recommendedSkills: [
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'Docker',
      'REST APIs',
      'System Design',
    ],
  },
  {
    id: 'CLOUD_ENGINEERING',
    code: 'CLOUD_ENGINEERING',
    title: 'Cloud Engineering',
    name: 'Cloud Engineering',
    description:
      'Design resilient infrastructure, Kubernetes orchestrations, and high-availability cloud pipelines.',
    icon: '☁️',
    recommendedSkills: [
      'Kubernetes',
      'AWS',
      'Terraform',
      'CI/CD',
      'Docker',
      'Linux',
      'Observability',
    ],
  },
  {
    id: 'AI_ENGINEERING',
    code: 'AI_ENGINEERING',
    title: 'AI Engineering',
    name: 'AI Engineering',
    description:
      'Build generative pipelines, LLM fine-tuning loops, prompt engineering, and vector storage.',
    icon: '🧠',
    recommendedSkills: [
      'Python',
      'LangChain',
      'Vector DBs',
      'PyTorch',
      'Prompt Engineering',
      'FastAPI',
    ],
  },
] as const;

export interface ProfileResponse {
  profile: IProfileDocument;
  user: {
    id: string;
    email: string;
    careerRole: string;
    platformRole: string;
    onboardingStep: string;
    totalExp: number;
    corpCoinBalance: number;
  };
}

export class ProfileService {
  /**
   * Check if a display name is unique case-insensitively across profiles.
   */
  async isDisplayNameAvailable(
    displayName: string,
    excludeUserId?: Types.ObjectId | string
  ): Promise<boolean> {
    const trimmed = displayName.trim();
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query: Record<string, unknown> = {
      displayName: { $regex: new RegExp(`^${escaped}$`, 'i') },
    };
    if (excludeUserId) {
      query.userId = { $ne: new Types.ObjectId(excludeUserId) };
    }
    const existing = await ProfileModel.findOne(query);
    return !existing;
  }

  /**
   * Authoritative single method to complete candidate onboarding.
   * Promotes careerRole to 'JOB_SEEKER' and marks onboardingStep as 'COMPLETE'.
   * Never callable or overridable directly by client request payloads.
   */
  async completeOnboarding(userId: string): Promise<ProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('Your account has been suspended');
    }

    if (!user.emailVerified) {
      throw AppError.forbidden('Please verify your email address before completing onboarding');
    }

    const profile = await ProfileModel.findOne({ userId: user._id });
    if (!profile) {
      throw AppError.notFound('Profile has not been created yet');
    }

    // Strict validation of mandatory fields per Spec 5.1
    if (!profile.displayName || profile.displayName.trim().length < 2) {
      throw AppError.businessRuleViolation(
        'Cannot complete onboarding: valid displayName is mandatory'
      );
    }
    if (!profile.domain) {
      throw AppError.businessRuleViolation(
        'Cannot complete onboarding: career domain is mandatory'
      );
    }
    if (!profile.skills || profile.skills.length === 0) {
      throw AppError.businessRuleViolation(
        'Cannot complete onboarding: at least one skill is mandatory'
      );
    }

    // Authoritative state transition: NONE -> JOB_SEEKER
    user.careerRole = 'JOB_SEEKER';
    user.onboardingStep = 'COMPLETE';
    await user.save();

    logger.info(
      `[ProfileService] Onboarding completed authoritatively for user ${user.email} (${user._id}), careerRole: JOB_SEEKER, step: COMPLETE`
    );

    return {
      profile,
      user: {
        id: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
        onboardingStep: user.onboardingStep,
        totalExp: user.totalExp,
        corpCoinBalance: user.corpCoinBalance,
      },
    };
  }

  /**
   * Complete the initial profile setup wizard via full payload.
   * Creates/updates profile record and invokes authoritative completeOnboarding.
   */
  async setupProfile(userId: string, input: ProfileSetupInput): Promise<ProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('Your account has been suspended');
    }

    // Check if user already completed a profile and has an active career role
    const existingProfile = await ProfileModel.findOne({ userId: user._id });
    if (existingProfile && user.careerRole !== 'NONE') {
      throw AppError.conflict('Profile has already been configured for this account');
    }

    // Case-insensitive display name uniqueness check
    const isAvailable = await this.isDisplayNameAvailable(input.displayName, user._id);
    if (!isAvailable) {
      throw AppError.conflict(`Display name '${input.displayName}' is already taken`);
    }

    let profile = existingProfile;
    if (!profile) {
      profile = await ProfileModel.create({
        userId: user._id,
        displayName: input.displayName.trim(),
        domain: input.domain,
        skills: input.skills.map((s) => s.trim()),
        bio: input.bio?.trim(),
        githubUrl: input.githubUrl?.trim() || undefined,
        linkedinUrl: input.linkedinUrl?.trim() || undefined,
        portfolioUrl: input.portfolioUrl?.trim() || undefined,
        projects: input.projects || [],
        certifications: input.certifications || [],
      });
    } else {
      profile.displayName = input.displayName.trim();
      profile.domain = input.domain;
      profile.skills = input.skills.map((s) => s.trim());
      profile.bio = input.bio?.trim();
      profile.githubUrl = input.githubUrl?.trim() || undefined;
      profile.linkedinUrl = input.linkedinUrl?.trim() || undefined;
      profile.portfolioUrl = input.portfolioUrl?.trim() || undefined;
      profile.projects = input.projects || [];
      profile.certifications = input.certifications || [];
      await profile.save();
    }

    // Transition via single authoritative method
    return this.completeOnboarding(userId);
  }

  /**
   * Advance or update onboarding step tracking.
   * Steps: EMAIL_VERIFIED > NAME > DOMAIN > SKILLS > RESUME > REVIEW > COMPLETE
   */
  async updateOnboardingStep(userId: string, input: OnboardingStepInput): Promise<ProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('Your account has been suspended');
    }

    if (!user.emailVerified) {
      throw AppError.forbidden('Please verify your email address before continuing onboarding');
    }

    let profile = await ProfileModel.findOne({ userId: user._id });

    switch (input.step) {
      case 'NAME': {
        const isAvailable = await this.isDisplayNameAvailable(input.displayName, user._id);
        if (!isAvailable) {
          throw AppError.conflict(`Display name '${input.displayName}' is already taken`);
        }

        if (!profile) {
          profile = await ProfileModel.create({
            userId: user._id,
            displayName: input.displayName.trim(),
            skills: [],
          });
        } else {
          profile.displayName = input.displayName.trim();
          await profile.save();
        }

        user.onboardingStep = 'NAME';
        await user.save();
        break;
      }

      case 'DOMAIN': {
        if (!profile) {
          throw AppError.businessRuleViolation(
            'Please complete the NAME step before choosing a domain'
          );
        }

        // Validate domain against active domains in database
        const domainDoc = await DomainModel.findOne({
          code: input.domain,
          isActive: true,
        });
        if (!domainDoc) {
          throw AppError.validation(`Invalid or inactive career domain: ${input.domain}`);
        }

        profile.domain = input.domain;
        await profile.save();

        user.onboardingStep = 'DOMAIN';
        await user.save();
        break;
      }

      case 'SKILLS': {
        if (!profile) {
          throw AppError.businessRuleViolation(
            'Please complete previous onboarding steps before selecting skills'
          );
        }

        profile.skills = input.skills.map((s) => s.trim());
        await profile.save();

        user.onboardingStep = 'SKILLS';
        await user.save();
        break;
      }

      case 'RESUME': {
        if (!profile) {
          throw AppError.businessRuleViolation(
            'Please complete previous onboarding steps before resume upload'
          );
        }

        if (input.resumeId) {
          profile.resumeId = new Types.ObjectId(input.resumeId);
          await profile.save();
        }

        user.onboardingStep = 'RESUME';
        await user.save();
        break;
      }

      case 'REVIEW': {
        if (!profile) {
          throw AppError.businessRuleViolation(
            'Please complete previous onboarding steps before reviewing'
          );
        }

        if (input.bio !== undefined) profile.bio = input.bio.trim();
        if (input.githubUrl !== undefined) profile.githubUrl = input.githubUrl.trim() || undefined;
        if (input.linkedinUrl !== undefined)
          profile.linkedinUrl = input.linkedinUrl.trim() || undefined;
        if (input.portfolioUrl !== undefined)
          profile.portfolioUrl = input.portfolioUrl.trim() || undefined;
        if (input.projects !== undefined) profile.projects = input.projects;
        if (input.certifications !== undefined) profile.certifications = input.certifications;

        await profile.save();

        user.onboardingStep = 'REVIEW';
        await user.save();
        break;
      }

      case 'COMPLETE': {
        return this.completeOnboarding(userId);
      }
    }

    return {
      profile,
      user: {
        id: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
        onboardingStep: user.onboardingStep,
        totalExp: user.totalExp,
        corpCoinBalance: user.corpCoinBalance,
      },
    };
  }

  /**
   * Retrieve the authenticated user's profile and economic standing.
   */
  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    const profile = await ProfileModel.findOne({ userId: user._id });
    if (!profile) {
      throw AppError.notFound('Profile has not been created yet');
    }

    return {
      profile,
      user: {
        id: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
        onboardingStep: user.onboardingStep,
        totalExp: user.totalExp,
        corpCoinBalance: user.corpCoinBalance,
      },
    };
  }

  /**
   * Update editable profile fields (displayName, skills, bio, links, projects, certifications).
   * Note: careerRole CANNOT be updated through this method (or client request).
   */
  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<IProfileDocument> {
    const profile = await ProfileModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    if (input.displayName !== undefined) {
      const isAvailable = await this.isDisplayNameAvailable(input.displayName, userId);
      if (!isAvailable) {
        throw AppError.conflict(`Display name '${input.displayName}' is already taken`);
      }
      profile.displayName = input.displayName.trim();
    }
    if (input.skills !== undefined) {
      profile.skills = input.skills.map((s) => s.trim());
    }
    if (input.bio !== undefined) {
      profile.bio = input.bio.trim();
    }
    if (input.githubUrl !== undefined) {
      profile.githubUrl = input.githubUrl.trim() || undefined;
    }
    if (input.linkedinUrl !== undefined) {
      profile.linkedinUrl = input.linkedinUrl.trim() || undefined;
    }
    if (input.portfolioUrl !== undefined) {
      profile.portfolioUrl = input.portfolioUrl.trim() || undefined;
    }
    if (input.projects !== undefined) {
      profile.projects = input.projects;
    }
    if (input.certifications !== undefined) {
      profile.certifications = input.certifications;
    }

    await profile.save();
    logger.info(`[ProfileService] Profile updated for user ${userId}`);

    return profile;
  }

  /**
   * List available career domains and metadata.
   */
  async getAvailableDomains(): Promise<DomainMeta[]> {
    const dbDomains = await DomainModel.find({ isActive: true }).sort({ code: 1 });
    if (dbDomains.length > 0) {
      return dbDomains.map((d) => {
        const meta = DOMAIN_METADATA.find((m) => m.id === d.code);
        return {
          id: d.code as CareerDomain,
          code: d.code,
          title: d.name,
          name: d.name,
          description: d.description,
          icon: meta?.icon || '💼',
          recommendedSkills: meta?.recommendedSkills || [],
        };
      });
    }
    return [...DOMAIN_METADATA];
  }
}

export const profileService = new ProfileService();
