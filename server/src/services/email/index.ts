import { env } from '../../config/env.js';
import { ConsoleEmailService } from './consoleEmail.service.js';
import { IEmailService } from './email.interface.js';
import { SmtpEmailService } from './smtpEmail.service.js';

export * from './email.interface.js';
export * from './consoleEmail.service.js';
export * from './smtpEmail.service.js';

/**
 * Singleton email service selected by configuration
 */
export const emailService: IEmailService =
  env.EMAIL_SERVICE_TYPE === 'smtp' ? new SmtpEmailService() : new ConsoleEmailService();
