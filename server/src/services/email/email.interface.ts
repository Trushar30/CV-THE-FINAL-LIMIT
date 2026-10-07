export interface SendVerificationEmailParams {
  to: string;
  token: string;
  verificationUrl: string;
}

export interface IEmailService {
  /**
   * Send an account verification email containing the verification token and link
   */
  sendVerificationEmail(params: SendVerificationEmailParams): Promise<void>;
}
