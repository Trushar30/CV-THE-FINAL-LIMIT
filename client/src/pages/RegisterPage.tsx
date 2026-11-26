import { useState, type ReactElement, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Input, Button } from '../components/ui';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ZapIcon,
  ShieldCheckIcon,
  BotIcon,
  BriefcaseIcon,
} from '../components/ui/Icon';
import styles from './Auth.module.css';

export function RegisterPage(): ReactElement {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    devVerificationUrl?: string;
  } | null>(null);

  // Password requirements per spec section 2 & auth.schema.ts
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&#^()_+\-=[\]{}|;:,.<>/\\]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Email address is required');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Password must satisfy all security requirements');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const result = await register(email, password);
    setIsLoading(false);

    if (result.success) {
      setSuccessInfo({
        message: result.message,
        devVerificationUrl: result.devVerificationUrl,
      });
    } else {
      setErrorMessage(result.error || 'Registration failed');
    }
  };

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
            <h1 className={styles.title}>Create Account</h1>
            <p className={styles.subtitle}>
              Join the CorpVerse economy and begin your simulated corporate career
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className={`${styles.alertBox} ${styles.alertError}`}
            >
              <span className={styles.alertIcon}>
                <AlertCircleIcon size={16} color="var(--cv-status-danger-text)" />
              </span>
              <div>{errorMessage}</div>
            </div>
          )}

          {successInfo ? (
            <div style={{ display: 'flex', flexFlow: 'column', gap: 'var(--cv-space-4)' }}>
              <div
                role="status"
                aria-live="polite"
                className={`${styles.alertBox} ${styles.alertSuccess}`}
              >
                <span className={styles.alertIcon}>
                  <CheckCircle2Icon size={16} color="var(--cv-status-success-text)" />
                </span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>
                    Account Initiated
                  </strong>
                  <p style={{ margin: 0, fontSize: 'var(--cv-text-13)' }}>
                    {successInfo.message}
                  </p>
                </div>
              </div>

              {successInfo.devVerificationUrl && (
                <div className={styles.devBanner}>
                  <div className={styles.devBannerHeader}>
                    <ZapIcon size={14} color="var(--cv-brand-400)" />
                    <span>Dev Environment Quick Verify</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--cv-text-secondary)' }}>
                    In development mode, verify your account immediately:
                  </p>
                  <a href={successInfo.devVerificationUrl} className={styles.devLink}>
                    Verify Email Address Now →
                  </a>
                </div>
              )}

              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="md" fullWidth>
                  Proceed to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                id="register-email"
                type="email"
                label="Corporate Email"
                placeholder="candidate@corpverse.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />

              <Input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                label="Master Password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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

              {/* Password Requirements Checklist */}
              <div className={styles.passwordRequirements}>
                <span className={styles.reqTitle}>Password Requirements</span>
                <ul className={styles.reqList}>
                  <li
                    className={`${styles.reqItem} ${hasMinLength ? styles.reqItemMet : ''}`}
                  >
                    <span className={styles.reqIndicator}>
                      {hasMinLength && <CheckIcon size={10} color="currentColor" />}
                    </span>
                    <span>At least 8 characters</span>
                  </li>
                  <li
                    className={`${styles.reqItem} ${hasUppercase ? styles.reqItemMet : ''}`}
                  >
                    <span className={styles.reqIndicator}>
                      {hasUppercase && <CheckIcon size={10} color="currentColor" />}
                    </span>
                    <span>One uppercase letter</span>
                  </li>
                  <li
                    className={`${styles.reqItem} ${hasLowercase ? styles.reqItemMet : ''}`}
                  >
                    <span className={styles.reqIndicator}>
                      {hasLowercase && <CheckIcon size={10} color="currentColor" />}
                    </span>
                    <span>One lowercase letter</span>
                  </li>
                  <li className={`${styles.reqItem} ${hasNumber ? styles.reqItemMet : ''}`}>
                    <span className={styles.reqIndicator}>
                      {hasNumber && <CheckIcon size={10} color="currentColor" />}
                    </span>
                    <span>One numeric digit</span>
                  </li>
                  <li
                    className={`${styles.reqItem} ${hasSpecial ? styles.reqItemMet : ''}`}
                  >
                    <span className={styles.reqIndicator}>
                      {hasSpecial && <CheckIcon size={10} color="currentColor" />}
                    </span>
                    <span>One special character</span>
                  </li>
                </ul>
              </div>

              <Input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                label="Confirm Password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isLoading}
                error={
                  confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined
                }
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isLoading}
                disabled={!isPasswordValid || !passwordsMatch}
                fullWidth
                style={{ marginTop: 'var(--cv-space-1)' }}
              >
                {isLoading ? 'Creating Account...' : 'Register Account'}
              </Button>
            </form>
          )}

          <div className={styles.authFooter}>
            Already have an account?
            <Link to="/login" className={styles.footerLink}>
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Right Visual Value Panel */}
      <div className={styles.visualPanel}>
        <div className={styles.visualContent}>
          <div className={styles.visualBadge}>
            <ShieldCheckIcon size={14} color="var(--cv-brand-500)" />
            <span>Candidate Registration</span>
          </div>

          <div>
            <h2 className={styles.visualTitle}>Start at Level 1 Intern</h2>
            <p className={styles.visualDesc}>
              Pass through automated ATS screening, complete multi-stage technical assessments,
              and earn real corporate EXP and CorpCoins on authoritative ledgers.
            </p>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewCardHeader}>
              <div className={styles.previewPill}>
                <span className={styles.previewStatusDot} />
                <span>Simulation Protocol</span>
              </div>
              <span style={{ fontSize: 'var(--cv-text-12)', color: 'var(--cv-text-muted)' }}>
                Argon2id + JWT
              </span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>ATS Screening</span>
              <span className={styles.previewValue}>Resume Parsing + Fit Score</span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Career Domains</span>
              <span className={styles.previewValue}>Software • Cloud • AI</span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Starter CorpCoins</span>
              <span className={styles.previewValue}>1,000 CC at Founder</span>
            </div>
          </div>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <BotIcon size={16} className={styles.featureIcon} />
              <span>Multi-provider AI resilient router (Groq, Gemini, Anthropic).</span>
            </div>
            <div className={styles.featureItem}>
              <BriefcaseIcon size={16} className={styles.featureIcon} />
              <span>Active company roster with transparent team caps and financials.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
