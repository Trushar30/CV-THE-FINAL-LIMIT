import { useState, useEffect, type ReactElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import {
  fetchTaskById,
  fetchTaskEvaluation,
  submitTaskWork,
  type EmployeeTask,
  type TaskSubmission,
  type PerformanceRecord,
} from '../../api/employee';
import styles from './Employee.module.css';

export function TaskWorkPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<EmployeeTask | null>(null);
  const [submission, setSubmission] = useState<TaskSubmission | null>(null);
  const [performanceRecord, setPerformanceRecord] = useState<PerformanceRecord | null>(null);

  const [solutionContent, setSolutionContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const currentTaskId = id;

    let isMounted = true;

    async function loadTaskDetails(targetTaskId: string) {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch task evaluation (which includes task, submission, performanceRecord)
        const evalData = await fetchTaskEvaluation(targetTaskId).catch(async () => {
          // If evaluation call fails, fallback to task by id
          const fallbackTask = await fetchTaskById(targetTaskId);
          return { task: fallbackTask, submission: null, performanceRecord: null };
        });

        if (isMounted) {
          setTask(evalData.task);
          setSubmission(evalData.submission);
          setPerformanceRecord(evalData.performanceRecord);
          if (evalData.submission) {
            setSolutionContent(evalData.submission.content);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load task details');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTaskDetails(currentTaskId);

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSubmit = async () => {
    if (!id || !solutionContent.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await submitTaskWork(id, solutionContent.trim());

      setSubmission(result.submission);
      setPerformanceRecord(result.performanceRecord);
      if (task) {
        setTask({ ...task, status: 'EVALUATED' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit and evaluate task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 0' }}>
        <Spinner size="lg" label="Loading technical scenario and rubric details..." />
        <p style={{ marginTop: '1rem', color: 'var(--cv-text-secondary)' }}>
          Loading technical scenario and rubric details...
        </p>
      </div>
    );
  }

  if (!task || error) {
    return (
      <div className={styles.container}>
        <EmptyState
          title="Task Unavailable"
          description={error || 'The requested daily task could not be loaded.'}
          action={
            <Button variant="primary" onClick={() => navigate('/workplace')}>
              Return to Workplace
            </Button>
          }
        />
      </div>
    );
  }

  const isAlreadySubmitted = Boolean(submission);
  const isEvaluated = Boolean(performanceRecord);
  const isWaiting = task.status === 'WAITING_FOR_PROVIDER';
  const requirements = task.scenario?.requirements || [];
  const criteria = task.scenario?.evaluationCriteria || [];

  return (
    <div className={styles.container}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/workplace')}>
          ← Back to Workplace Dashboard
        </Button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Badge variant={task.kind === 'PRIMARY' ? 'primary' : 'default'}>{task.kind} TASK</Badge>
          <Badge variant={task.difficulty === 'HARD' ? 'danger' : task.difficulty === 'MEDIUM' ? 'warning' : 'success'}>
            {task.difficulty}
          </Badge>
          <Badge variant="gold">+{task.maxExp} EXP Max</Badge>
        </div>
      </div>

      {/* AI Waiting Status Banner */}
      {isWaiting && (
        <div className={styles.founderBanner} style={{ borderColor: '#8b5cf6' }} data-testid="task-ai-waiting-banner">
          <div>
            <div className={styles.founderBannerTitle} style={{ color: '#8b5cf6' }}>
              <span className={styles.aiWaitingBadge}>AI Provider Busy</span>
              Task Content Queued
            </div>
            <div className={styles.founderBannerText}>
              This scenario is currently in the background queue. It will be generated automatically as soon as an AI provider becomes healthy.
            </div>
          </div>
        </div>
      )}

      {/* Scenario Brief Card */}
      <Card title={task.title} subtitle={`Domain: ${task.domain} • Level ${task.level}`}>
        <p style={{ fontSize: 'var(--cv-text-base)', lineHeight: 1.6, color: 'var(--cv-text-primary)' }}>
          {task.scenario?.scenario || task.description}
        </p>

        {requirements.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-muted)' }}>
              CORE REQUIREMENTS:
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--cv-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        {criteria.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-muted)' }}>
              EVALUATION RUBRIC CRITERIA:
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--cv-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {criteria.map((crit, i) => (
                <li key={i}>{crit}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Submission & Evaluation Section */}
      {isEvaluated && performanceRecord ? (
        /* Post-Evaluation Results Display */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }} data-testid="evaluation-results-section">
          {/* Score Hero */}
          <div className={styles.evalHero}>
            <div>
              <span className={styles.statLabel}>AI Evaluation Result</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.25rem' }}>
                <span className={styles.scoreHeroScore} data-testid="evaluation-score">
                  {performanceRecord.aiScore}
                </span>
                <span style={{ fontSize: 'var(--cv-text-lg)', color: 'var(--cv-text-muted)' }}>/ 100</span>
                <Badge
                  variant={
                    performanceRecord.scoreBand === 'EXCELLENT' || performanceRecord.scoreBand === 'GOOD'
                      ? 'success'
                      : performanceRecord.scoreBand === 'ACCEPTABLE'
                      ? 'primary'
                      : 'danger'
                  }
                  size="md"
                >
                  {performanceRecord.scoreBand}
                </Badge>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className={styles.statLabel}>EXP Awarded</span>
              <div style={{ fontSize: 'var(--cv-text-2xl)', fontWeight: 700, color: '#10b981' }} data-testid="awarded-exp-pill">
                +{performanceRecord.awardedExp} EXP
              </div>
              <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>
                Immutable Ledger Synced
              </span>
            </div>
          </div>

          {/* Discipline Warning Alert if Poor score */}
          {performanceRecord.aiScore <= 39 && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--cv-radius-md)',
                padding: '1rem',
                color: '#ef4444',
                fontSize: '0.9rem',
              }}
              data-testid="poor-score-warning-alert"
            >
              ⚠️ <strong>Performance Warning Issued:</strong> Score fell into Poor band (&le; 39). A disciplinary warning has been logged per corporate policy.
            </div>
          )}

          {/* Feedback & Qualitative Assessment */}
          <Card title="Evaluator Feedback & Insights">
            <p style={{ lineHeight: 1.6, color: 'var(--cv-text-primary)', margin: 0 }}>
              {performanceRecord.feedback}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
              {performanceRecord.strengths?.length > 0 && (
                <div style={{ background: 'var(--cv-surface-subtle)', padding: '1rem', borderRadius: 'var(--cv-radius-md)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: 'var(--cv-text-sm)' }}>
                    ✓ Observed Strengths
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--cv-text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {performanceRecord.strengths.map((str, i) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                </div>
              )}

              {performanceRecord.weaknesses?.length > 0 && (
                <div style={{ background: 'var(--cv-surface-subtle)', padding: '1rem', borderRadius: 'var(--cv-radius-md)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', fontSize: 'var(--cv-text-sm)' }}>
                    ▲ Deficiencies & Edge Cases
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--cv-text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {performanceRecord.weaknesses.map((weak, i) => (
                      <li key={i}>{weak}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Rubric Breakdown */}
            {performanceRecord.criteriaScores?.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: 'var(--cv-text-sm)', color: 'var(--cv-text-muted)' }}>
                  DETAILED RUBRIC BREAKDOWN
                </h4>
                <div className={styles.rubricList}>
                  {performanceRecord.criteriaScores.map((c, i) => (
                    <div key={i} className={styles.rubricItem}>
                      <div className={styles.rubricItemTop}>
                        <strong style={{ fontSize: '0.9rem' }}>{c.criterion}</strong>
                        <Badge variant={c.score >= 70 ? 'success' : c.score >= 40 ? 'warning' : 'danger'}>
                          {c.score} / 100
                        </Badge>
                      </div>
                      <p className={styles.rubricComment}>{c.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* Solution Answer Editor */
        <div className={styles.editorCard} data-testid="solution-editor-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--cv-text-lg)', fontWeight: 700 }}>
                Solution Implementation
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
                Write your technical solution, code snippet, or architectural proposal. Submissions are immutable.
              </p>
            </div>
            <div style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>
              {solutionContent.length} characters (min 10)
            </div>
          </div>

          <textarea
            className={styles.codeTextarea}
            placeholder="// Write code, explanations, and edge-case handling here..."
            value={solutionContent}
            disabled={isAlreadySubmitted || isSubmitting}
            onChange={(e) => setSolutionContent(e.target.value)}
            data-testid="solution-textarea"
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
            {isSubmitting && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>
                <Spinner size="sm" label="AI Evaluator Bot scoring solution..." />
                <span>AI Evaluator Bot scoring solution and assessing rubric...</span>
              </span>
            )}
            <Button
              variant="primary"
              size="md"
              disabled={solutionContent.trim().length < 10 || isAlreadySubmitted || isSubmitting}
              onClick={handleSubmit}
              data-testid="submit-solution-btn"
            >
              {isSubmitting ? 'Evaluating...' : isAlreadySubmitted ? 'Already Submitted' : 'Submit for AI Evaluation'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
