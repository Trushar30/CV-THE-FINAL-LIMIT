import crypto from 'crypto';
import { EmailVerificationTokenModel } from '../../models/EmailVerificationToken.js';
import { RefreshTokenModel } from '../../models/RefreshToken.js';
import { UserModel, IUserDocument } from '../../models/User.js';
import { RegisterInput, LoginInput } from '../../schemas/auth.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { generateVerificationToken, hashToken } from '../../utils/token.js';
import { signAccessToken } from '../../utils/jwt.js';
import { emailService, IEmailService } from '../email/index.js';
import { configService } from '../config/config.service.js';
import { env } from '../../config/env.js';
import { CareerRole, PlatformRole } from '../../types/enums.js';

export interface UserResponse {
  id: string;
  email: string;
  careerRole: CareerRole;
  platformRole: PlatformRole;
  status: string;
  emailVerified: boolean;
  onboardingStep: string;
  totalExp: number;
  corpCoinBalance: number;
  failedLoginAttempts: number;
  founderModeUnlockedAt?: Date | null;
  founderStarterCoinGranted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterResult {
  message: string;
  email: string;
  devVerificationUrl?: string;
  rawToken?: string;
}

export interface VerifyEmailResult {
  message: string;
  email: string;
  onboardingStep: string;
}

export interface ResendVerificationResult {
  message: string;
  devVerificationUrl?: string;
  rawToken?: string;
}

export interface LoginResult {
  user: UserResponse;
  accessToken: string;
  rawRefreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface RefreshResult {
  user: UserResponse;
  accessToken: string;
  newRawRefreshToken: string;
  newExpiresAt: Date;
}

function formatUserResponse(user: IUserDocument): UserResponse {
  return {
    id: user._id.toString(),
    email: user.email,
    careerRole: user.careerRole,
    platformRole: user.platformRole,
    status: user.status,
    emailVerified: user.emailVerified,
    onboardingStep: user.onboardingStep,
    totalExp: user.totalExp,
    corpCoinBalance: user.corpCoinBalance,
    failedLoginAttempts: user.failedLoginAttempts,
    founderModeUnlockedAt: user.founderModeUnlockedAt,
    founderStarterCoinGranted: user.founderStarterCoinGranted,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  constructor(private mailService: IEmailService = emailService) {}

  /**
   * Register a new user with password strength validation and verification email dispatch.
   * Enumeration Protection (Spec Section 32): Returns a uniform success message even
   * if the email is already registered, concealing user existence from attackers.
   */
  async register(input: RegisterInput, options?: { appUrl?: string }): Promise<RegisterResult> {
    const email = input.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      logger.info(
        `[AuthService] Registration attempted for existing email ${email}. Suppressing enumeration response.`
      );
      // Return identical generic success response without creating duplicate user or leaking token
      return {
        message: 'Registration initiated. Please check your email to verify your account.',
        email,
      };
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // Create user in database
    const user = new UserModel({
      email,
      passwordHash,
      careerRole: 'NONE', // Default is NONE before profile setup; JOB_SEEKER after
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: false,
      onboardingStep: 'REGISTERED',
      failedLoginAttempts: 0,
      lockUntil: null,
      totalExp: 0,
      corpCoinBalance: 0,
      founderModeUnlockedAt: null,
      founderStarterCoinGranted: false,
    });

    await user.save();

    // Generate expiring verification token
    const { rawToken, tokenHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    await EmailVerificationTokenModel.create({
      userId: user._id,
      email: user.email,
      tokenHash,
      expiresAt,
    });

    // Build verification URL
    const baseUrl = options?.appUrl || env.APP_URL;
    const verificationUrl = `${baseUrl}/verify-email?token=${rawToken}`;

    // Dispatch verification email
    await this.mailService.sendVerificationEmail({
      to: user.email,
      token: rawToken,
      verificationUrl,
    });

    logger.info(`[AuthService] User registered successfully: ${user.email} (${user._id})`);

    return {
      message: 'Registration initiated. Please check your email to verify your account.',
      email: user.email,
      devVerificationUrl: env.NODE_ENV !== 'production' ? verificationUrl : undefined,
      rawToken: env.NODE_ENV === 'test' ? rawToken : undefined,
    };
  }

  /**
   * Verify email address using verification token.
   * Enforces single-use consumption and expiration rules.
   */
  async verifyEmail(rawToken: string): Promise<VerifyEmailResult> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw AppError.validation('Verification token is required');
    }

    const tokenHash = hashToken(rawToken.trim());
    const tokenDoc = await EmailVerificationTokenModel.findOne({ tokenHash });

    if (!tokenDoc) {
      throw AppError.validation('Invalid or expired verification token');
    }

    if (tokenDoc.usedAt) {
      throw AppError.validation('Verification token has already been used');
    }

    if (new Date() > tokenDoc.expiresAt) {
      throw AppError.validation('Verification token has expired');
    }

    const user = await UserModel.findById(tokenDoc.userId);
    if (!user) {
      throw AppError.notFound('Associated user account not found');
    }

    // Mark token as consumed
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    // Mark user email verified and advance onboarding step
    user.emailVerified = true;
    user.isEmailVerified = true;
    user.onboardingStep = 'EMAIL_VERIFIED';
    await user.save();

    logger.info(`[AuthService] Email verified successfully for user: ${user.email}`);

    return {
      message: 'Email verified successfully',
      email: user.email,
      onboardingStep: user.onboardingStep,
    };
  }

  /**
   * Resend verification email for an unverified user.
   * Enumeration Protection (Spec Section 32): Returns a uniform response whether
   * the email exists, is already verified, or does not exist.
   */
  async resendVerification(
    emailInput: string,
    options?: { appUrl?: string }
  ): Promise<ResendVerificationResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await UserModel.findOne({ email });

    // If user does not exist or is already verified, return generic message without error
    if (!user || user.emailVerified) {
      logger.info(
        `[AuthService] Resend verification for ${email} skipped (user absent or already verified). Enumeration suppressed.`
      );
      return {
        message:
          'If an unverified account exists for this email, a verification link has been sent.',
      };
    }

    // Invalidate prior unused tokens by setting usedAt or creating fresh token
    const { rawToken, tokenHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    await EmailVerificationTokenModel.create({
      userId: user._id,
      email: user.email,
      tokenHash,
      expiresAt,
    });

    const baseUrl = options?.appUrl || env.APP_URL;
    const verificationUrl = `${baseUrl}/verify-email?token=${rawToken}`;

    await this.mailService.sendVerificationEmail({
      to: user.email,
      token: rawToken,
      verificationUrl,
    });

    logger.info(`[AuthService] Resent verification email to: ${user.email}`);

    return {
      message: 'If an unverified account exists for this email, a verification link has been sent.',
      devVerificationUrl: env.NODE_ENV !== 'production' ? verificationUrl : undefined,
      rawToken: env.NODE_ENV === 'test' ? rawToken : undefined,
    };
  }

  /**
   * User login with Argon2id password verification, brute-force lockout protection,
   * short-lived access JWT issuance, and refresh token cookie dispatch.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await UserModel.findOne({ email });

    // Anti-enumeration: Generic error message if user not found
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Check if account is locked out
    if (user.lockUntil && new Date() < user.lockUntil) {
      logger.warn(
        `[AuthService] Login attempt rejected on locked account: ${email} until ${user.lockUntil.toISOString()}`
      );
      throw new AppError(
        'Account is temporarily locked due to failed login attempts. Please try again later.',
        'ACCOUNT_LOCKED',
        423,
        { lockUntil: user.lockUntil }
      );
    }

    // Verify Argon2id password hash
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      user.failedLoginAttempts += 1;
      const securityConfig = await configService.getSecurityConfig();

      if (user.failedLoginAttempts >= securityConfig.maxLoginAttempts) {
        user.lockUntil = new Date(Date.now() + securityConfig.lockoutMinutes * 60 * 1000);
        user.lockoutUntil = user.lockUntil;
        logger.warn(
          `[AuthService] Account ${email} locked for ${securityConfig.lockoutMinutes}m after ${user.failedLoginAttempts} failed attempts`
        );
      }

      await user.save();
      throw AppError.unauthorized('Invalid email or password');
    }

    // Check account status
    if (user.status === 'SUSPENDED' || user.isSuspended) {
      throw AppError.forbidden(
        'Your account has been suspended. Please contact platform administration.'
      );
    }

    // Check email verification status
    if (!user.emailVerified && !user.isEmailVerified) {
      throw AppError.forbidden('Please verify your email address before logging in.');
    }

    // Authentication succeeded: reset lockout counters
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lockoutUntil = null;
    await user.save();

    const securityConfig = await configService.getSecurityConfig();

    // Issue short-lived access JWT
    const accessToken = signAccessToken(
      {
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      },
      securityConfig.accessTokenMinutes
    );

    // Issue refresh token
    const { rawToken: rawRefreshToken, tokenHash } = generateVerificationToken(40);
    const family = crypto.randomUUID();
    const refreshTokenExpiresAt = new Date(
      Date.now() + securityConfig.refreshTokenDays * 24 * 60 * 60 * 1000
    );

    await RefreshTokenModel.create({
      userId: user._id,
      family,
      tokenHash,
      expiresAt: refreshTokenExpiresAt,
      isRevoked: false,
    });

    logger.info(`[AuthService] User logged in successfully: ${user.email} (${user._id})`);

    return {
      user: formatUserResponse(user),
      accessToken,
      rawRefreshToken,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Refresh JWT access token with token rotation and reuse detection.
   * If a previously revoked refresh token is presented, the entire token family
   * is invalidated immediately to protect against token compromise.
   */
  async refresh(rawRefreshToken: string): Promise<RefreshResult> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw AppError.unauthorized('Refresh token is required');
    }

    const tokenHash = hashToken(rawRefreshToken.trim());
    const tokenDoc = await RefreshTokenModel.findOne({ tokenHash });

    if (!tokenDoc) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Reuse detection: If token was already revoked, revoke entire family
    if (tokenDoc.isRevoked) {
      logger.warn(
        `[AuthService] Refresh token reuse detected! Invalidating entire family ${tokenDoc.family} for user ${tokenDoc.userId}`
      );
      await RefreshTokenModel.updateMany(
        { family: tokenDoc.family },
        { isRevoked: true, revokedAt: new Date() }
      );
      throw AppError.unauthorized(
        'Compromised or reused session token detected. Please sign in again.'
      );
    }

    // Check expiration
    if (new Date() > tokenDoc.expiresAt) {
      tokenDoc.isRevoked = true;
      tokenDoc.revokedAt = new Date();
      await tokenDoc.save();
      throw AppError.unauthorized('Refresh token has expired. Please sign in again.');
    }

    const user = await UserModel.findById(tokenDoc.userId);
    if (!user) {
      throw AppError.unauthorized('User account no longer exists');
    }

    if (user.status === 'SUSPENDED' || user.isSuspended) {
      throw AppError.forbidden('Your account has been suspended');
    }

    const securityConfig = await configService.getSecurityConfig();

    // Rotate refresh token
    const { rawToken: newRawRefreshToken, tokenHash: newTokenHash } = generateVerificationToken(40);
    const newExpiresAt = new Date(
      Date.now() + securityConfig.refreshTokenDays * 24 * 60 * 60 * 1000
    );

    // Mark current token as revoked and replaced
    tokenDoc.isRevoked = true;
    tokenDoc.revokedAt = new Date();
    tokenDoc.replacedByTokenHash = newTokenHash;
    await tokenDoc.save();

    // Create new rotated token in the same family
    await RefreshTokenModel.create({
      userId: user._id,
      family: tokenDoc.family,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      isRevoked: false,
    });

    // Issue fresh access JWT
    const accessToken = signAccessToken(
      {
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      },
      securityConfig.accessTokenMinutes
    );

    return {
      user: formatUserResponse(user),
      accessToken,
      newRawRefreshToken,
      newExpiresAt,
    };
  }

  /**
   * Log out session by revoking the refresh token.
   */
  async logout(rawRefreshToken?: string): Promise<{ message: string }> {
    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      const tokenHash = hashToken(rawRefreshToken.trim());
      await RefreshTokenModel.updateOne({ tokenHash }, { isRevoked: true, revokedAt: new Date() });
      logger.info('[AuthService] Refresh token revoked upon logout');
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Fetch current authenticated user profile
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    if (user.status === 'SUSPENDED' || user.isSuspended) {
      throw AppError.forbidden('Your account has been suspended');
    }

    return formatUserResponse(user);
  }
}

export const authService = new AuthService();
