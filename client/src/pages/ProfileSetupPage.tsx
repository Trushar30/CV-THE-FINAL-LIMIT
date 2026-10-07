import { useState, type ReactElement, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Card, Button, Input } from '../components/ui';
import styles from './ProfileSetup.module.css';

export type CareerDomain = 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';

interface DomainCardOption {
  id: CareerDomain;
  title: string;
  description: string;
  icon: string;
  recommendedSkills: string[];
}

const DOMAINS: readonly DomainCardOption[] = [
  {
    id: 'SOFTWARE_ENGINEERING',
    title: 'Software Engineering',
    description:
      'Design distributed backend systems, microservices, databases, and enterprise REST APIs.',
    icon: '💻',
    recommendedSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'System Design'],
  },
  {
    id: 'CLOUD_ENGINEERING',
    title: 'Cloud Engineering',
    description:
      'Build resilient infrastructure, Kubernetes clusters, high-availability networks, and DevOps CI/CD.',
    icon: '☁️',
    recommendedSkills: ['Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Linux'],
  },
  {
    id: 'AI_ENGINEERING',
    title: 'AI Engineering',
    description:
      'Train, evaluate, and orchestrate LLMs, prompt pipelines, vector embeddings, and autonomous agent loops.',
    icon: '🧠',
    recommendedSkills: ['Python', 'LangChain', 'Vector DBs', 'PyTorch', 'Prompt Engineering'],
  },
];

export function ProfileSetupPage(): ReactElement {
  const { user, setupProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDomain, setSelectedDomain] = useState<CareerDomain>('SOFTWARE_ENGINEERING');
  const [displayName, setDisplayName] = useState<string>(
    user?.displayName && user.displayName !== 'User' ? user.displayName : ''
  );
  const [skills, setSkills] = useState<string[]>(['TypeScript', 'Node.js']);
  const [skillInput, setSkillInput] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [linkedinUrl, setLinkedinUrl] = useState<string>('');
  const [portfolioUrl, setPortfolioUrl] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const activeDomainMeta = DOMAINS.find((d) => d.id === selectedDomain)!;

  const handleAddSkill = (skillToAdd: string): void => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (!skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string): void => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleDomainSelect = (domain: CareerDomain): void => {
    setSelectedDomain(domain);
    const domainMeta = DOMAINS.find((d) => d.id === domain);
    if (domainMeta) {
      // Add first 2 recommended skills automatically if skills list is small
      const newSkills = Array.from(
        new Set([...skills, ...domainMeta.recommendedSkills.slice(0, 2)])
      );
      setSkills(newSkills);
    }
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim()) {
      setErrorMessage('Display Name is required');
      return;
    }

    if (skills.length === 0) {
      setErrorMessage('Please add at least one technical skill');
      return;
    }

    setIsLoading(true);

    const result = await setupProfile({
      displayName: displayName.trim(),
      domain: selectedDomain,
      skills,
      bio: bio.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      portfolioUrl: portfolioUrl.trim() || undefined,
    });

    setIsLoading(false);

    if (result.success) {
      setIsCompleted(true);
      setStep(3);
    } else {
      setErrorMessage(result.error || 'Profile setup failed');
    }
  };

  return (
    <div className={styles.wizardContainer}>
      <div className={styles.wizardHeader}>
        <div className={styles.wizardBadge}>
          <span>🚀</span>
          <span>Candidate Onboarding</span>
        </div>
        <h1 className={styles.wizardTitle}>Profile Setup Wizard</h1>
        <p className={styles.wizardSubtitle}>
          Select your engineering specialization, customize your credentials, and activate your
          virtual job seeker career role.
        </p>
      </div>

      {/* Progress Step Bar */}
      <div className={styles.stepBar}>
        <div
          className={`${styles.stepNode} ${
            step >= 1 ? (step === 1 ? styles.stepNodeActive : styles.stepNodeCompleted) : ''
          }`}
        >
          <div className={styles.stepNumber}>{step > 1 ? '✓' : '1'}</div>
          <span>Domain</span>
        </div>
        <div className={styles.stepConnector} />
        <div
          className={`${styles.stepNode} ${
            step >= 2 ? (step === 2 ? styles.stepNodeActive : styles.stepNodeCompleted) : ''
          }`}
        >
          <div className={styles.stepNumber}>{step > 2 ? '✓' : '2'}</div>
          <span>Skills & Profile</span>
        </div>
        <div className={styles.stepConnector} />
        <div className={`${styles.stepNode} ${step === 3 ? styles.stepNodeActive : ''}`}>
          <div className={styles.stepNumber}>3</div>
          <span>Activation</span>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            background: 'var(--cv-status-danger-bg)',
            border: '1px solid var(--cv-status-danger-border)',
            color: 'var(--cv-status-danger-text)',
            padding: '0.875rem 1rem',
            borderRadius: 'var(--cv-radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Career Domain Selection */}
      {step === 1 && (
        <Card
          title="Step 1: Choose Your Career Domain"
          subtitle="Select your primary engineering specialization"
        >
          <div className={styles.domainGrid}>
            {DOMAINS.map((domain) => {
              const isSelected = selectedDomain === domain.id;
              return (
                <div
                  key={domain.id}
                  className={`${styles.domainCard} ${isSelected ? styles.domainCardSelected : ''}`}
                  onClick={() => handleDomainSelect(domain.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleDomainSelect(domain.id);
                    }
                  }}
                  aria-pressed={isSelected}
                >
                  <div className={styles.domainCheck}>✓</div>
                  <div className={styles.domainIcon}>{domain.icon}</div>
                  <h3 className={styles.domainTitle}>{domain.title}</h3>
                  <p className={styles.domainDescription}>{domain.description}</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    Key Focus: {domain.recommendedSkills.slice(0, 3).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.wizardActions}>
            <div style={{ fontSize: '0.875rem', color: 'var(--cv-text-secondary)' }}>
              Selected: <strong>{activeDomainMeta.title}</strong>
            </div>
            <Button variant="primary" onClick={() => setStep(2)}>
              Continue to Profile Details →
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Skills & Details */}
      {step === 2 && (
        <Card
          title="Step 2: Candidate Credentials"
          subtitle={`Customizing candidate credentials for ${activeDomainMeta.title}`}
        >
          <form onSubmit={handleSubmit}>
            <Input
              label="Display Name"
              placeholder="e.g. Alex Chen"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              helperText="How your name will appear on applications and employee rosters"
            />

            <div className={styles.skillSection}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--cv-text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                Technical Skills <span style={{ color: 'var(--cv-status-danger-text)' }}>*</span>
              </label>

              <div className={styles.skillInputWrapper}>
                <Input
                  placeholder="Type a skill and press Enter..."
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill(skillInput);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddSkill(skillInput)}
                  disabled={!skillInput.trim()}
                >
                  Add Skill
                </Button>
              </div>

              {/* Active Skill Chips */}
              <div className={styles.skillChips}>
                {skills.length === 0 ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--cv-text-muted)' }}>
                    No skills added yet. Add from suggestions below or type your own.
                  </span>
                ) : (
                  skills.map((skill) => (
                    <span key={skill} className={styles.skillChip}>
                      <span>{skill}</span>
                      <button
                        type="button"
                        className={styles.removeSkillBtn}
                        onClick={() => handleRemoveSkill(skill)}
                        aria-label={`Remove skill ${skill}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Suggested Skills for Domain */}
              <div className={styles.suggestedSkills}>
                Suggested for {activeDomainMeta.title}:
                <div style={{ marginTop: '0.25rem' }}>
                  {activeDomainMeta.recommendedSkills.map((rec) => (
                    <button
                      key={rec}
                      type="button"
                      className={styles.suggestedChip}
                      onClick={() => handleAddSkill(rec)}
                    >
                      + {rec}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional Links */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                marginTop: '1rem',
              }}
            >
              <Input
                label="GitHub (Optional)"
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
              <Input
                label="LinkedIn (Optional)"
                placeholder="https://linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
              <Input
                label="Portfolio (Optional)"
                placeholder="https://portfolio.dev"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
              />
            </div>

            <Input
              label="Professional Bio (Optional)"
              placeholder="Brief summary of your technical interests and engineering background..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ marginTop: '1rem' }}
            />

            <div className={styles.wizardActions}>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                ← Back to Domain Selection
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                disabled={!displayName.trim() || skills.length === 0}
              >
                {isLoading ? 'Activating Profile...' : 'Complete Profile Setup →'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Step 3: Success Confirmation */}
      {step === 3 && isCompleted && (
        <Card
          title="Career Role Activated!"
          subtitle="Welcome to the CorpVerse Engineering Ecosystem"
        >
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--cv-text-primary)',
                margin: '0 0 0.5rem 0',
              }}
            >
              Congratulations, {displayName}!
            </h2>
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--cv-text-secondary)',
                maxWidth: 500,
                margin: '0 auto 1.5rem auto',
                lineHeight: 1.5,
              }}
            >
              Your candidate profile has been authenticated and linked to the{' '}
              <strong>{activeDomainMeta.title}</strong> division. Your simulation career status is
              now active as a <strong>Job Seeker</strong>.
            </p>

            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 'var(--cv-radius-md)',
                padding: '1rem',
                maxWidth: 420,
                margin: '0 auto 2rem auto',
                textAlign: 'left',
                fontSize: '0.8125rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                }}
              >
                <span style={{ color: 'var(--cv-text-secondary)' }}>Career Role:</span>
                <span style={{ fontWeight: 600, color: 'var(--cv-brand-primary-500)' }}>
                  JOB_SEEKER
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                }}
              >
                <span style={{ color: 'var(--cv-text-secondary)' }}>Domain:</span>
                <span style={{ fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                  {activeDomainMeta.title}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--cv-text-secondary)' }}>Skills Registered:</span>
                <span style={{ fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                  {skills.length} skills
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/career')}
              style={{ minWidth: 240 }}
            >
              Enter Career Hub Now →
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ProfileSetupPage;
