import { useState, useEffect, type ReactElement } from 'react';
import {
  adminDemoApi,
  type DemoSessionSummary,
  type DemoInspectionResponse,
  type DemoDifficulty,
  type DemoInterviewType,
} from '../../api/adminDemo';
import type { CareerDomain } from '../../api/onboarding';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import {
  BotIcon,
  ShieldCheckIcon,
  ZapIcon,
  SendIcon,
  CloseIcon,
  SparklesIcon,
} from '../../components/ui/Icon';
import styles from './AdminDemoPage.module.css';

export function AdminDemoPage(): ReactElement {
  // Session initialization form state
  const [domain, setDomain] = useState<CareerDomain>('SOFTWARE_ENGINEERING');
  const [questionsCount, setQuestionsCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<DemoDifficulty>('EASY');
  const [interviewType, setInterviewType] = useState<DemoInterviewType>('CONCEPTUAL');
  const [isInitializing, setIsInitializing] = useState(false);

  // Active / Inspected Session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<DemoInspectionResponse | null>(null);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Candidate Turn Submission in Runner
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  // Sessions History & Cleanup state
  const [sessions, setSessions] = useState<DemoSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [targetCleanupSessionId, setTargetCleanupSessionId] = useState<string | null>(null);
  const [cleanupReason, setCleanupReason] = useState('');
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const fetchSessionsList = async (): Promise<void> => {
    try {
      setIsLoadingSessions(true);
      const res = await adminDemoApi.listDemoSessions();
      setSessions(res.sessions || []);
    } catch {
      // Fallback
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSessionInspection = async (sessionId: string): Promise<void> => {
    try {
      setIsLoadingInspection(true);
      setActiveSessionId(sessionId);
      const data = await adminDemoApi.getDemoSession(sessionId);
      setInspectionData(data);
    } catch {
      // Handle error
    } finally {
      setIsLoadingInspection(false);
    }
  };

  useEffect(() => {
    void fetchSessionsList();
  }, []);

  const handleCreateSession = async (): Promise<void> => {
    try {
      setIsInitializing(true);
      const res = await adminDemoApi.createDemoSession({
        domain,
        questionsCount,
        difficulty,
        interviewType,
      });
      await fetchSessionsList();
      await loadSessionInspection(res.session._id);
    } catch {
      // Handle error
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStepSession = async (): Promise<void> => {
    if (!activeSessionId) return;
    try {
      setIsStepping(true);
      await adminDemoApi.stepDemoSession(activeSessionId);
      await loadSessionInspection(activeSessionId);
      await fetchSessionsList();
    } catch {
      // Handle error
    } finally {
      setIsStepping(false);
    }
  };

  const handleSimulateSession = async (): Promise<void> => {
    if (!activeSessionId) return;
    try {
      setIsSimulating(true);
      await adminDemoApi.simulateDemoSession(activeSessionId);
      await loadSessionInspection(activeSessionId);
      await fetchSessionsList();
    } catch {
      // Handle error
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSubmitCandidateAnswer = async (): Promise<void> => {
    if (!activeSessionId || !candidateAnswer.trim()) return;
    try {
      setIsSubmittingAnswer(true);
      await adminDemoApi.submitDemoAnswer(activeSessionId, candidateAnswer.trim());
      setCandidateAnswer('');
      await loadSessionInspection(activeSessionId);
    } catch {
      // Handle error
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleOpenCleanupModal = (sessionId?: string): void => {
    setTargetCleanupSessionId(sessionId || null);
    setCleanupReason(sessionId ? 'Admin cleaned up demo session' : 'Admin purged all demo data');
    setCleanupModalOpen(true);
  };

  const handleExecuteCleanup = async (): Promise<void> => {
    try {
      setIsCleaningUp(true);
      if (targetCleanupSessionId) {
        await adminDemoApi.cleanupDemoSession(targetCleanupSessionId, cleanupReason);
        if (activeSessionId === targetCleanupSessionId) {
          setActiveSessionId(null);
          setInspectionData(null);
        }
      } else {
        await adminDemoApi.cleanupAllDemoData(cleanupReason);
        setActiveSessionId(null);
        setInspectionData(null);
      }
      setCleanupModalOpen(false);
      await fetchSessionsList();
    } catch {
      // Handle error
    } finally {
      setIsCleaningUp(false);
    }
  };

  const activeInterview = inspectionData?.stages?.interviews?.[0];
  const activeQuestions = activeInterview?.questions || [];
  const activeAnswers = activeInterview?.answers || [];

  return (
    <div className={styles.container} data-testid="admin-demo-page">
      {/* Top Banner */}
      <div className={styles.headerBanner}>
        <div className={styles.bannerTitleArea}>
          <h1>Admin Hiring Demo Simulator</h1>
          <p className={styles.bannerSubtitle}>
            Test and demonstrate the end-to-end multi-stage hiring engine with complete production state isolation.
          </p>
        </div>
        <div className={styles.isolationBadge}>
          <ShieldCheckIcon size={16} />
          <span>DEMO Pool Isolation (Zero Production Mutations)</span>
        </div>
      </div>

      {/* 1. Initialization Form */}
      <div className={styles.formCard} data-testid="demo-setup-card">
        <h3 className={styles.formCardTitle}>Initialize New Demo Session</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label htmlFor="domain-select">Career Domain</label>
            <select
              id="domain-select"
              className={styles.selectInput}
              value={domain}
              onChange={(e) => setDomain(e.target.value as CareerDomain)}
              data-testid="domain-select"
            >
              <option value="SOFTWARE_ENGINEERING">Software Engineering</option>
              <option value="CLOUD_ENGINEERING">Cloud Engineering</option>
              <option value="AI_ENGINEERING">AI Engineering</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="questions-count-input">Questions Count (1-10)</label>
            <input
              id="questions-count-input"
              type="number"
              min={1}
              max={10}
              className={styles.textInput}
              value={questionsCount}
              onChange={(e) => setQuestionsCount(Number(e.target.value))}
              data-testid="questions-count-input"
            >
            </input>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="difficulty-select">Difficulty Tier</label>
            <select
              id="difficulty-select"
              className={styles.selectInput}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DemoDifficulty)}
              data-testid="difficulty-select"
            >
              <option value="EASY">EASY (Fast demo)</option>
              <option value="MEDIUM">MEDIUM (Standard)</option>
              <option value="HARD">HARD (Senior level)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="type-select">Interview Type</label>
            <select
              id="type-select"
              className={styles.selectInput}
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value as DemoInterviewType)}
              data-testid="type-select"
            >
              <option value="CONCEPTUAL">Conceptual</option>
              <option value="CODING">Coding / Implementation</option>
              <option value="ARCHITECTURE">System Architecture</option>
              <option value="BEHAVIORAL">Behavioral / Leadership</option>
            </select>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleCreateSession()}
            disabled={isInitializing}
            data-testid="create-session-btn"
          >
            {isInitializing ? <Spinner size="sm" color="white" /> : <ZapIcon size={16} />}
            Initialize Demo Session
          </Button>
        </div>
      </div>

      {/* 2. Interactive Runner (Candidate Experience through same chat UI) */}
      {inspectionData && (
        <div className={styles.runnerCard} data-testid="demo-runner-card">
          <div className={styles.runnerHeader}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
                  Active Demo Session
                </span>
                <Badge variant="primary" size="sm">
                  {inspectionData.session.domain}
                </Badge>
                <Badge variant="info" size="sm">
                  Stage: {inspectionData.application.currentStage}
                </Badge>
                <Badge variant="default" size="sm">
                  Status: {inspectionData.session.status}
                </Badge>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
                Session ID: {inspectionData.session._id}
              </span>
            </div>

            <div className={styles.runnerControls}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleStepSession()}
                disabled={isStepping || isSimulating || inspectionData.session.status === 'COMPLETED'}
                data-testid="step-session-btn"
              >
                {isStepping ? <Spinner size="sm" /> : <ZapIcon size={14} />}
                Advance Next Step
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSimulateSession()}
                disabled={isStepping || isSimulating || inspectionData.session.status === 'COMPLETED'}
                data-testid="simulate-session-btn"
              >
                {isSimulating ? <Spinner size="sm" color="white" /> : <SparklesIcon size={14} />}
                Simulate Full Lifecycle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadSessionInspection(inspectionData.session._id)}
                disabled={isLoadingInspection}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Interactive Chat Dialogue if in chat stage */}
          {activeQuestions.length > 0 && (
            <div className={styles.runnerChatBox} data-testid="runner-chat-box">
              {activeQuestions.map((q, idx) => {
                const ans = activeAnswers[idx];
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className={styles.runnerBubbleAi}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <BotIcon size={14} color="var(--cv-brand-primary-500)" />
                        <strong>Interviewer Bot (Q{idx + 1}):</strong>
                        <Badge variant="default" size="sm">{q.type}</Badge>
                      </div>
                      <div>{q.question}</div>
                    </div>

                    {ans ? (
                      <div className={styles.runnerBubbleCandidate}>
                        <strong style={{ display: 'block', marginBottom: '2px' }}>Demo Candidate:</strong>
                        <div>{ans.answer}</div>
                        {ans.score !== undefined && (
                          <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.9 }}>
                            Evaluation Score: {ans.score}/100
                          </div>
                        )}
                      </div>
                    ) : (
                      idx === activeQuestions.length - 1 && (
                        <div className={styles.runnerInputRow}>
                          <textarea
                            className={styles.runnerTextarea}
                            placeholder="Type candidate answer to active question..."
                            value={candidateAnswer}
                            onChange={(e) => setCandidateAnswer(e.target.value)}
                            disabled={isSubmittingAnswer}
                            data-testid="demo-answer-input"
                          />
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => void handleSubmitCandidateAnswer()}
                            disabled={isSubmittingAnswer || !candidateAnswer.trim()}
                            data-testid="demo-submit-answer-btn"
                          >
                            {isSubmittingAnswer ? <Spinner size="sm" color="white" /> : <SendIcon size={16} />}
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Results Screen & Stage Scores */}
      {inspectionData && (
        <div className={styles.resultsGrid} data-testid="demo-results-grid">
          {/* ATS Screening Result */}
          {inspectionData.stages.ats && (
            <div className={styles.resultPanel} data-testid="ats-result-panel">
              <h4 className={styles.panelTitle}>
                <span>ATS Screening Result</span>
                <Badge variant="info" size="sm">Stage 1</Badge>
              </h4>
              <div className={styles.scoreRow}>
                <span className={styles.scoreValue}>
                  {inspectionData.stages.ats.evaluation?.score ?? inspectionData.application.atsScore ?? '--'}
                </span>
                <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>/ 100</span>
              </div>
              <p className={styles.summaryText}>
                {inspectionData.stages.ats.evaluation?.summary ||
                  inspectionData.application.atsFeedback ||
                  'Evaluated by AI Gateway ATS_SCREEN task.'}
              </p>
            </div>
          )}

          {/* Final Review Result */}
          {inspectionData.stages.finalReview && (
            <div className={styles.resultPanel} data-testid="final-review-panel">
              <h4 className={styles.panelTitle}>
                <span>Final Review Synthesis</span>
                <Badge
                  variant={inspectionData.stages.finalReview.isPassing ? 'success' : 'danger'}
                  size="sm"
                >
                  {inspectionData.stages.finalReview.isPassing ? 'Passed' : 'Failed'}
                </Badge>
              </h4>
              <div className={styles.scoreRow}>
                <span className={styles.scoreValue}>
                  {inspectionData.stages.finalReview.finalScore}
                </span>
                <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>/ 100</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
                ATS (15%): {inspectionData.stages.finalReview.atsScore} • Screening (20%): {inspectionData.stages.finalReview.screeningScore} • Assessment (30%): {inspectionData.stages.finalReview.assessmentScore} • Interview (35%): {inspectionData.stages.finalReview.interviewScore}
              </div>
              <p className={styles.summaryText}>
                {inspectionData.stages.finalReview.summary}
              </p>
            </div>
          )}

          {/* Formal Employment Offer */}
          {inspectionData.stages.offer && (
            <div className={styles.resultPanel} data-testid="offer-result-panel">
              <h4 className={styles.panelTitle}>
                <span>Formal Employment Offer</span>
                <Badge variant="success" size="sm">
                  {inspectionData.stages.offer.status}
                </Badge>
              </h4>
              <div>
                <strong style={{ fontSize: 'var(--cv-text-base)', color: 'var(--cv-text-primary)' }}>
                  {inspectionData.stages.offer.positionTitle}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--cv-text-muted)', marginTop: '2px' }}>
                  Level {inspectionData.stages.offer.level} Standard Band
                </div>
              </div>
              <div className={styles.scoreRow}>
                <span className={styles.scoreValue}>
                  ${inspectionData.stages.offer.salarySimulated.toLocaleString()}
                </span>
                <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>/ year</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--cv-text-muted)' }}>
                Authorized Band: ${inspectionData.stages.offer.salaryMin.toLocaleString()} – ${inspectionData.stages.offer.salaryMax.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. AI Telemetry per Call */}
      {inspectionData?.aiTelemetry && (
        <div className={styles.formCard} data-testid="ai-telemetry-card">
          <h4 className={styles.formCardTitle}>AI Provider Telemetry Logs (DEMO Pool)</h4>
          {inspectionData.aiTelemetry.jobs.length === 0 && inspectionData.aiTelemetry.recentRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-muted)' }}>
              No AI calls recorded for this session yet.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.telemetryTable}>
                <thead>
                  <tr>
                    <th>Task Type</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th>Latency</th>
                    <th>Tokens</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionData.aiTelemetry.recentRequests.map((req, i) => (
                    <tr key={i}>
                      <td><strong>{req.taskType}</strong></td>
                      <td>{req.provider}</td>
                      <td>{req.model}</td>
                      <td>{req.latencyMs ? `${req.latencyMs} ms` : '--'}</td>
                      <td>{(req.promptTokens ?? 0) + (req.completionTokens ?? 0)}</td>
                      <td>
                        <Badge variant="success" size="sm">{req.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {inspectionData.aiTelemetry.jobs.map((job, i) => (
                    <tr key={`job-${i}`}>
                      <td><strong>{job.taskType}</strong></td>
                      <td>{job.provider}</td>
                      <td>{job.model || 'Standard'}</td>
                      <td>{job.latencyMs ? `${job.latencyMs} ms` : '--'}</td>
                      <td>{(job.promptTokens ?? 0) + (job.completionTokens ?? 0)}</td>
                      <td>
                        <Badge variant={job.status === 'COMPLETED' ? 'success' : 'default'} size="sm">
                          {job.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Demo Sessions Management & Cleanup */}
      <div className={styles.historyCard} data-testid="demo-sessions-table-card">
        <div className={styles.historyHeader}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
              Demo Sessions Directory
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--cv-text-muted)' }}>
              Historical demo instances across all interview types.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleOpenCleanupModal()}
              disabled={sessions.length === 0}
              data-testid="purge-all-demo-btn"
            >
              Purge All Demo Data
            </Button>
          </div>
        </div>

        {isLoadingSessions ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Spinner size="md" />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--cv-text-muted)', fontSize: 'var(--cv-text-xs)' }}>
            No demo sessions available. Use the form above to initialize one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Domain</th>
                  <th>Difficulty</th>
                  <th>Questions</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s._id} data-testid={`session-row-${s._id}`}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s._id.slice(-8)}</td>
                    <td>{s.domain}</td>
                    <td><Badge variant="default" size="sm">{s.difficulty}</Badge></td>
                    <td>{s.questionsCount}</td>
                    <td><Badge variant="info" size="sm">{s.currentStage}</Badge></td>
                    <td>
                      <Badge
                        variant={s.status === 'COMPLETED' ? 'success' : s.status === 'FAILED' ? 'danger' : 'primary'}
                        size="sm"
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void loadSessionInspection(s._id)}
                          data-testid={`inspect-session-btn-${s._id}`}
                        >
                          Inspect
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleOpenCleanupModal(s._id)}
                          data-testid={`cleanup-session-btn-${s._id}`}
                        >
                          Clean
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cleanup Confirmation Modal */}
      {cleanupModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" data-testid="cleanup-modal">
          <div className={styles.modalBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
                {targetCleanupSessionId ? 'Clean Up Demo Session' : 'Purge All Demo Data'}
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-text-muted)' }}
                onClick={() => setCleanupModalOpen(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)', lineHeight: 1.5 }}>
              {targetCleanupSessionId
                ? 'This will remove the selected demo session and its associated demo applications, interviews, questions, and telemetry.'
                : 'This will purge all demo sessions and demo application records system-wide. Production data will NOT be touched.'}
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--cv-text-secondary)' }}>
                Audit Justification Reason (Required)
              </label>
              <input
                type="text"
                className={styles.textInput}
                value={cleanupReason}
                onChange={(e) => setCleanupReason(e.target.value)}
                placeholder="Reason for cleanup action..."
                style={{ width: '100%' }}
                data-testid="cleanup-reason-input"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCleanupModalOpen(false)}
                disabled={isCleaningUp}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleExecuteCleanup()}
                disabled={isCleaningUp || !cleanupReason.trim()}
                data-testid="confirm-cleanup-btn"
              >
                {isCleaningUp ? <Spinner size="sm" color="white" /> : 'Confirm Cleanup'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDemoPage;
