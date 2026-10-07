import { IEmailService, SendVerificationEmailParams } from './email.interface.js';
import { logger } from '../../utils/logger.js';

export interface RecordedEmail {
  to: string;
  token: string;
  verificationUrl: string;
  sentAt: Date;
}

/**
 * Development & testing email service that logs verification emails to the console
 * and captures them in-memory for testing assertions.
 */
export class ConsoleEmailService implements IEmailService {
  private sentEmails: RecordedEmail[] = [];

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<void> {
    const record: RecordedEmail = {
      to: params.to,
      token: params.token,
      verificationUrl: params.verificationUrl,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);

    logger.info(
      `[EmailService:Console] Verification email dispatched to ${params.to}\n` +
        `  -> Verification Token: ${params.token}\n` +
        `  -> Verification URL: ${params.verificationUrl}`,
      {
        to: params.to,
        verificationUrl: params.verificationUrl,
      }
    );
  }

  getSentEmails(): readonly RecordedEmail[] {
    return this.sentEmails;
  }

  getLastEmail(): RecordedEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clear(): void {
    this.sentEmails = [];
  }
}
