import { Types } from 'mongoose';
import { ProfileModel, IProfileDocument } from '../../models/Profile.js';
import { UserModel } from '../../models/User.js';
import { ProfileSetupInput, ProfileUpdateInput } from '../../schemas/profile.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { type CareerDomain } from '../../types/enums.js';

export interface DomainMeta {
  id: CareerDomain;
  title: string;
  description: string;
  icon: string;
  recommendedSkills: string[];
}

export const DOMAIN_METADATA: readonly DomainMeta[] = [
  {
    id: 'SOFTWARE_ENGINEERING',
    title: 'Software Engineering',
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
    title: 'Cloud Engineering',
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
    title: 'AI Engineering',
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
   * Complete the initial profile setup wizard.
   * Creates the profile record, transitions the user's careerRole to 'JOB_SEEKER',
   * and marks onboardingStep as 'PROFILE_COMPLETED'.
   */
  async setupProfile(userId: string, input: ProfileSetupInput): Promise<ProfileResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    // Check if user already configured a profile
    const existingProfile = await ProfileModel.findOne({ userId: user._id });
    if (existingProfile) {
      throw AppError.conflict('Profile has already been configured for this account');
    }

    // Create profile document
    const profile = await ProfileModel.create({
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

    // Authoritative state transition: NONE -> JOB_SEEKER
    user.careerRole = 'JOB_SEEKER';
    user.onboardingStep = 'PROFILE_COMPLETED';
    await user.save();

    logger.info(
      `[ProfileService] Profile successfully created for user ${user.email} (${user._id}), domain: ${profile.domain}, careerRole: JOB_SEEKER`
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
   * Note: domain is immutable after initial selection.
   */
  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<IProfileDocument> {
    const profile = await ProfileModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    if (input.displayName !== undefined) {
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
  getAvailableDomains(): readonly DomainMeta[] {
    return DOMAIN_METADATA;
  }
}

export const profileService = new ProfileService();
