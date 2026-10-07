import { useState, type ReactElement, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Input, Button } from '../components/ui';
import styles from './Auth.module.css';

export function LoginPage(): ReactElement {
  const { login, loginStub, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setResendStatus(null);

    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      navigate('/showcase');
    } else {
      setErrorMessage(result.error || 'Invalid email or password');
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!email) return;
    setIsResending(true);
    const result = await resendVerification(email);
    setIsResending(false);
    if (result.success) {
      setResendStatus(result.message || 'Verification email resent if account exists.');
    } else {
      setErrorMessage(result.error || 'Failed to resend verification link');
    }
  };

  const isLocked = errorMessage?.toLowerCase().includes('locked');
  const isUnverified = errorMessage?.toLowerCase().includes('verify');
  const isSuspended = errorMessage?.toLowerCase().includes('suspended');

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.authBadge}>
            <span>⚡</span>
            <span>CorpVerse Core Access</span>
          </div>
          <h1 className={styles.authTitle}>Sign In</h1>
          <p className={styles.authSubtitle}>
            Authenticate with your simulated corporate credentials
          </p>
        </div>

        {errorMessage && (
          <div
            className={`${styles.alertBox} ${
              isLocked ? styles.alertWarning : isSuspended ? styles.alertError : styles.alertError
            }`}
            style={{ marginBottom: '1.25rem' }}
          >
            <span className={styles.alertIcon}>{isLocked ? '🔒' : isSuspended ? '🚫' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <div>{errorMessage}</div>
              {isUnverified && (
                <div style={{ marginTop: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isResending}
                    onClick={handleResend}
                    style={{ padding: 0, textDecoration: 'underline' }}
                  >
                    {isResending ? 'Sending...' : 'Resend verification link'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {resendStatus && (
          <div
            className={`${styles.alertBox} ${styles.alertSuccess}`}
            style={{ marginBottom: '1.25rem' }}
          >
            <span className={styles.alertIcon}>✉️</span>
            <div>{resendStatus}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            id="login-email"
            type="email"
            label="Corporate Email"
            placeholder="engineer@corpverse.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />

          <Input
            id="login-password"
            type="password"
            label="Master Password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            fullWidth
            style={{ marginTop: '0.5rem' }}
          >
            {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
          </Button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerSpan}>Or Quick Demo</span>
        </div>

        <div className={styles.demoActions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              loginStub();
              navigate('/showcase');
            }}
            style={{ width: '100%' }}
          >
            Sign in as Demo User (Alex Chen)
          </Button>
        </div>

        <div className={styles.authFooter}>
          Don&apos;t have an account?
          <Link to="/register" className={styles.footerLink}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
