import { useState, useEffect, useRef, type ReactElement, type KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  careerApi,
  type StageSessionData,
  type StageInterviewQuestion,
  type StageInterviewAnswer,
  type ApplicationListItem,
  type RejectionFeedback,
} from '../../api/career';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import {
  ArrowLeftIcon,
  BotIcon,
  SendIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from '../../components/ui/Icon';
import { FeedbackModal } from '../../components/career/FeedbackModal';
import styles from './StageChatPage.module.css';

interface MessageItem {
  id: string;
  sender: 'AI' | 'CANDIDATE';
  text: string;
  questionType?: string;
  difficulty?: string;
  evaluation?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    notes: string;
  };
  timestamp: string;
}

export function StageChatPage(): ReactElement {
  const { id: applicationId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [appDetails, setAppDetails] = useState<ApplicationListItem | null>(null);
  const [sessionData, setSessionData] = useState<StageSessionData | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<StageInterviewQuestion | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingAI, setIsWaitingAI] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stageOutcome, setStageOutcome] = useState<{
    passed: boolean;
    overallScore?: number;
    nextStage?: string;
  } | null>(null);

  // Rejection Feedback Modal
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState<RejectionFeedback | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (): void => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isWaitingAI]);

  useEffect(() => {
    if (!applicationId) return;

    const loadSession = async (): Promise<void> => {
      try {
        setLoading(true);
        const [appRes, stageRes] = await Promise.all([
          careerApi.getApplication(applicationId),
          careerApi.getStageSession(applicationId),
        ]);

        setAppDetails(appRes.application);
        setSessionData(stageRes);
        setCurrentQuestion(stageRes.currentQuestion);
        setIsCompleted(stageRes.isCompleted);
        setIsWaitingAI(stageRes.isWaitingAI);

        // Synthesize conversation history
        const initialMessages: MessageItem[] = [];
        if (stageRes.previousAnswers && stageRes.previousAnswers.length > 0) {
          stageRes.previousAnswers.forEach((ans: StageInterviewAnswer, index: number) => {
            initialMessages.push({
              id: `q-prev-${index}`,
              sender: 'AI',
              text: `Question ${index + 1}: Contextual Interview Prompt`,
              timestamp: ans.evaluatedAt || new Date().toISOString(),
            });
            initialMessages.push({
              id: `ans-prev-${index}`,
              sender: 'CANDIDATE',
              text: ans.answer,
              evaluation: ans.score !== undefined
                ? {
                    score: ans.score,
                    strengths: ans.strengths || [],
                    weaknesses: ans.weaknesses || [],
                    notes: ans.notes || '',
                  }
                : undefined,
              timestamp: ans.evaluatedAt || new Date().toISOString(),
            });
          });
        }

        // Active current question if present
        if (stageRes.currentQuestion) {
          initialMessages.push({
            id: `q-active-${stageRes.interview.currentQuestionIndex}`,
            sender: 'AI',
            text: stageRes.currentQuestion.question,
            questionType: stageRes.currentQuestion.type,
            difficulty: stageRes.currentQuestion.difficulty,
            timestamp: new Date().toISOString(),
          });
        }

        setMessages(initialMessages);
      } catch {
        // Error handling
      } finally {
        setLoading(false);
      }
    };

    void loadSession();
  }, [applicationId]);

  const handleSubmitAnswer = async (): Promise<void> => {
    const trimmed = answerInput.trim();
    if (!applicationId || !trimmed || isSubmitting || isWaitingAI || isCompleted) {
      return;
    }

    const currentSequence = sessionData?.interview.currentQuestionIndex ?? 1;

    // Optimistically append candidate answer
    const candidateMsg: MessageItem = {
      id: `ans-${Date.now()}`,
      sender: 'CANDIDATE',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, candidateMsg]);
    setAnswerInput('');
    setIsSubmitting(true);
    setIsWaitingAI(true);

    try {
      const response = await careerApi.submitStageAnswer(
        applicationId,
        trimmed,
        currentSequence
      );

      // Attach evaluation to candidate message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === candidateMsg.id
            ? {
                ...msg,
                evaluation: response.evaluation,
              }
            : msg
        )
      );

      if (response.isCompleted) {
        setIsCompleted(true);
        setCurrentQuestion(null);
        setStageOutcome({
          passed: response.passed ?? false,
          overallScore: response.overallScore,
          nextStage: response.nextStage,
        });
      } else if (response.nextQuestion) {
        setCurrentQuestion(response.nextQuestion);
        setSessionData((prev) =>
          prev
            ? {
                ...prev,
                interview: {
                  ...prev.interview,
                  currentQuestionIndex: prev.interview.currentQuestionIndex + 1,
                },
              }
            : null
        );
        // Append new AI question
        setMessages((prev) => [
          ...prev,
          {
            id: `q-${Date.now()}`,
            sender: 'AI',
            text: response.nextQuestion!.question,
            questionType: response.nextQuestion!.type,
            difficulty: response.nextQuestion!.difficulty,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      // Revert optimism if failed
    } finally {
      setIsSubmitting(false);
      setIsWaitingAI(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmitAnswer();
    }
  };

  const handleOpenRejectionFeedback = async (): Promise<void> => {
    if (!applicationId) return;
    try {
      const res = await careerApi.getApplicationFeedback(applicationId);
      setRejectionFeedback(res.feedback);
      setFeedbackModalOpen(true);
    } catch {
      // Handle error
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const stageName = sessionData?.interview.stage.replace(/_/g, ' ') || 'Interview Stage';
  const totalQuestions = sessionData?.interview.questionsCount || 3;
  const currentQIndex = sessionData?.interview.currentQuestionIndex || 1;
  const progressPercent = Math.min(100, (currentQIndex / totalQuestions) * 100);

  return (
    <div className={styles.container} data-testid="stage-chat-page">
      {/* Stage Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/applications')}
          >
            <ArrowLeftIcon size={14} />
            <span>Applications</span>
          </button>

          <div className={styles.headerTitleGroup}>
            <h1 className={styles.stageTitle}>{stageName}</h1>
            <Badge variant="info" size="sm">
              {currentQuestion?.difficulty || 'ADAPTIVE'}
            </Badge>
          </div>

          <div className={styles.companyRole}>
            {appDetails?.jobId?.title} at {appDetails?.companyId?.name}
          </div>
        </div>

        {/* Question Sequence Progress */}
        <div className={styles.progressContainer}>
          <span className={styles.progressLabel}>
            Question {Math.min(currentQIndex, totalQuestions)} of {totalQuestions}
          </span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Messages Dialogue Area */}
      <div className={styles.messagesArea} data-testid="chat-messages-area">
        {messages.map((msg) => {
          const isAi = msg.sender === 'AI';

          return (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${isAi ? styles.aiMessage : styles.candidateMessage}`}
            >
              <div className={styles.senderMeta}>
                {isAi && <BotIcon size={13} color="var(--cv-brand-primary-500)" />}
                <span>{isAi ? 'Interviewer Bot' : 'You (Candidate)'}</span>
              </div>

              <div className={`${styles.bubble} ${isAi ? styles.aiBubble : styles.candidateBubble}`}>
                {isAi && msg.questionType && (
                  <div className={styles.questionTypeChip}>
                    <span>{msg.questionType}</span>
                    {msg.difficulty && <span>• {msg.difficulty}</span>}
                  </div>
                )}
                <div>{msg.text}</div>
              </div>

              {/* Evaluation Card on Candidate Responses */}
              {msg.evaluation && (
                <div className={styles.evaluationCard} data-testid="evaluation-card">
                  <div className={styles.evalHeader}>
                    <span style={{ fontWeight: 600, color: 'var(--cv-text-muted)' }}>
                      AI Turn Evaluation
                    </span>
                    <span
                      className={`${styles.scoreBadge} ${
                        msg.evaluation.score >= 70
                          ? styles.scoreHigh
                          : msg.evaluation.score >= 50
                            ? styles.scoreMid
                            : styles.scoreLow
                      }`}
                    >
                      Score: {msg.evaluation.score}/100
                    </span>
                  </div>

                  <p className={styles.evalNotes}>{msg.evaluation.notes}</p>

                  {msg.evaluation.strengths.length > 0 && (
                    <div className={styles.evalPills}>
                      {msg.evaluation.strengths.map((str, i) => (
                        <span key={i} className={styles.strengthPill}>
                          + {str}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.evaluation.weaknesses.length > 0 && (
                    <div className={styles.evalPills}>
                      {msg.evaluation.weaknesses.map((w, i) => (
                        <span key={i} className={styles.weaknessPill}>
                          - {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing / Waiting Pulse */}
        {(isWaitingAI || isSubmitting) && (
          <div className={styles.typingContainer} data-testid="ai-typing-indicator">
            <div className={styles.typingDots}>
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
            </div>
            <span className={styles.typingText}>
              AI Interviewer is evaluating your response...
            </span>
          </div>
        )}

        {/* Completion & Transition Banners */}
        {isCompleted && stageOutcome && (
          <div className={styles.completionBanner} data-testid="stage-completion-banner">
            {stageOutcome.passed ? (
              <>
                <CheckCircle2Icon size={32} color="var(--cv-feedback-success)" />
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
                    Stage Successfully Cleared!
                  </h3>
                  <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
                    Your average performance was{' '}
                    <strong>{Math.round(stageOutcome.overallScore || 0)}/100</strong>. You have
                    advanced to <strong>{stageOutcome.nextStage?.replace(/_/g, ' ')}</strong>.
                  </p>
                </div>
                <Button variant="primary" size="md" onClick={() => navigate('/applications')}>
                  Return to Pipeline
                </Button>
              </>
            ) : (
              <>
                <AlertCircleIcon size={32} color="var(--cv-feedback-error)" />
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: 'var(--cv-text-base)', fontWeight: 700 }}>
                    Application Not Cleared
                  </h3>
                  <p style={{ margin: 0, fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
                    Your average score was{' '}
                    <strong>{Math.round(stageOutcome.overallScore || 0)}/100</strong>. Review detailed
                    diagnostic recommendations to identify target growth areas.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => void handleOpenRejectionFeedback()}
                  data-testid="view-stage-feedback-btn"
                >
                  View Rejection Diagnostics
                </Button>
              </>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer (Locked when completed or awaiting AI) */}
      <div className={styles.composer}>
        <div className={styles.composerTop}>
          <span>
            {isCompleted
              ? 'Stage Completed'
              : isWaitingAI
                ? 'Awaiting AI Turn...'
                : 'Type your answer below'}
          </span>
          <span>{answerInput.length} / 10,000</span>
        </div>

        <div className={styles.composerInputRow}>
          <textarea
            className={styles.textarea}
            placeholder={
              isCompleted
                ? 'This stage interview has concluded.'
                : 'Formulate your technical answer... (Cmd + Enter to submit)'
            }
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCompleted || isWaitingAI || isSubmitting}
            data-testid="stage-answer-input"
          />

          <button
            type="button"
            className={styles.sendButton}
            onClick={() => void handleSubmitAnswer()}
            disabled={isCompleted || isWaitingAI || isSubmitting || !answerInput.trim()}
            aria-label="Submit Answer"
            data-testid="stage-submit-btn"
          >
            {isSubmitting ? <Spinner size="sm" color="white" /> : <SendIcon size={18} />}
          </button>
        </div>
      </div>

      {/* Rejection Diagnostics Modal */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        feedback={rejectionFeedback}
        companyName={appDetails?.companyId?.name}
        jobTitle={appDetails?.jobId?.title}
      />
    </div>
  );
}

export default StageChatPage;
