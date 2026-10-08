import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile/profile.service.js';
import {
  ProfileSetupInput,
  ProfileUpdateInput,
  OnboardingStepInput,
} from '../schemas/profile.schema.js';
import { AppError } from '../utils/errors.js';

export class ProfileController {
  /**
   * POST /api/profile/setup
   * Complete candidate onboarding: creates profile & transitions role to JOB_SEEKER.
   */
  async setupProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = req.body as ProfileSetupInput;
      const result = await profileService.setupProfile(req.user._id.toString(), input);

      res.status(201).json({
        success: true,
        message: 'Profile setup completed successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/profile/step
   * Advance or update onboarding step tracking.
   */
  async updateStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = req.body as OnboardingStepInput;
      const result = await profileService.updateOnboardingStep(req.user._id.toString(), input);

      res.status(200).json({
        success: true,
        message: `Onboarding step '${input.step}' processed successfully`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/profile/complete-onboarding
   * Authoritatively finalize onboarding and set careerRole = JOB_SEEKER.
   */
  async completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const result = await profileService.completeOnboarding(req.user._id.toString());

      res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully. Welcome to CorpVerse as a Job Seeker!',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/profile/me
   * Retrieve current user profile and career progress.
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const result = await profileService.getProfile(req.user._id.toString());

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/profile/me
   * Update editable profile fields.
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = req.body as ProfileUpdateInput;
      const updatedProfile = await profileService.updateProfile(req.user._id.toString(), input);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { profile: updatedProfile },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/profile/domains
   * Public or authenticated retrieval of supported career domains and skill suggestions.
   */
  async getDomains(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domains = await profileService.getAvailableDomains();
      res.status(200).json({
        success: true,
        data: { domains },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const profileController = new ProfileController();
