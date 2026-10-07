import nodemailer, { Transporter } from 'nodemailer';
import { IEmailService, SendVerificationEmailParams } from './email.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

/**
 * Production SMTP email service using nodemailer
 */
export class SmtpEmailService implements IEmailService {
  private transporter: Transporter;
  private from: string;

  constructor(customConfig?: SmtpConfig) {
    const host = customConfig?.host ?? env.SMTP_HOST;
    const port = customConfig?.port ?? env.SMTP_PORT;
    const secure = customConfig?.secure ?? env.SMTP_SECURE ?? false;
    const user = customConfig?.user ?? env.SMTP_USER;
    const pass = customConfig?.pass ?? env.SMTP_PASS;
    this.from = customConfig?.from ?? env.EMAIL_FROM;

    if (!host) {
      logger.warn(
        '[SmtpEmailService] No SMTP_HOST configured. Emails will fail to send in production.'
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<void> {
    const mailOptions = {
      from: this.from,
      to: params.to,
      subject: 'CorpVerse — Verify Your Email Address',
      text: `Welcome to CorpVerse!\n\nPlease verify your email address by clicking the link below or entering your token:\n${params.verificationUrl}\n\nVerification Token: ${params.token}\n\nThis verification link expires in 24 hours. If you did not create a CorpVerse account, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 32px; border-radius: 8px;">
          <h2 style="color: #6366f1; margin-top: 0;">Welcome to CorpVerse</h2>
          <p>Please confirm your email address to complete your registration and begin your career simulation.</p>
          <div style="margin: 24px 0;">
            <a href="${params.verificationUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #38bdf8; font-size: 14px; word-break: break-all;">${params.verificationUrl}</p>
          <p style="color: #94a3b8; font-size: 14px;">Verification Token: <strong style="color: #f8fafc;">${params.token}</strong></p>
          <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">
            This link will expire in 24 hours. If you did not register for CorpVerse, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(
        `[SmtpEmailService] Verification email sent to ${params.to}: messageId=${info.messageId}`
      );
    } catch (err) {
      logger.error(`[SmtpEmailService] Failed to send email to ${params.to}`, { error: err });
      throw err;
    }
  }
}
