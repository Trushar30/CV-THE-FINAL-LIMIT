import {
  useState,
  useEffect,
  useRef,
  type ReactElement,
  type FormEvent,
  type ReactNode,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import {
  Card,
  Button,
  Input,
  ProgressBar,
  LaptopIcon,
  CloudIcon,
  BrainCircuitIcon,
  FounderBadgeIllustration,
} from '../components/ui';
import {
  onboardingApi,
  type CareerDomain,
  type ExtractedResumeData,
  type SkillItem,
} from '../api/onboarding';
import styles from './ProfileSetup.module.css';

export interface DomainCardOption {
  id: CareerDomain;
  title: string;
  description: string;
  icon: ReactNode;
  recommendedSkills: string[];
}

export const CANONICAL_DOMAINS: readonly DomainCardOption[] = [
  {
    id: 'SOFTWARE_ENGINEERING',
    title: 'Software Engineering',
    description:
      'Design distributed backend systems, microservices, databases, and enterprise REST APIs.',
    icon: <LaptopIcon size={26} />,
    recommendedSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'System Design'],
  },
  {
    id: 'CLOUD_ENGINEERING',
    title: 'Cloud Engineering',
    description:
      'Build resilient infrastructure, Kubernetes clusters, high-availability networks, and DevOps CI/CD.',
    icon: <CloudIcon size={26} />,
    recommendedSkills: ['Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Linux'],
  },
  {
    id: 'AI_ENGINEERING',
    title: 'AI Engineering',
    description:
      'Train, evaluate, and orchestrate LLMs, prompt pipelines, vector embeddings, and autonomous agent loops.',
    icon: <BrainCircuitIcon size={26} />,
    recommendedSkills: ['Python', 'LangChain', 'Vector DBs', 'PyTorch', 'Prompt Engineering'],
  },
];

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per PlatformConfig

export function ProfileSetupPage(): ReactElement {
  const { user, fetchCurrentUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Step: 1 (Name) -> 2 (Domain) -> 3 (Skills) -> 4 (Resume) -> 5 (Processing) -> 6 (Review) -> 7 (Complete)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Step 1: Candidate Display Name
  const [displayName, setDisplayName] = useState<string>(
    user?.displayName && user.displayName !== 'User' ? user.displayName : ''
  );

  // Step 2: Domain Selection
  const [selectedDomain, setSelectedDomain] = useState<CareerDomain>('SOFTWARE_ENGINEERING');

  // Step 3: Technical Skills
  const [skills, setSkills] = useState<string[]>(['TypeScript', 'Node.js']);
  const [skillInput, setSkillInput] = useState<string>('');
  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
  const [skillSearch, setSkillSearch] = useState<string>('');

  // Step 4 & 5: Resume & Analysis
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('PENDING');
  const [analysisFailureReason, setAnalysisFailureReason] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<ExtractedResumeData | null>(null);

  // Step 6: Review Optional Fields
  const [bio, setBio] = useState<string>('');
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [linkedinUrl, setLinkedinUrl] = useState<string>('');
  const [portfolioUrl, setPortfolioUrl] = useState<string>('');

  // General Status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Email verification status
  const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
  const [emailBannerMessage, setEmailBannerMessage] = useState<string | null>(null);

  const activeDomainMeta: DomainCardOption =
    CANONICAL_DOMAINS.find((d) => d.id === selectedDomain) ?? CANONICAL_DOMAINS[0]!;

  // Helper to update max step reached
  const advanceToStep = (newStep: 1 | 2 | 3 | 4 | 5 | 6 | 7): void => {
    setStep(newStep);
    setMaxStepReached((prev) => Math.max(prev, newStep));
    setErrorMessage(null);
  };

  // 1. Initial State Restoration from backend profile and user.onboardingStep (runs once on mount)
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    let isMounted = true;

    async function restoreSavedState(): Promise<void> {
      let profileResumeId: string | null = null;
      try {
        const response = await onboardingApi.getProfile();
        if (!isMounted) return;

        if (response && response.profile) {
          const p = response.profile;
          if (p.displayName) setDisplayName(p.displayName);
          if (p.domain) setSelectedDomain(p.domain);
          if (p.skills && p.skills.length > 0) setSkills(p.skills);
          if (p.bio) setBio(p.bio);
          if (p.githubUrl) setGithubUrl(p.githubUrl);
          if (p.linkedinUrl) setLinkedinUrl(p.linkedinUrl);
          if (p.portfolioUrl) setPortfolioUrl(p.portfolioUrl);
          if (p.resumeId) {
            setUploadedResumeId(p.resumeId);
            profileResumeId = p.resumeId;
          }
        }
      } catch {
        // Profile may not exist yet if user is on step 1; ignorable
      }

      // Restore step mapping based on user.onboardingStep
      const savedStep = user?.onboardingStep;
      if (savedStep === 'COMPLETE' || user?.careerRole === 'JOB_SEEKER') {
        setIsCompleted(true);
        setStep(7);
        setMaxStepReached(7);
      } else if (savedStep === 'REVIEW') {
        setStep(6);
        setMaxStepReached(6);
        // Load analysis data for side-by-side review
        try {
          const analysisRes = await onboardingApi.getResumeAnalysis();
          if (isMounted && analysisRes && analysisRes.analysis) {
            setAnalysisData(analysisRes.analysis);
            setAnalysisStatus(analysisRes.status);
          }
        } catch {
          // Ignore if analysis not yet available
        }
      } else if (savedStep === 'RESUME') {
        // Check if analysis is already complete
        try {
          const analysisRes = await onboardingApi.getResumeAnalysis();
          if (analysisRes.status === 'COMPLETED' && analysisRes.analysis) {
            if (isMounted) {
              setAnalysisData(analysisRes.analysis);
              setAnalysisStatus('COMPLETED');
              setStep(6);
              setMaxStepReached(6);
            }
            return;
          }
        } catch {
          // Fall through to resume / processing step
        }
        if (isMounted) {
          setStep(5);
          setMaxStepReached(5);
        }
      } else if (savedStep === 'SKILLS') {
        setStep(4);
        setMaxStepReached(4);
      } else if (savedStep === 'DOMAIN') {
        setStep(3);
        setMaxStepReached(3);
      } else if (savedStep === 'NAME') {
        setStep(2);
        setMaxStepReached(2);
      } else {
        setStep(1);
        setMaxStepReached(1);
      }

      // If user already has a resume linked, attempt pre-loading analysis data
      if (profileResumeId && !analysisData) {
        try {
          const analysisRes = await onboardingApi.getResumeAnalysis();
          if (isMounted && analysisRes && analysisRes.analysis) {
            setAnalysisData(analysisRes.analysis);
            setAnalysisStatus(analysisRes.status);
          }
        } catch {
          // Ignore
        }
      }
    }

    restoreSavedState();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch available skills when selectedDomain changes
  useEffect(() => {
    let isMounted = true;
    async function loadSkills(): Promise<void> {
      try {
        const res = await onboardingApi.getSkills(selectedDomain);
        if (isMounted && res && Array.isArray(res.skills)) {
          setAvailableSkills(res.skills);
        }
      } catch {
        // Fallback to static domain skills if API is quiet
        if (isMounted) {
          const fallback = activeDomainMeta.recommendedSkills.map((name) => ({
            name,
            domainCode: selectedDomain,
          }));
          setAvailableSkills(fallback);
        }
      }
    }
    loadSkills();
    return () => {
      isMounted = false;
    };
  }, [selectedDomain, activeDomainMeta.recommendedSkills]);

  // 3. Polling for Resume Analysis while on Step 5
  useEffect(() => {
    if (step !== 5) return;

    let isMounted = true;
    let timerId: NodeJS.Timeout | null = null;

    async function checkAnalysis(): Promise<void> {
      try {
        const res = await onboardingApi.getResumeAnalysis();
        if (!isMounted) return;

        setAnalysisStatus(res.status);

        if (res.status === 'COMPLETED' && res.analysis) {
          setAnalysisData(res.analysis);
          advanceToStep(6);
          return;
        }

        if (res.status === 'SCANNED_UNREADABLE') {
          setAnalysisFailureReason(
            'The uploaded document contains scanned pages or images without machine-readable text. Automated extraction could not extract structured details.'
          );
          return;
        }

        if (res.status === 'FAILED') {
          setAnalysisFailureReason(
            res.failureReason || 'Analysis could not be completed at this time.'
          );
          return;
        }

        // Status is PENDING, PROCESSING, or WAITING_FOR_PROVIDER: poll again in 2s
        timerId = setTimeout(checkAnalysis, 2000);
      } catch (err) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Error polling resume analysis';
        setAnalysisFailureReason(msg);
      }
    }

    checkAnalysis();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [step]);

  // Email verification resend
  const handleResendEmail = async (): Promise<void> => {
    if (!user?.email) return;
    setIsResendingEmail(true);
    setEmailBannerMessage(null);
    try {
      const res = await onboardingApi.resendVerification(user.email);
      setEmailBannerMessage(
        res.devVerificationUrl
          ? `Verification email simulated. Link: ${res.devVerificationUrl}`
          : res.message || 'Verification link sent to your email.'
      );
    } catch (err) {
      setEmailBannerMessage(
        err instanceof Error ? err.message : 'Failed to resend verification email'
      );
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Step 1 Handlers: Name
  const handleSaveName = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length < 2) {
      setErrorMessage('Display Name must be at least 2 characters long');
      return;
    }
    if (trimmed.length > 50) {
      setErrorMessage('Display Name cannot exceed 50 characters');
      return;
    }

    setIsLoading(true);
    try {
      await onboardingApi.updateStep({ step: 'NAME', displayName: trimmed });
      advanceToStep(2);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save display name');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 Handlers: Domain
  const handleDomainSelect = (domain: CareerDomain): void => {
    setSelectedDomain(domain);
  };

  const handleSaveDomain = async (): Promise<void> => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await onboardingApi.updateStep({ step: 'DOMAIN', domain: selectedDomain });
      // If user hasn't added many skills yet, seed with domain recommended skills
      if (skills.length === 0) {
        setSkills(activeDomainMeta.recommendedSkills.slice(0, 3));
      }
      advanceToStep(3);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select domain');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 Handlers: Skills
  const handleAddSkill = (skillToAdd: string): void => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (trimmed.length > 40) {
      setErrorMessage('Skill name cannot exceed 40 characters');
      return;
    }
    if (skills.includes(trimmed)) {
      setSkillInput('');
      return;
    }
    if (skills.length >= 50) {
      setErrorMessage('Maximum 50 skills allowed');
      return;
    }
    setSkills([...skills, trimmed]);
    setSkillInput('');
    setErrorMessage(null);
  };

  const handleRemoveSkill = (skillToRemove: string): void => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSaveSkills = async (): Promise<void> => {
    setErrorMessage(null);
    if (skills.length === 0) {
      setErrorMessage('Please add at least one technical skill');
      return;
    }
    setIsLoading(true);
    try {
      await onboardingApi.updateStep({ step: 'SKILLS', skills });
      advanceToStep(4);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save skills');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4 Handlers: Resume Upload
  const handleFileValidationAndUpload = async (file: File): Promise<void> => {
    setErrorMessage(null);

    // Validate extension
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      setErrorMessage('Invalid file type: Only PDF (.pdf) and Word (.docx) documents are allowed');
      return;
    }

    // Validate size (10 MB max)
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setErrorMessage('File size exceeds the 10 MB limit');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      setUploadProgress(50);
      const res = await onboardingApi.uploadResume(file);
      setUploadProgress(90);

      setUploadedResumeId(res.resumeId);
      setUploadedFileName(res.filename);
      setUploadedFileSize(res.sizeBytes);

      await onboardingApi.updateStep({ step: 'RESUME', resumeId: res.resumeId });
      setUploadProgress(100);

      // Transition to Step 5 (Processing)
      advanceToStep(5);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Resume upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileValidationAndUpload(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileValidationAndUpload(file);
    }
  };

  // Step 6 Handlers: Complete Onboarding
  const handleFinalSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim() || displayName.trim().length < 2) {
      setErrorMessage('Display Name is required (minimum 2 characters)');
      return;
    }

    if (skills.length === 0) {
      setErrorMessage('Please add at least one technical skill');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Submit review step details (including optional fields)
      await onboardingApi.updateStep({
        step: 'REVIEW',
        bio: bio.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        portfolioUrl: portfolioUrl.trim() || undefined,
      });

      // 2. Authoritatively complete onboarding and set careerRole = JOB_SEEKER
      await onboardingApi.completeOnboarding();

      // 3. Refresh user session
      try {
        await fetchCurrentUser();
      } catch {
        // Fallback if session refresh endpoint is quiet
      }

      setIsCompleted(true);
      advanceToStep(7);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Profile completion failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.wizardContainer}>
      {/* Wizard Header */}
      <div className={styles.wizardHeader}>
        <div className={styles.wizardBadge}>
          <span>🚀</span>
          <span>Candidate Onboarding</span>
        </div>
        <h1 className={styles.wizardTitle}>Profile Setup Wizard</h1>
        <p className={styles.wizardSubtitle}>
          Select your engineering specialization, customize your credentials, upload your resume for
          AI verification, and activate your virtual Job Seeker career role.
        </p>
      </div>

      {/* Unverified Email Warning Banner */}
      {user && user.emailVerified === false && (
        <div className={styles.emailBanner} role="alert">
          <div className={styles.emailBannerContent}>
            <span>⚠️</span>
            <div>
              <strong>Email Verification Required:</strong> Please verify your email (
              {user.email || 'account'}) before completing onboarding.
              {emailBannerMessage && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', fontWeight: 500 }}>
                  {emailBannerMessage}
                </div>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResendEmail}
            loading={isResendingEmail}
          >
            Resend Verification Email
          </Button>
        </div>
      )}

      {/* Step Navigation Bar */}
      <div className={styles.stepBar} role="navigation" aria-label="Onboarding Progress">
        {[
          { num: 1, label: 'Name' },
          { num: 2, label: 'Domain' },
          { num: 3, label: 'Skills' },
          { num: 4, label: 'Resume' },
          { num: 5, label: 'Analysis' },
          { num: 6, label: 'Review' },
        ].map((item, idx, arr) => {
          const isNodeActive = step === item.num;
          const isNodeCompleted = step > item.num;
          const isNodeDisabled = item.num > maxStepReached;

          return (
            <div key={item.num} style={{ display: 'contents' }}>
              <div
                className={`
                  ${styles.stepNode}
                  ${isNodeActive ? styles.stepNodeActive : ''}
                  ${isNodeCompleted ? styles.stepNodeCompleted : ''}
                  ${isNodeDisabled ? styles.stepNodeDisabled : ''}
                `}
                onClick={() => {
                  if (!isNodeDisabled && item.num !== step) {
                    setStep(item.num as 1 | 2 | 3 | 4 | 5 | 6);
                  }
                }}
                role="button"
                tabIndex={isNodeDisabled ? -1 : 0}
                aria-current={isNodeActive ? 'step' : undefined}
                aria-disabled={isNodeDisabled}
              >
                <div className={styles.stepNumber}>{isNodeCompleted ? '✓' : item.num}</div>
                <span>{item.label}</span>
              </div>
              {idx < arr.length - 1 && <div className={styles.stepConnector} />}
            </div>
          );
        })}
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className={`${styles.alertBox} ${styles.alertDanger}`} role="alert">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Candidate Display Name */}
      {step === 1 && (
        <Card
          title="Step 1: Candidate Display Name"
          subtitle="Choose how your name will appear on job applications and employee rosters"
        >
          <form onSubmit={handleSaveName}>
            <div className={styles.formGroup}>
              <Input
                label="Display Name"
                placeholder="e.g. Alex Chen"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                helperText="Must be 2–50 characters long and unique across all candidates."
              />
            </div>

            <div className={styles.wizardActions}>
              <div style={{ fontSize: '0.875rem', color: 'var(--cv-text-muted)' }}>
                Step 1 of 6 • Mandatory Field
              </div>
              <div className={styles.rightActions}>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isLoading}
                  disabled={!displayName.trim() || displayName.trim().length < 2}
                >
                  Continue to Domain Selection →
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 2: Career Domain Selection */}
      {step === 2 && (
        <Card
          title="Step 2: Choose Your Career Domain"
          subtitle="Select your primary engineering track from the 3 canonical simulation tracks"
        >
          <div className={styles.domainGrid}>
            {CANONICAL_DOMAINS.map((domain) => {
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
                  <div className={styles.domainIconWrap}>{domain.icon}</div>
                  <h3 className={styles.domainTitle}>{domain.title}</h3>
                  <p className={styles.domainDescription}>{domain.description}</p>
                  <div className={styles.domainSkillPreview}>
                    {domain.recommendedSkills.slice(0, 3).map((s) => (
                      <span key={s} className={styles.domainSkillChip}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.wizardActions}>
            <Button type="button" variant="outline" onClick={() => advanceToStep(1)}>
              ← Back to Name
            </Button>
            <div className={styles.rightActions}>
              <div style={{ fontSize: '0.875rem', color: 'var(--cv-text-secondary)' }}>
                Selected: <strong>{activeDomainMeta.title}</strong>
              </div>
              <Button
                type="button"
                variant="primary"
                loading={isLoading}
                onClick={handleSaveDomain}
              >
                Continue to Skills →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 3: Technical Skills */}
      {step === 3 && (
        <Card
          title="Step 3: Technical Competencies"
          subtitle={`Register verified technical skills for ${activeDomainMeta.title}`}
        >
          <div className={styles.skillsContainer}>
            {/* Active Selected Skills Chips */}
            <div className={styles.selectedSkillsSection}>
              <div className={styles.formLabel}>
                <span>
                  Selected Skills ({skills.length}){' '}
                  <span style={{ color: 'var(--cv-status-danger-text)' }}>*</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                  At least 1 required
                </span>
              </div>

              <div className={styles.skillsChipContainer}>
                {skills.length === 0 ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--cv-text-muted)' }}>
                    No skills added yet. Select from suggestions below or enter custom skills.
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
            </div>

            {/* Custom Skill Input & Search */}
            <div className={styles.searchBarRow}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Type a skill and press Enter (or click Add)..."
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill(skillInput);
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddSkill(skillInput)}
                disabled={!skillInput.trim()}
              >
                Add Skill
              </Button>
            </div>

            {/* Filter Domain Catalog */}
            <div style={{ marginTop: '0.5rem' }}>
              <Input
                placeholder="Search catalog skills for this domain..."
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
              />
            </div>

            {/* Catalog & Suggested Skills */}
            <div className={styles.suggestedSkillsSection}>
              <div className={styles.suggestedHeading}>
                Suggested Skills for {activeDomainMeta.title}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {(availableSkills.length > 0
                  ? availableSkills.map((s) => s.name)
                  : activeDomainMeta.recommendedSkills
                )
                  .filter((name) =>
                    skillSearch ? name.toLowerCase().includes(skillSearch.toLowerCase()) : true
                  )
                  .filter((name) => !skills.includes(name))
                  .slice(0, 15)
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={styles.suggestedSkillChip}
                      onClick={() => handleAddSkill(name)}
                    >
                      + {name}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <div className={styles.wizardActions}>
            <Button type="button" variant="outline" onClick={() => advanceToStep(2)}>
              ← Back to Domain Selection
            </Button>
            <div className={styles.rightActions}>
              <Button
                type="button"
                variant="primary"
                loading={isLoading}
                disabled={skills.length === 0}
                onClick={handleSaveSkills}
              >
                Continue to Resume Upload →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 4: Resume Upload */}
      {step === 4 && (
        <Card
          title="Step 4: Resume Upload"
          subtitle="Upload your resume (PDF or DOCX, max 10MB) for GridFS storage and AI parsing"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className={styles.dropIconWrap}>📄</div>
            <h3 className={styles.dropTitle}>Drag & Drop Resume Here</h3>
            <p className={styles.dropSubtitle}>
              or click to browse from your device. PDF or Word (.docx) files only, up to 10 MB.
            </p>
            <Button type="button" variant="outline" size="sm" disabled={isUploading}>
              Browse Files
            </Button>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div style={{ marginTop: '1.25rem' }}>
              <ProgressBar
                value={uploadProgress}
                max={100}
                label="Uploading and streaming into GridFS..."
                showPercentage
                animated
              />
            </div>
          )}

          {/* Previously Uploaded File Card */}
          {uploadedResumeId && !isUploading && (
            <div className={styles.filePreviewCard}>
              <div className={styles.fileMeta}>
                <span style={{ fontSize: '1.5rem' }}>📎</span>
                <div>
                  <div className={styles.fileName}>
                    {uploadedFileName || 'Resume uploaded successfully'}
                  </div>
                  <div className={styles.fileSize}>
                    {uploadedFileSize
                      ? `${Math.round(uploadedFileSize / 1024)} KB`
                      : 'GridFS Verified'}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Upload Different File
              </Button>
            </div>
          )}

          <div className={styles.wizardActions}>
            <Button type="button" variant="outline" onClick={() => advanceToStep(3)}>
              ← Back to Skills
            </Button>
            <div className={styles.rightActions}>
              {uploadedResumeId && (
                <Button type="button" variant="primary" onClick={() => advanceToStep(5)}>
                  Proceed to Verification →
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* STEP 5: Resume Processing & Polling */}
      {step === 5 && (
        <Card
          title="Step 5: Resume Ingestion & AI Verification"
          subtitle="CorpVerse AI Gateway is extracting text and classifying technical qualifications"
        >
          <div className={styles.processingCard}>
            {analysisFailureReason ? (
              <div
                className={`${styles.alertBox} ${
                  analysisStatus === 'SCANNED_UNREADABLE' ? styles.alertWarning : styles.alertDanger
                }`}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <span>⚠️</span>
                <div>
                  <strong>
                    {analysisStatus === 'SCANNED_UNREADABLE'
                      ? 'Scanned Document Notice:'
                      : 'Extraction Notice:'}
                  </strong>{' '}
                  {analysisFailureReason}
                </div>
              </div>
            ) : (
              <>
                <div className={styles.spinnerPulsar} />
                <h3 className={styles.processingTitle}>
                  {analysisStatus === 'WAITING_FOR_PROVIDER'
                    ? 'Queued for AI Provider...'
                    : 'Analyzing Technical Qualifications...'}
                </h3>
                <p className={styles.processingText}>
                  {analysisStatus === 'WAITING_FOR_PROVIDER'
                    ? 'All external AI providers are currently experiencing high load. Your resume is safely queued and will process as soon as a provider becomes available.'
                    : 'Extracting candidate details, verified skills, educational background, and corporate experience without hallucination.'}
                </p>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button type="button" variant="outline" onClick={() => advanceToStep(4)}>
                Upload New Resume
              </Button>
              <Button type="button" variant="primary" onClick={() => advanceToStep(6)}>
                Continue to Final Review →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 6: Final Review Screen (Side-by-Side Comparison) */}
      {step === 6 && (
        <Card
          title="Step 6: Profile & Resume Verification Review"
          subtitle="Verify your candidate profile details alongside the AI-extracted resume records"
        >
          <form onSubmit={handleFinalSubmit}>
            <div className={styles.reviewGrid}>
              {/* Left Column: Candidate Profile Inputs */}
              <div className={styles.reviewColumn}>
                <div className={styles.columnHeader}>
                  <h3 className={styles.columnTitle}>Candidate Profile Data</h3>
                  <span className={styles.optionalTag}>Candidate Input</span>
                </div>

                <div className={styles.reviewItem}>
                  <span className={styles.reviewItemLabel}>Display Name</span>
                  <span className={styles.reviewItemValue}>{displayName}</span>
                </div>

                <div className={styles.reviewItem}>
                  <span className={styles.reviewItemLabel}>Career Domain</span>
                  <span className={styles.reviewItemValue}>{activeDomainMeta.title}</span>
                </div>

                <div className={styles.reviewItem}>
                  <span className={styles.reviewItemLabel}>
                    Registered Skills ({skills.length})
                  </span>
                  <div className={styles.skillsChipContainer} style={{ marginTop: '0.25rem' }}>
                    {skills.map((s) => (
                      <span key={s} className={styles.skillChip}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Optional Bio */}
                <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                  <Input
                    label="Professional Bio"
                    placeholder="Brief background and career focus..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    helperText="Optional • Summarize your technical journey"
                  />
                </div>

                {/* Optional Social / Portfolio Links */}
                <div className={styles.formGroup}>
                  <Input
                    label="GitHub Profile"
                    placeholder="https://github.com/username"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    helperText="Optional"
                  />
                </div>

                <div className={styles.formGroup}>
                  <Input
                    label="LinkedIn Profile"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    helperText="Optional"
                  />
                </div>

                <div className={styles.formGroup}>
                  <Input
                    label="Portfolio Website"
                    placeholder="https://portfolio.dev"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    helperText="Optional"
                  />
                </div>
              </div>

              {/* Right Column: AI Extracted Resume Data */}
              <div className={styles.reviewColumn}>
                <div className={styles.columnHeader}>
                  <h3 className={styles.columnTitle}>Extracted Resume Data</h3>
                  <span className={styles.optionalTag}>AI Gateway Verified</span>
                </div>

                {analysisData ? (
                  <>
                    <div className={styles.reviewItem}>
                      <span className={styles.reviewItemLabel}>Extracted Name</span>
                      <span className={styles.reviewItemValue}>
                        {analysisData.name || 'Not detected'}
                      </span>
                    </div>

                    <div className={styles.reviewItem}>
                      <span className={styles.reviewItemLabel}>Contact Info</span>
                      <span className={styles.reviewItemValue}>
                        {[
                          analysisData.contact?.email,
                          analysisData.contact?.phone,
                          analysisData.contact?.location,
                        ]
                          .filter(Boolean)
                          .join(' • ') || 'None found'}
                      </span>
                    </div>

                    <div className={styles.reviewItem}>
                      <span className={styles.reviewItemLabel}>Domain Classification</span>
                      <span className={styles.reviewItemValue}>
                        {analysisData.domainClassification} ({analysisData.yearsOfExperience} yrs
                        exp)
                      </span>
                    </div>

                    <div className={styles.reviewItem}>
                      <span className={styles.reviewItemLabel}>Extracted Skills</span>
                      <div className={styles.skillsChipContainer} style={{ marginTop: '0.25rem' }}>
                        {analysisData.skills && analysisData.skills.length > 0 ? (
                          analysisData.skills.map((s) => (
                            <span key={s} className={styles.skillChip}>
                              {s}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                            No specific skills parsed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Education */}
                    {analysisData.education && analysisData.education.length > 0 && (
                      <div className={styles.reviewItem}>
                        <span className={styles.reviewItemLabel}>Education History</span>
                        <div className={styles.entityList}>
                          {analysisData.education.map((edu, idx) => (
                            <div key={idx} className={styles.entityCard}>
                              <div className={styles.entityTitle}>{edu.institution}</div>
                              <div className={styles.entitySubtitle}>
                                {[edu.degree, edu.fieldOfStudy, edu.graduationYear]
                                  .filter(Boolean)
                                  .join(' — ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Work Experience */}
                    {analysisData.workHistory && analysisData.workHistory.length > 0 && (
                      <div className={styles.reviewItem}>
                        <span className={styles.reviewItemLabel}>Work Experience</span>
                        <div className={styles.entityList}>
                          {analysisData.workHistory.map((work, idx) => (
                            <div key={idx} className={styles.entityCard}>
                              <div className={styles.entityTitle}>
                                {work.role} @ {work.company}
                              </div>
                              <div className={styles.entitySubtitle}>{work.duration || ''}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`${styles.alertBox} ${styles.alertInfo}`}>
                    <span>ℹ️</span>
                    <div>
                      Automated extraction results are not available for this resume. Your candidate
                      inputs on the left will serve as your primary verified profile.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.wizardActions}>
              <Button type="button" variant="outline" onClick={() => advanceToStep(4)}>
                ← Back to Resume
              </Button>
              <div className={styles.rightActions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isLoading}
                  disabled={!displayName.trim() || skills.length === 0}
                >
                  Create Profile & Activate Role →
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 7: Activation Celebratory View */}
      {step === 7 && isCompleted && (
        <Card
          title="Career Role Activated!"
          subtitle="Welcome to the CorpVerse Engineering Ecosystem"
        >
          <div className={styles.activationSuccess}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <FounderBadgeIllustration size={80} className="cv-float" />
            </div>
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
              now officially active as a <strong>Job Seeker</strong>.
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
