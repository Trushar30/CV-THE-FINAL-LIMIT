import { useState, useEffect, type ReactElement } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Button, Input } from '../components/ui';
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
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.authBadge}>
            <span>✉️</span>
            <span>Security Verification</span>
          </div>
          <h1 className={styles.authTitle}>Verify Email</h1>
          <p className={styles.authSubtitle}>
            Activate your CorpVerse credentials to unlock virtual workspace access
          </p>
        </div>

        {isVerifying && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
              Validating security token with CorpVerse Auth Engine...
            </p>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--cv-border-default)',
                borderTopColor: 'var(--cv-brand-primary-500)',
                borderRadius: '50%',
                margin: '0 auto',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}

        {successMessage && !isVerifying && (
          <div>
            <div
              className={`${styles.alertBox} ${styles.alertSuccess}`}
              style={{ marginBottom: '1.5rem' }}
            >
              <span className={styles.alertIcon}>🎉</span>
              <div>
                <strong>Verification Successful!</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem' }}>{successMessage}</p>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/login')}
              style={{ width: '100%' }}
            >
              Sign In to Your Workspace →
            </Button>
          </div>
        )}

        {errorMessage && !isVerifying && (
          <div>
            <div
              className={`${styles.alertBox} ${styles.alertError}`}
              style={{ marginBottom: '1.5rem' }}
            >
              <span className={styles.alertIcon}>❌</span>
              <div>{errorMessage}</div>
            </div>

            {/* Resend Option */}
            <form onSubmit={handleResend} style={{ marginTop: '1.5rem' }}>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--cv-text-secondary)',
                  marginBottom: '0.75rem',
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
                loading={isResending}
                fullWidth
                style={{ marginTop: '0.75rem' }}
              >
                {isResending ? 'Sending...' : 'Request New Verification Link'}
              </Button>
            </form>

            {resendStatus && (
              <div
                className={`${styles.alertBox} ${styles.alertSuccess}`}
                style={{ marginTop: '1rem' }}
              >
                <span className={styles.alertIcon}>✉️</span>
                <div>{resendStatus}</div>
              </div>
            )}
          </div>
        )}

        {!tokenParam && !isVerifying && !successMessage && !errorMessage && (
          <div>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--cv-text-secondary)',
                marginBottom: '1rem',
              }}
            >
              Enter the verification token from your email confirmation:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Input
                placeholder="Paste verification token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={() => executeVerification(tokenInput)}
                disabled={!tokenInput.trim()}
              >
                Verify Token
              </Button>
            </div>
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
  );
}

export default VerifyEmailPage;
