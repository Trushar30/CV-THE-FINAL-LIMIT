import { useState, type ReactElement, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, getPostLoginRedirect } from '../store/AuthContext';
import { Input, Button } from '../components/ui';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ZapIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
} from '../components/ui/Icon';
import styles from './Auth.module.css';

export function LoginPage(): ReactElement {
  const { login, loginStub, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const getDestination = (fallbackUser?: Parameters<typeof getPostLoginRedirect>[0]): string => {
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    if (from?.pathname && from.pathname !== '/login') {
      return `${from.pathname}${from.search || ''}`;
    }
    return getPostLoginRedirect(fallbackUser);
  };

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
      navigate(getDestination(result.user), { replace: true });
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


  return (
    <div className={styles.authPage}>
      {/* Left Form Panel */}
      <div className={styles.formPanel}>
        <div className={styles.formInner}>
          <Link to="/" className={styles.topBrand} aria-label="Return to CorpVerse home">
            <span className={styles.brandMonogram}>C</span>
            <span className={styles.brandName}>CorpVerse</span>
          </Link>

          <div className={styles.headerText}>
            <h1 className={styles.title}>Sign In</h1>
            <p className={styles.subtitle}>
              Authenticate with your simulated corporate credentials
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className={`${styles.alertBox} ${
                isLocked ? styles.alertWarning : styles.alertError
              }`}
            >
              <span className={styles.alertIcon}>
                {isLocked ? (
                  <LockIcon size={16} color="var(--cv-status-warning-text)" />
                ) : (
                  <AlertCircleIcon size={16} color="var(--cv-status-danger-text)" />
                )}
              </span>
              <div style={{ flex: 1 }}>
                <div>{errorMessage}</div>
                {isUnverified && (
                  <div style={{ marginTop: 'var(--cv-space-2)' }}>
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
              role="status"
              aria-live="polite"
              className={`${styles.alertBox} ${styles.alertSuccess}`}
            >
              <span className={styles.alertIcon}>
                <CheckCircle2Icon size={16} color="var(--cv-status-success-text)" />
              </span>
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
              type={showPassword ? 'text' : 'password'}
              label="Master Password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
              rightIcon={
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLoading}
              fullWidth
              style={{ marginTop: 'var(--cv-space-1)' }}
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
            </Button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerSpan}>Quick Demo</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            fullWidth
            onClick={() => {
              loginStub();
              navigate(getDestination(), { replace: true });
            }}
          >
            Sign in as Demo User (Alex Chen)
          </Button>

          <div className={styles.authFooter}>
            Don&apos;t have an account?
            <Link to="/register" className={styles.footerLink}>
              Create an account
            </Link>
          </div>
        </div>
      </div>

      {/* Right Visual Value Panel */}
      <div className={styles.visualPanel}>
        <div className={styles.visualContent}>
          <div className={styles.visualBadge}>
            <ShieldCheckIcon size={14} color="var(--cv-brand-500)" />
            <span>Deterministic Career Platform</span>
          </div>

          <div>
            <h2 className={styles.visualTitle}>From candidate to enterprise founder</h2>
            <p className={styles.visualDesc}>
              Experience an authoritative AI-powered career economy with 8-stage ATS hiring,
              daily engineering sprints, and autonomous bot fleets.
            </p>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewCardHeader}>
              <div className={styles.previewPill}>
                <span className={styles.previewStatusDot} />
                <span>CorpVerse Simulation Kernel</span>
              </div>
              <span style={{ fontSize: 'var(--cv-text-12)', color: 'var(--cv-text-muted)' }}>
                v1.0.0
              </span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Active Engine</span>
              <span className={styles.previewValue}>Deterministic</span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Progression Model</span>
              <span className={styles.previewValue}>L1 Intern → L10 Principal</span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Founder Unlock</span>
              <span className={styles.previewValue}>12,000 EXP</span>
            </div>
          </div>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <ZapIcon size={16} className={styles.featureIcon} />
              <span>Immutable ledgers track every EXP and CorpCoin transaction.</span>
            </div>
            <div className={styles.featureItem}>
              <BriefcaseIcon size={16} className={styles.featureIcon} />
              <span>Three real-world tracks: Software, Cloud, and AI Engineering.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
