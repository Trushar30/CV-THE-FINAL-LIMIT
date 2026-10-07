import { useState, type ReactElement, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Input, Button } from '../components/ui';
import styles from './Auth.module.css';

export function RegisterPage(): ReactElement {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.authBadge}>
            <span>👤</span>
            <span>Candidate Registration</span>
          </div>
          <h1 className={styles.authTitle}>Create Account</h1>
          <p className={styles.authSubtitle}>
            Join the CorpVerse economy and embark on your virtual career journey
          </p>
        </div>

        {errorMessage && (
          <div
            className={`${styles.alertBox} ${styles.alertError}`}
            style={{ marginBottom: '1.25rem' }}
          >
            <span className={styles.alertIcon}>⚠️</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {successInfo ? (
          <div>
            <div
              className={`${styles.alertBox} ${styles.alertSuccess}`}
              style={{ marginBottom: '1.25rem' }}
            >
              <span className={styles.alertIcon}>✉️</span>
              <div>
                <strong>Account Initiated</strong>
                <p style={{ margin: '0.375rem 0 0 0', fontSize: '0.8125rem' }}>
                  {successInfo.message}
                </p>
              </div>
            </div>

            {successInfo.devVerificationUrl && (
              <div className={styles.devBanner}>
                <div className={styles.devBannerTitle}>
                  <span>🛠️</span>
                  <span>Dev Environment Auto-Link</span>
                </div>
                <p style={{ margin: 0 }}>In development mode, verify your account immediately:</p>
                <a href={successInfo.devVerificationUrl} className={styles.devLink}>
                  Verify Email Address Now →
                </a>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login">
                <Button variant="primary" style={{ width: '100%' }}>
                  Proceed to Sign In
                </Button>
              </Link>
            </div>
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
              type="password"
              label="Master Password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />

            {/* Live Password Requirements Checklist */}
            <div className={styles.passwordRequirements}>
              <div className={styles.requirementTitle}>Password Requirements</div>
              <ul className={styles.requirementList}>
                <li
                  className={`${styles.requirementItem} ${hasMinLength ? styles.requirementMet : ''}`}
                >
                  <span>{hasMinLength ? '✓' : '○'}</span>
                  <span>At least 8 characters</span>
                </li>
                <li
                  className={`${styles.requirementItem} ${hasUppercase ? styles.requirementMet : ''}`}
                >
                  <span>{hasUppercase ? '✓' : '○'}</span>
                  <span>One uppercase letter</span>
                </li>
                <li
                  className={`${styles.requirementItem} ${hasLowercase ? styles.requirementMet : ''}`}
                >
                  <span>{hasLowercase ? '✓' : '○'}</span>
                  <span>One lowercase letter</span>
                </li>
                <li
                  className={`${styles.requirementItem} ${hasNumber ? styles.requirementMet : ''}`}
                >
                  <span>{hasNumber ? '✓' : '○'}</span>
                  <span>One numeric digit</span>
                </li>
                <li
                  className={`${styles.requirementItem} ${hasSpecial ? styles.requirementMet : ''}`}
                >
                  <span>{hasSpecial ? '✓' : '○'}</span>
                  <span>One special character</span>
                </li>
              </ul>
            </div>

            <Input
              id="register-confirm-password"
              type="password"
              label="Confirm Password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
              error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={!isPasswordValid || !passwordsMatch}
              fullWidth
              style={{ marginTop: '0.5rem' }}
            >
              {isLoading ? 'Creating Account...' : 'Register Account'}
            </Button>
          </form>
        )}

        <div className={styles.authFooter}>
          Already registered?
          <Link to="/login" className={styles.footerLink}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
