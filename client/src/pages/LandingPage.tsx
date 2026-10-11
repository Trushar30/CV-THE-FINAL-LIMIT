import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Button } from '../components/ui/Button/Button';
import {
  RocketIcon,
  BriefcaseIcon,
  BuildingIcon,
  TrophyIcon,
  ZapIcon,
  BotIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from '../components/ui/Icon';
import styles from './LandingPage.module.css';

export function LandingPage(): ReactElement {
  const { user } = useAuth();

  const getDashboardDestination = (): { path: string; label: string } => {
    if (!user) return { path: '/register', label: 'Get Started Free' };
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
      <div className={styles.ambientGlow} />

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroBadge}>
          <span className={styles.pulseDot} />
          <span>
            {user
              ? `Welcome, ${user.displayName || user.email} · Level ${user.level} ${user.careerRole}`
              : 'Interactive Corporate Simulation Sandbox'}
          </span>
        </div>

        <h1 className={styles.heroTitle}>
          Experience the Corporate Ladder{' '}
          <span className={styles.gradientText}>Before Stepping Into It</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Master real-world software, cloud, and AI engineering workflows. Overcome AI ATS
          screening, complete daily on-demand tasks, earn immutable EXP, and unlock Founder Mode to
          operate your own autonomous AI-driven tech company.
        </p>

        <div className={styles.heroActions}>
          <Link to={primaryCta.path}>
            <Button
              variant="primary"
              size="lg"
              leftIcon={<RocketIcon size={18} />}
              className="cv-spring-interactive"
            >
              {primaryCta.label}
            </Button>
          </Link>
          <Link to="/jobs">
            <Button
              variant="outline"
              size="lg"
              leftIcon={<BriefcaseIcon size={18} />}
              className="cv-spring-interactive"
            >
              Explore Job Openings
            </Button>
          </Link>
          <Link to="/companies">
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<BuildingIcon size={18} />}
              className="cv-spring-interactive"
            >
              Enterprise Directory
            </Button>
          </Link>
        </div>
      </section>

      {/* Live Simulation Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>3</div>
          <div className={styles.metricLabel}>Engineering Domains</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>10</div>
          <div className={styles.metricLabel}>Career Seniority Levels</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>Multi-LLM</div>
          <div className={styles.metricLabel}>Resilient AI Gateway</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>100%</div>
          <div className={styles.metricLabel}>Authoritative Ledger Economy</div>
        </div>
      </div>

      {/* 3-Pillar Journey Section */}
      <section className={styles.sectionWrapper}>
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
              <BriefcaseIcon size={24} />
            </div>
            <h3 className={styles.journeyCardTitle}>1. Job Seeker & Hiring Pipeline</h3>
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
              <ZapIcon size={24} />
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
              <BotIcon size={24} />
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
      <section className={styles.sectionWrapper}>
        <div className={styles.hierarchyCard}>
          <div className={styles.sectionHeader} style={{ marginBottom: '1.5rem' }}>
            <span className={styles.sectionBadge}>Career Progression</span>
            <h2 className={styles.sectionTitle}>10 Seniority Levels to Mastery</h2>
            <p className={styles.sectionSubtitle}>
              EXP is permanent career equity. Demotion or bankruptcy never strips accumulated experience.
            </p>
          </div>

          <div className={styles.levelsTrack}>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 1</div>
              <div className={styles.levelTitle}>Intern</div>
              <div className={styles.levelExp}>0 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 2</div>
              <div className={styles.levelTitle}>Junior</div>
              <div className={styles.levelExp}>500 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 3</div>
              <div className={styles.levelTitle}>Junior+</div>
              <div className={styles.levelExp}>1,200 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 4</div>
              <div className={styles.levelTitle}>Associate</div>
              <div className={styles.levelExp}>2,000 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 5</div>
              <div className={styles.levelTitle}>Mid-Level</div>
              <div className={styles.levelExp}>3,000 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 6</div>
              <div className={styles.levelTitle}>Mid+</div>
              <div className={styles.levelExp}>4,500 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 7</div>
              <div className={styles.levelTitle}>Senior</div>
              <div className={styles.levelExp}>6,500 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 8</div>
              <div className={styles.levelTitle}>Senior+</div>
              <div className={styles.levelExp}>9,000 EXP</div>
            </div>
            <div className={`${styles.levelItem} ${styles.levelHighlight}`}>
              <div className={styles.levelNumber}>Level 9 (Founder Unlock)</div>
              <div className={styles.levelTitle}>Lead Engineer</div>
              <div className={styles.levelExp}>12,000 EXP</div>
            </div>
            <div className={styles.levelItem}>
              <div className={styles.levelNumber}>Level 10 (Max)</div>
              <div className={styles.levelTitle}>Principal</div>
              <div className={styles.levelExp}>16,000 EXP</div>
            </div>
          </div>
        </div>
      </section>

      {/* Career Domains Section */}
      <section className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Specializations</span>
          <h2 className={styles.sectionTitle}>Curated Career Tracks</h2>
          <p className={styles.sectionSubtitle}>
            Choose your core discipline and solve real-world corporate architectural puzzles.
          </p>
        </div>

        <div className={styles.domainsGrid}>
          <Link to="/jobs?domain=SOFTWARE_ENGINEERING" className={styles.domainCard}>
            <div className={styles.journeyIconBox} style={{ color: 'var(--cv-brand-primary-400)' }}>
              <SparklesIcon size={22} />
            </div>
            <h3 className={styles.domainTitle}>Software Engineering</h3>
            <p className={styles.domainDesc}>
              Full-stack application development, distributed system design, API contracts, caching,
              and relational/document schema management.
            </p>
            <span className={styles.domainLink}>Explore Software Roles &rarr;</span>
          </Link>

          <Link to="/jobs?domain=CLOUD_ENGINEERING" className={styles.domainCard}>
            <div className={styles.journeyIconBox} style={{ color: 'var(--cv-accent-cyan-400)' }}>
              <ShieldCheckIcon size={22} />
            </div>
            <h3 className={styles.domainTitle}>Cloud Engineering</h3>
            <p className={styles.domainDesc}>
              Kubernetes cluster orchestration, Terraform infrastructure as code, CI/CD pipelines,
              and high-availability load balancing.
            </p>
            <span className={styles.domainLink}>Explore Cloud Roles &rarr;</span>
          </Link>

          <Link to="/jobs?domain=AI_ENGINEERING" className={styles.domainCard}>
            <div className={styles.journeyIconBox} style={{ color: 'var(--cv-gold-400)' }}>
              <BotIcon size={22} />
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

      {/* CTA Banner */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>Ready to Accelerate Your Career?</h2>
        <p className={styles.ctaSubtitle}>
          Join CorpVerse today. Upload your resume, challenge the automated ATS, climb the
          corporate ladder, and build your own company.
        </p>
        <div style={{ display: 'flex', gap: 'var(--cv-space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register">
            <Button
              variant="gold"
              size="lg"
              leftIcon={<RocketIcon size={18} />}
              className="cv-spring-interactive"
            >
              Create Free Account
            </Button>
          </Link>
          <Link to="/leaderboards">
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<TrophyIcon size={18} />}
              className="cv-spring-interactive"
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
