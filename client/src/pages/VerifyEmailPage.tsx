import { useState, useEffect, type ReactElement } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Button, Input, Spinner } from '../components/ui';
import { MailIcon, CheckCircle2Icon, AlertCircleIcon } from '../components/ui/Icon';
import styles from './Auth.module.css';

export function VerifyEmailPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [tokenInput, setTokenInput] = useState(tokenParam);
  const [isVerifying, setIsVerifying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const executeVerification = async (token: string): Promise<void> => {
    if (!token.trim()) {
      setErrorMessage('Verification token cannot be empty');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await verifyEmail(token.trim());
    setIsVerifying(false);

    if (result.success) {
      setSuccessMessage(result.message || 'Your email address has been successfully verified!');
    } else {
      setErrorMessage(
        result.error || 'Verification failed. The token may be expired or already used.'
      );
    }
  };

  // Auto-verify if token is present in query parameters on mount
  useEffect(() => {
    if (tokenParam) {
      setTokenInput(tokenParam);
      void executeVerification(tokenParam);
    }
  }, [tokenParam]);

  const handleResend = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!resendEmail) return;

    setIsResending(true);
    setResendStatus(null);
    setErrorMessage(null);

    const result = await resendVerification(resendEmail);
    setIsResending(false);

    if (result.success) {
      setResendStatus(result.message || 'Verification link sent if an unverified account exists.');
    } else {
      setErrorMessage(result.error || 'Failed to resend verification link');
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.formPanel} style={{ width: '100%' }}>
        <div className={styles.formInner}>
          <Link to="/" className={styles.topBrand} aria-label="Return to CorpVerse home">
            <span className={styles.brandMonogram}>C</span>
            <span className={styles.brandName}>CorpVerse</span>
          </Link>

          <div className={styles.headerText}>
            <h1 className={styles.title}>Verify Email</h1>
            <p className={styles.subtitle}>
              Activate your simulated credentials to unlock workspace access
            </p>
          </div>

          {isVerifying && (
            <div style={{ textAlign: 'center', padding: 'var(--cv-space-6) 0' }}>
              <p style={{ color: 'var(--cv-text-secondary)', marginBottom: 'var(--cv-space-3)' }}>
                Validating security token with Auth Gateway...
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Spinner size="md" color="primary" label="Validating security token" />
              </div>
            </div>
          )}

          {successMessage && !isVerifying && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
              <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
                <span className={styles.alertIcon}>
                  <CheckCircle2Icon size={16} color="var(--cv-status-success-text)" />
                </span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>
                    Verification Successful!
                  </strong>
                  <p style={{ margin: 0, fontSize: 'var(--cv-text-13)' }}>{successMessage}</p>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                fullWidth
              >
                Sign In to Your Workspace →
              </Button>
            </div>
          )}

          {errorMessage && !isVerifying && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
              <div className={`${styles.alertBox} ${styles.alertError}`}>
                <span className={styles.alertIcon}>
                  <AlertCircleIcon size={16} color="var(--cv-status-danger-text)" />
                </span>
                <div>{errorMessage}</div>
              </div>

              {/* Resend Option */}
              <form onSubmit={handleResend} className={styles.form}>
                <p
                  style={{
                    fontSize: 'var(--cv-text-13)',
                    color: 'var(--cv-text-secondary)',
                    margin: 0,
                  }}
                >
                  Need a new verification link? Enter your email:
                </p>
                <Input
                  type="email"
                  placeholder="your.email@corpverse.dev"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                  disabled={isResending}
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="md"
                  loading={isResending}
                  fullWidth
                >
                  {isResending ? 'Sending...' : 'Request New Verification Link'}
                </Button>
              </form>

              {resendStatus && (
                <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
                  <span className={styles.alertIcon}>
                    <MailIcon size={16} color="var(--cv-status-success-text)" />
                  </span>
                  <div>{resendStatus}</div>
                </div>
              )}
            </div>
          )}

          {!tokenParam && !isVerifying && !successMessage && !errorMessage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
              <p
                style={{
                  fontSize: 'var(--cv-text-13)',
                  color: 'var(--cv-text-secondary)',
                  margin: 0,
                }}
              >
                Enter the verification token from your confirmation email:
              </p>
              <Input
                placeholder="Paste verification token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <Button
                variant="primary"
                size="md"
                onClick={() => executeVerification(tokenInput)}
                disabled={!tokenInput.trim()}
                fullWidth
              >
                Verify Token
              </Button>
            </div>
          )}

          <div className={styles.authFooter}>
            Return to
            <Link to="/login" className={styles.footerLink}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
