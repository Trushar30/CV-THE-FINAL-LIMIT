import { useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { ProgressBar } from '../../components/ui/ProgressBar/ProgressBar';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { useAuth } from '../../store/AuthContext';
import {
  fetchTodayTasks,
  fetchPromotionProgress,
  fetchActiveWarnings,
  fetchEmployeeCompany,
  type EmployeeTask,
  type PromotionProgress,
  type EmployeeWarning,
  type EmployeeCompanyInfo,
} from '../../api/employee';
import styles from './Employee.module.css';

export function WorkplaceDashboardPage(): ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [promotionProgress, setPromotionProgress] = useState<PromotionProgress | null>(null);
  const [warnings, setWarnings] = useState<EmployeeWarning[]>([]);
  const [companyInfo, setCompanyInfo] = useState<EmployeeCompanyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        const [tasksData, promoData, warningsData, companyData] = await Promise.all([
          fetchTodayTasks().catch(() => []),
          fetchPromotionProgress().catch(() => null),
          fetchActiveWarnings().catch(() => ({ activeCount: 0, warnings: [] })),
          fetchEmployeeCompany().catch(() => null),
        ]);

        if (isMounted) {
          setTasks(tasksData);
          setPromotionProgress(promoData);
          setWarnings(warningsData.warnings || []);
          setCompanyInfo(companyData);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load workplace dashboard');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 0' }}>
        <Spinner size="lg" label="Loading employee workspace and engineering tasks..." />
        <p style={{ marginTop: '1rem', color: 'var(--cv-text-secondary)' }}>
          Loading employee workspace and engineering tasks...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <EmptyState
          title="Workplace Error"
          description={error}
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const userExp = promotionProgress?.criteria.exp.current ?? user?.totalExpCached ?? 0;
  const founderUnlockExp = 12000;
  const expToFounder = Math.max(0, founderUnlockExp - userExp);
  const isFounderUnlocked = userExp >= founderUnlockExp;

  const currentLevel = promotionProgress?.currentLevel ?? companyInfo?.employee.level ?? 1;
  const currentTitle = promotionProgress?.currentTitle ?? companyInfo?.employee.positionTitle ?? 'Intern';
  const targetLevel = promotionProgress?.targetLevel;
  const targetTitle = promotionProgress?.targetTitle;
  const nextExpTarget = promotionProgress?.criteria.exp.required ?? 500;

  return (
    <div className={styles.container}>
      {/* Header & Company Info */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Engineering Workplace</h1>
            <p className={styles.subtitle}>
              Active deployment at{' '}
              <strong>{companyInfo?.company.name || 'Platform Enterprise'}</strong> ({companyInfo?.company.domain || 'Software Engineering'})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/tasks/history')}>
              Task History & Ledger
            </Button>
          </div>
        </div>
      </div>

      {/* Founder Mode Banner */}
      <div className={styles.founderBanner} data-testid="founder-mode-banner">
        <div>
          <div className={styles.founderBannerTitle}>
            <span>⚡ Founder Mode Status:</span>
            {isFounderUnlocked ? (
              <span className={styles.founderUnlockedTag}>Unlocked</span>
            ) : (
              <span>Locked</span>
            )}
          </div>
          <div className={styles.founderBannerText}>
            {isFounderUnlocked ? (
              <span>
                You have reached <strong>{userExp.toLocaleString()} EXP</strong>! You are eligible to launch a corporate enterprise in Founder HQ.
              </span>
            ) : (
              <span>
                Requires <strong>12,000 EXP</strong> to unlock company creation. <strong>{expToFounder.toLocaleString()} EXP remaining</strong>.
              </span>
            )}
          </div>
        </div>
        {!isFounderUnlocked && (
          <div style={{ minWidth: 160 }}>
            <ProgressBar
              value={userExp}
              max={founderUnlockExp}
              colorVariant="gold"
              size="sm"
              showPercentage
            />
          </div>
        )}
      </div>

      {/* Level & Career Stat Cards */}
      <div className={styles.statGrid}>
        <div className={styles.statCard} data-testid="level-card">
          <span className={styles.statLabel}>Career Level</span>
          <div className={styles.statValue}>
            Level {currentLevel} • {currentTitle}
          </div>
          <span className={styles.statHint}>
            Compensation: ${companyInfo?.employee.salarySimulated?.toLocaleString() || '50,000'} / yr
          </span>
        </div>

        <div className={styles.statCard} data-testid="exp-card">
          <span className={styles.statLabel}>Experience Capital</span>
          <div className={styles.statValue}>{userExp.toLocaleString()} EXP</div>
          <div style={{ marginTop: '0.5rem' }}>
            <ProgressBar
              value={userExp}
              max={nextExpTarget}
              colorVariant="primary"
              size="sm"
              label={targetLevel ? `Toward L${targetLevel} (${nextExpTarget} EXP)` : 'Max Level'}
              showPercentage={Boolean(targetLevel)}
            />
          </div>
        </div>

        <div className={styles.statCard} data-testid="warnings-stat-card">
          <span className={styles.statLabel}>Active Warnings</span>
          <div className={styles.statValue} style={{ color: warnings.length > 0 ? '#ef4444' : '#10b981' }}>
            {warnings.length} / 4
          </div>
          <span className={styles.statHint}>
            {warnings.length === 0
              ? 'Clean disciplinary standing'
              : `${warnings.length} active warning(s). Threshold at 4.`}
          </span>
        </div>
      </div>

      {/* Active Discipline Warnings Detail (if any) */}
      {warnings.length > 0 && (
        <div className={styles.warningsSection} data-testid="warnings-detail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#ef4444', fontSize: 'var(--cv-text-base)' }}>
              Active Performance Warnings ({warnings.length})
            </h3>
            <Badge variant="danger">Disciplinary Alert</Badge>
          </div>
          <div className={styles.warningList}>
            {warnings.map((warn) => {
              const expiresDate = new Date(warn.expiresAt);
              const daysLeft = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / 86400000));
              return (
                <div key={warn._id} className={styles.warningItem}>
                  <div>
                    <strong>{warn.reason}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)', marginTop: '0.2rem' }}>
                      Issued: {new Date(warn.issuedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={styles.warningCountdown}>
                    Expires: {expiresDate.toLocaleDateString()} ({daysLeft} days left)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Promotion Progress Panel */}
      {promotionProgress && (
        <div className={styles.progressPanel} data-testid="promotion-progress-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--cv-text-lg)', fontWeight: 700 }}>
                {promotionProgress.isMaxLevel
                  ? 'Principal Engineer (Maximum Level Reached)'
                  : `Promotion Readiness: Level ${targetLevel} (${targetTitle})`}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
                {promotionProgress.isEligible
                  ? 'All 4 advancement criteria satisfied! Evaluation bot will process promotion upon next task.'
                  : `Advance your career by satisfying all required performance rubrics.`}
              </p>
            </div>
            <div>
              {promotionProgress.isEligible ? (
                <Badge variant="success">Eligible for Promotion</Badge>
              ) : (
                <Badge variant="warning">Criteria In Progress</Badge>
              )}
            </div>
          </div>

          {!promotionProgress.isMaxLevel && (
            <div className={styles.criteriaGrid}>
              <div className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <span>Total EXP</span>
                  <span>{promotionProgress.criteria.exp.met ? '✓ Met' : 'Missing'}</span>
                </div>
                <div className={styles.criterionValue}>
                  {promotionProgress.criteria.exp.current} / {promotionProgress.criteria.exp.required}
                </div>
                <ProgressBar
                  value={promotionProgress.criteria.exp.current}
                  max={promotionProgress.criteria.exp.required}
                  size="sm"
                  colorVariant={promotionProgress.criteria.exp.met ? 'emerald' : 'primary'}
                />
              </div>

              <div className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <span>Completed Tasks</span>
                  <span>{promotionProgress.criteria.completedTasks.met ? '✓ Met' : 'Missing'}</span>
                </div>
                <div className={styles.criterionValue}>
                  {promotionProgress.criteria.completedTasks.current} / {promotionProgress.criteria.completedTasks.required}
                </div>
                <ProgressBar
                  value={promotionProgress.criteria.completedTasks.current}
                  max={promotionProgress.criteria.completedTasks.required}
                  size="sm"
                  colorVariant={promotionProgress.criteria.completedTasks.met ? 'emerald' : 'cyan'}
                />
              </div>

              <div className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <span>Average Score</span>
                  <span>{promotionProgress.criteria.averageScore.met ? '✓ Met' : 'Missing'}</span>
                </div>
                <div className={styles.criterionValue}>
                  {promotionProgress.criteria.averageScore.current}% (Min {promotionProgress.criteria.averageScore.required}%)
                </div>
                <ProgressBar
                  value={promotionProgress.criteria.averageScore.current}
                  max={100}
                  size="sm"
                  colorVariant={promotionProgress.criteria.averageScore.met ? 'emerald' : 'rose'}
                />
              </div>

              <div className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <span>Active Warnings</span>
                  <span>{promotionProgress.criteria.activeWarnings.met ? '✓ Met' : 'Exceeded'}</span>
                </div>
                <div className={styles.criterionValue}>
                  {promotionProgress.criteria.activeWarnings.current} (Max {promotionProgress.criteria.activeWarnings.maxAllowed})
                </div>
                <ProgressBar
                  value={promotionProgress.criteria.activeWarnings.current}
                  max={promotionProgress.criteria.activeWarnings.maxAllowed + 1}
                  size="sm"
                  colorVariant={promotionProgress.criteria.activeWarnings.met ? 'emerald' : 'rose'}
                />
              </div>
            </div>
          )}

          {promotionProgress.missingRequirements.length > 0 && (
            <div style={{ fontSize: 'var(--cv-text-xs)', color: '#f59e0b', marginTop: '0.25rem' }}>
              <strong>Missing Requirements:</strong> {promotionProgress.missingRequirements.join(' • ')}
            </div>
          )}
        </div>
      )}

      {/* Today's Daily Engineering Tasks */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--cv-text-xl)', fontWeight: 700 }}>
              Today's Engineering Tasks
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-secondary)' }}>
              Solve production scenarios generated on-demand for your level. (1 Primary + 1 Bonus daily)
            </p>
          </div>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            title="No Tasks Available"
            description="Daily tasks are generated on-demand when opening the dashboard. Click below to refresh."
            action={
              <Button variant="primary" onClick={() => window.location.reload()}>
                Generate Daily Tasks
              </Button>
            }
          />
        ) : (
          <div className={styles.tasksGrid}>
            {tasks.map((task) => {
              const isPrimary = task.kind === 'PRIMARY';
              const isWaiting = task.status === 'WAITING_FOR_PROVIDER';
              const isEvaluated = task.status === 'EVALUATED';
              const isSubmitted = task.status === 'SUBMITTED';

              return (
                <div
                  key={task._id}
                  className={`${styles.taskCard} ${isPrimary ? styles.primaryBadge : styles.bonusBadge}`}
                  data-testid={`task-card-${task.kind.toLowerCase()}`}
                >
                  <div className={styles.taskHeader}>
                    <div>
                      <div className={styles.taskMeta}>
                        <Badge variant={isPrimary ? 'primary' : 'default'}>
                          {task.kind} TASK
                        </Badge>
                        <Badge variant={task.difficulty === 'HARD' ? 'danger' : task.difficulty === 'MEDIUM' ? 'warning' : 'success'}>
                          {task.difficulty}
                        </Badge>
                        <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>
                          +{task.maxExp} EXP Max
                        </span>
                      </div>
                      <h3 className={styles.taskTitle} style={{ marginTop: '0.5rem' }}>
                        {task.title || `${task.kind} Task Scenario`}
                      </h3>
                    </div>
                  </div>

                  <p className={styles.taskDescription}>
                    {task.description || task.scenario?.scenario || 'Technical scenario awaiting implementation.'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {isWaiting ? (
                        <div className={styles.aiWaitingBadge} data-testid="ai-waiting-badge">
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
                          AI Bot Generating Scenario...
                        </div>
                      ) : isEvaluated ? (
                        <Badge variant="success">EVALUATED</Badge>
                      ) : isSubmitted ? (
                        <Badge variant="warning">SUBMITTED</Badge>
                      ) : (
                        <Badge variant="default">READY TO START</Badge>
                      )}
                    </div>

                    <Button
                      variant={isEvaluated ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={isWaiting}
                      onClick={() => navigate(`/tasks/${task._id}`)}
                    >
                      {isEvaluated ? 'View Evaluation' : isSubmitted ? 'View Submission' : 'Start Task'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
