import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { Button } from '../components/ui/Button/Button';
import { GradientASCII } from '../components/ui';
import {
  RocketIcon,
  BriefcaseIcon,
  BuildingIcon,
  TrophyIcon,
  ZapIcon,
  BotIcon,
  ShieldCheckIcon,
  LaptopIcon,
  CloudIcon,
  BrainCircuitIcon,
} from '../components/ui/Icon';
import styles from './LandingPage.module.css';

type DemoTab = 'hiring' | 'sprint' | 'founder';

export function LandingPage(): ReactElement {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<DemoTab>('hiring');

  const getDashboardDestination = (): { path: string; label: string } => {
    if (!user) return { path: '/career', label: 'Open Career Hub' };
    if (user.platformRole === 'ADMIN') return { path: '/admin', label: 'Open Admin Console' };
    if (user.platformRole === 'AI_MANAGER') return { path: '/ai-ops', label: 'Open AI Operations' };
    if (user.careerRole === 'EMPLOYEE') return { path: '/workplace', label: 'Open Workplace Dashboard' };
    if (user.careerRole === 'FOUNDER') return { path: '/founder', label: 'Open Command HQ' };
    if (user.careerRole === 'NONE') return { path: '/profile/setup', label: 'Complete Profile Setup' };
    return { path: '/career', label: 'Open Career Hub' };
  };

  const primaryCta = getDashboardDestination();

  return (
    <div className={styles.landingContainer}>
      {/* Dynamic WebGL ASCII Simulation Field */}
      <div className={styles.asciiBackground}>
        <GradientASCII
          colors={
            theme === 'light'
              ? ['#ffffff', '#f0f4ff', '#e0e7ff', '#c7d2fe', '#818cf8', '#6366f1']
              : ['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8']
          }
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={18}
          density={theme === 'light' ? 0.72 : 0.8}
          gradientOpacity={theme === 'light' ? 0.35 : 0.9}
          glyphOpacity={theme === 'light' ? 0.65 : 0.85}
          glow={theme === 'light' ? 0.12 : 0.2}
          lightMode={theme === 'light'}
        />
        <div className={styles.asciiOverlay} />
      </div>

      <div className={styles.gridBackground} aria-hidden="true" />

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroBadge}>
          <span className={styles.statusDot} />
          <span>
            {user
              ? `${user.displayName || user.email} · Level ${user.level} ${user.careerRole}`
              : 'Deterministic Corporate Simulation Kernel v1.0'}
          </span>
        </div>

        <h1 className={styles.heroTitle}>
          Experience the Corporate Ladder Before Stepping Into It
        </h1>

        <p className={styles.heroSubtitle}>
          A deterministic, AI-orchestrated career simulation. Master 8-stage ATS screening, execute
          daily sprint tasks on immutable ledgers, and unlock Founder Mode to operate an autonomous
          tech company.
        </p>

        <div className={styles.heroActions}>
          <Link to={primaryCta.path}>
            <Button
              variant="primary"
              size="md"
              leftIcon={<RocketIcon size={16} />}
            >
              Open Career Hub
            </Button>
          </Link>
          <Link to="/jobs">
            <Button
              variant="outline"
              size="md"
              leftIcon={<BriefcaseIcon size={16} />}
            >
              Explore Job Openings
            </Button>
          </Link>
          <Link to="/companies">
            <Button
              variant="ghost"
              size="md"
              leftIcon={<BuildingIcon size={16} />}
            >
              Enterprise Directory
            </Button>
          </Link>
        </div>
      </section>

      {/* Interactive Simulation Kernel Preview */}
      <div className={styles.kernelPreview}>
        <div className={styles.kernelFrame}>
          <div className={styles.kernelTopBar}>
            <div className={styles.windowControls}>
              <span className={styles.windowDot} />
              <span className={styles.windowDot} />
              <span className={styles.windowDot} />
            </div>
            <span className={styles.kernelPath}>sim://corpverse.core/runtime-engine</span>
            <div className={styles.kernelStatusPill}>
              <span className={styles.statusDot} />
              <span>KERNEL_ACTIVE</span>
            </div>
          </div>

          <div className={styles.kernelBody}>
            {/* Stage Selector Tabs */}
            <div className={styles.kernelTabs}>
              <button
                type="button"
                className={`${styles.kernelTabBtn} ${activeTab === 'hiring' ? styles.kernelTabBtnActive : ''}`}
                onClick={() => setActiveTab('hiring')}
              >
                <span className={styles.tabStepNumber}>01 HIRING</span>
                <span className={styles.tabStepLabel}>8-Stage ATS Pipeline</span>
              </button>
              <button
                type="button"
                className={`${styles.kernelTabBtn} ${activeTab === 'sprint' ? styles.kernelTabBtnActive : ''}`}
                onClick={() => setActiveTab('sprint')}
              >
                <span className={styles.tabStepNumber}>02 WORKPLACE</span>
                <span className={styles.tabStepLabel}>Daily Sprint & Review</span>
              </button>
              <button
                type="button"
                className={`${styles.kernelTabBtn} ${activeTab === 'founder' ? styles.kernelTabBtnActive : ''}`}
                onClick={() => setActiveTab('founder')}
              >
                <span className={styles.tabStepNumber}>03 FOUNDER</span>
                <span className={styles.tabStepLabel}>Autonomous Bot Fleet</span>
              </button>
            </div>

            {/* Interactive Viewport */}
            <div className={styles.kernelViewport}>
              {activeTab === 'hiring' && (
                <>
                  <div className={styles.viewportHeader}>
                    <div className={styles.viewportTitle}>
                      <ShieldCheckIcon size={16} color="var(--cv-brand-500)" />
                      <span>Stage 04: Technical Architecture Interview</span>
                    </div>
                    <span style={{ fontSize: 'var(--cv-text-12)', color: 'var(--cv-text-muted)' }}>
                      Application ID: app_8941f • Match: 94%
                    </span>
                  </div>

                  <div className={styles.viewportGrid}>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>ATS Parsed Score</span>
                      <span className={styles.statCardValue}>94 / 100</span>
                    </div>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Active Round</span>
                      <span className={styles.statCardValue}>Question 2 of 3</span>
                    </div>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Salary Band (L4)</span>
                      <span className={styles.statCardValue}>$95k - $125k</span>
                    </div>
                  </div>

                  <div className={styles.transcriptBox}>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker}>AI Bot</span>
                      <span className={styles.transcriptText}>
                        How would you prevent duplicate writes in a distributed queue when network
                        timeouts occur between the client and payment gateway?
                      </span>
                    </div>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker} style={{ color: 'var(--cv-text-primary)' }}>
                        Candidate
                      </span>
                      <span className={styles.transcriptText}>
                        I implement an idempotent request key generated by the client, persisted in a
                        Redis transactional deduplication table with a 24-hour TTL, ensuring only a
                        single execution occurs.
                      </span>
                    </div>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker} style={{ color: 'var(--cv-status-success-text)' }}>
                        Evaluator
                      </span>
                      <span className={styles.transcriptText}>
                        Score: 92/100 • Evaluated on distributed idempotency principles. Recommendation: Advance to Final Review.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'sprint' && (
                <>
                  <div className={styles.viewportHeader}>
                    <div className={styles.viewportTitle}>
                      <ZapIcon size={16} color="var(--cv-brand-500)" />
                      <span>Sprint Task: Multi-Tenant Database Sharding</span>
                    </div>
                    <span style={{ fontSize: 'var(--cv-text-12)', color: 'var(--cv-text-muted)' }}>
                      Difficulty: HARD • Clamped Max: 100 EXP
                    </span>
                  </div>

                  <div className={styles.viewportGrid}>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Automated Test Suite</span>
                      <span className={styles.statCardValue} style={{ color: 'var(--cv-status-success-text)' }}>
                        14 / 14 Passed
                      </span>
                    </div>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Evaluator Score</span>
                      <span className={styles.statCardValue}>88 / 100 (Good)</span>
                    </div>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Awarded EXP</span>
                      <span className={styles.statCardValue}>+88 EXP</span>
                    </div>
                  </div>

                  <div className={styles.transcriptBox}>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker}>Ledger</span>
                      <span className={styles.transcriptText}>
                        Immutable double-entry EXP transaction written to ledger collection: tx_991823a • Previous: 2,450 EXP • New: 2,538 EXP (Level 4 Associate).
                      </span>
                    </div>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker} style={{ color: 'var(--cv-text-primary)' }}>
                        Code Quality
                      </span>
                      <span className={styles.transcriptText}>
                        Consistent partition key hashing algorithm applied. Connection pooling handles scale without socket exhaustion.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'founder' && (
                <>
                  <div className={styles.viewportHeader}>
                    <div className={styles.viewportTitle}>
                      <BotIcon size={16} color="var(--cv-brand-500)" />
                      <span>Executive Command HQ: Nexus Technologies Inc.</span>
                    </div>
                    <span style={{ fontSize: 'var(--cv-text-12)', color: 'var(--cv-text-muted)' }}>
                      Founder Level: 9 • Status: SOLVENT
                    </span>
                  </div>

                  <div className={styles.viewportGrid}>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Autonomous Bot Fleet</span>
                      <span className={styles.statCardValue}>3 Active Bots</span>
                    </div>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>CorpCoin Treasury</span>
                      <span className={styles.statCardValue}>1,850 CC</span>
                    </div>
                    <div className={styles.viewportStatCard}>
                      <span className={styles.statCardLabel}>Roster Headcount</span>
                      <span className={styles.statCardValue}>12 / 20 Max</span>
                    </div>
                  </div>

                  <div className={styles.transcriptBox}>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker}>Daily Scenario</span>
                      <span className={styles.transcriptText}>
                        Scenario: Upstream cloud provider announced 25% price increase. Executive decision: Deploy automated caching proxies to compress egress payloads by 40%.
                      </span>
                    </div>
                    <div className={styles.transcriptRow}>
                      <span className={styles.transcriptSpeaker} style={{ color: 'var(--cv-status-success-text)' }}>
                        Simulation P&L
                      </span>
                      <span className={styles.transcriptText}>
                        Daily overhead reduced by 300 CC. Company health score: +850 (Well above bankruptcy threshold of -1000).
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Simulation Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>3</span>
          <span className={styles.metricLabel}>Engineering Tracks</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>10</span>
          <span className={styles.metricLabel}>Seniority Levels</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>Multi-LLM</span>
          <span className={styles.metricLabel}>Resilient AI Gateway</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>100%</span>
          <span className={styles.metricLabel}>Immutable Double-Entry Ledger</span>
        </div>
      </div>

      {/* 3-Pillar Journey Section */}
      <section className={styles.sectionWrapper} id="features">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Three Simulation Pillars</span>
          <h2 className={styles.sectionTitle}>The Full Corporate Lifecycle</h2>
          <p className={styles.sectionSubtitle}>
            Bridging academic theory and corporate reality with deterministic consequence engines.
          </p>
        </div>

        <div className={styles.journeyGrid}>
          {/* Card 1: Job Seeker */}
          <div className={styles.journeyCard}>
            <div className={styles.journeyIconBox}>
              <BriefcaseIcon size={20} />
            </div>
            <h3 className={styles.journeyCardTitle}>1. Candidate & ATS Pipeline</h3>
            <p className={styles.journeyCardDesc}>
              Pass through realistic 8-stage ATS screening, take dynamic AI chat interviews, receive
              actionable diagnostic feedback, and negotiate level-band salaries.
            </p>
            <ul className={styles.journeyFeatures}>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Magic-byte verified GridFS resume ingestion</span>
              </li>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Context-grounded multi-turn interview bot</span>
              </li>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>5 active applications max concurrency quota</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Employee */}
          <div className={styles.journeyCard}>
            <div className={styles.journeyIconBox}>
              <ZapIcon size={20} />
            </div>
            <h3 className={styles.journeyCardTitle}>2. Employee Daily Engineering</h3>
            <p className={styles.journeyCardDesc}>
              Tackle on-demand primary and bonus engineering challenges. AI Evaluator bots score
              code solutions with strict EXP bounds and promotion rubrics.
            </p>
            <ul className={styles.journeyFeatures}>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Difficulty mapping from Easy (30) to Hard (100 EXP)</span>
              </li>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Authoritative double-entry EXP ledgers</span>
              </li>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>30-day warning decay & employment review triggers</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Founder */}
          <div className={styles.journeyCard}>
            <div className={styles.journeyIconBox}>
              <BotIcon size={20} />
            </div>
            <h3 className={styles.journeyCardTitle}>3. Founder Mode & Autonomous Ops</h3>
            <p className={styles.journeyCardDesc}>
              Reach 12,000 EXP to unlock Founder Mode. Receive 1,000 starter CorpCoin, purchase AI
              bot fleets, hire real peers, and resolve strategic business scenarios.
            </p>
            <ul className={styles.journeyFeatures}>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Autonomous Hiring, Task, and Evaluation bots</span>
              </li>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Daily P&L deterministic financial simulation</span>
              </li>
              <li className={styles.journeyFeatureItem}>
                <span className={styles.checkDot} />
                <span>Bankruptcy liquidation protections retaining personal EXP</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 10-Level Hierarchy Section */}
      <section className={styles.sectionWrapper} id="roles">
        <div className={styles.hierarchyCard}>
          <div className={styles.sectionHeader} style={{ marginBottom: 'var(--cv-space-4)' }}>
            <span className={styles.sectionBadge}>Career Progression</span>
            <h2 className={styles.sectionTitle}>10 Seniority Levels to Mastery</h2>
            <p className={styles.sectionSubtitle}>
              EXP is permanent career equity. Demotion or bankruptcy never strips accumulated experience.
            </p>
          </div>

          <div className={styles.levelsTrack}>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 1</span>
              <span className={styles.levelTitle}>Intern</span>
              <span className={styles.levelExp}>0 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 2</span>
              <span className={styles.levelTitle}>Junior</span>
              <span className={styles.levelExp}>500 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 3</span>
              <span className={styles.levelTitle}>Junior+</span>
              <span className={styles.levelExp}>1,200 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 4</span>
              <span className={styles.levelTitle}>Associate</span>
              <span className={styles.levelExp}>2,000 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 5</span>
              <span className={styles.levelTitle}>Mid-Level</span>
              <span className={styles.levelExp}>3,000 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 6</span>
              <span className={styles.levelTitle}>Mid+</span>
              <span className={styles.levelExp}>4,500 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 7</span>
              <span className={styles.levelTitle}>Senior</span>
              <span className={styles.levelExp}>6,500 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 8</span>
              <span className={styles.levelTitle}>Senior+</span>
              <span className={styles.levelExp}>9,000 EXP</span>
            </div>
            <div className={`${styles.levelItem} ${styles.levelHighlight}`}>
              <span className={styles.levelNumber}>Level 9 (Founder Unlock)</span>
              <span className={styles.levelTitle}>Lead Engineer</span>
              <span className={styles.levelExp}>12,000 EXP</span>
            </div>
            <div className={styles.levelItem}>
              <span className={styles.levelNumber}>Level 10 (Max)</span>
              <span className={styles.levelTitle}>Principal</span>
              <span className={styles.levelExp}>16,000 EXP</span>
            </div>
          </div>
        </div>
      </section>

      {/* Specializations Section */}
      <section className={styles.sectionWrapper} id="economy">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Specializations</span>
          <h2 className={styles.sectionTitle}>Curated Engineering Disciplines</h2>
          <p className={styles.sectionSubtitle}>
            Select your focus and work on authentic distributed systems and infrastructure.
          </p>
        </div>

        <div className={styles.domainsGrid}>
          <Link to="/jobs?domain=SOFTWARE_ENGINEERING" className={styles.domainCard}>
            <div className={styles.journeyIconBox}>
              <LaptopIcon size={20} />
            </div>
            <h3 className={styles.domainTitle}>Software Engineering</h3>
            <p className={styles.domainDesc}>
              Full-stack application development, distributed system design, API contracts, caching,
              and relational/document schema management.
            </p>
            <span className={styles.domainLink}>Explore Software Roles &rarr;</span>
          </Link>

          <Link to="/jobs?domain=CLOUD_ENGINEERING" className={styles.domainCard}>
            <div className={styles.journeyIconBox}>
              <CloudIcon size={20} />
            </div>
            <h3 className={styles.domainTitle}>Cloud Engineering</h3>
            <p className={styles.domainDesc}>
              Kubernetes cluster orchestration, Terraform infrastructure as code, CI/CD pipelines,
              and high-availability load balancing.
            </p>
            <span className={styles.domainLink}>Explore Cloud Roles &rarr;</span>
          </Link>

          <Link to="/jobs?domain=AI_ENGINEERING" className={styles.domainCard}>
            <div className={styles.journeyIconBox}>
              <BrainCircuitIcon size={20} />
            </div>
            <h3 className={styles.domainTitle}>AI Engineering</h3>
            <p className={styles.domainDesc}>
              LLM gateway routing, model latency optimization, RAG retrieval pipelines, and
              multi-provider fallback engineering.
            </p>
            <span className={styles.domainLink}>Explore AI Roles &rarr;</span>
          </Link>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>Ready to Enter the Simulation?</h2>
        <p className={styles.ctaSubtitle}>
          Join CorpVerse today. Upload your resume, challenge the automated ATS, climb the
          corporate ladder, and build your own company.
        </p>
        <div style={{ display: 'flex', gap: 'var(--cv-space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register">
            <Button
              variant="primary"
              size="md"
              leftIcon={<RocketIcon size={16} />}
            >
              Create Account
            </Button>
          </Link>
          <Link to="/leaderboards">
            <Button
              variant="outline"
              size="md"
              leftIcon={<TrophyIcon size={16} />}
            >
              View Leaderboards
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
