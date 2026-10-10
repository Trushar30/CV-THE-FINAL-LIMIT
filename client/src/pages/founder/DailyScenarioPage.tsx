import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import styles from './Founder.module.css';

interface ScenarioOption {
  optionId: 'A' | 'B' | 'C' | 'D';
  title: string;
  description: string;
  expectedOutcome: string;
  modifierTemplateId: string;
  modifiers?: {
    revenueDeltaPercent?: number;
    expensesDeltaPercent?: number;
    immediateCost?: number;
    satisfactionDelta?: number;
    reputationDelta?: number;
    productivityDeltaPercent?: number;
  };
}

interface ScenarioData {
  _id: string;
  companyId: string;
  date: string;
  scenarioPrompt: string;
  category: 'PRODUCT' | 'ENGINEERING' | 'CLIENT' | 'CULTURE' | 'FINANCE';
  options: ScenarioOption[];
  status: 'ACTIVE' | 'DECIDED' | 'EXPIRED';
  chosenOptionId?: 'A' | 'B' | 'C' | 'D';
  calculatedDelta?: Record<string, number>;
}

interface TickOutcome {
  tickResult: {
    dailyRevenue: number;
    dailyExpenses: number;
    dailyProfit: number;
    newFinancialHealth: number;
    newCompanyRating: number;
    newEmployeeSatisfaction: number;
    newRetentionRate: number;
    isBankrupt: boolean;
  };
  alreadyTicked: boolean;
}

export function DailyScenarioPage(): ReactElement {
  const { success, error, warning, info } = useToast();

  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [tickResult, setTickResult] = useState<TickOutcome | null>(null);

  const loadScenario = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await apiClient.get<ScenarioData>('/founder/simulation/scenario');
      setScenario(res);
      if (res.status === 'DECIDED' && res.chosenOptionId) {
        setSelectedOptionId(res.chosenOptionId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch daily dilemma';
      error(msg);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadScenario();
  }, [loadScenario]);

  const handleSubmitDecision = async (): Promise<void> => {
    if (!scenario || !selectedOptionId) {
      warning('Please select a strategic option');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/founder/simulation/decision', {
        scenarioId: scenario._id,
        chosenOptionId: selectedOptionId,
        rationale: rationale.trim() || undefined,
      });

      success(`Decision recorded: Option ${selectedOptionId}`);
      await loadScenario();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit decision';
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteTick = async (): Promise<void> => {
    try {
      setTicking(true);
      const res = await apiClient.post<TickOutcome>('/founder/simulation/tick');
      setTickResult(res);
      if (res.alreadyTicked) {
        info('Daily tick has already run for today (UTC)');
      } else {
        success('Deterministic daily tick completed successfully!');
      }
      await loadScenario();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute daily simulation tick';
      error(msg);
    } finally {
      setTicking(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Generating today's strategic dilemma...</p>
      </div>
    );
  }

  const isDecided = scenario?.status === 'DECIDED';
  const isExpired = scenario?.status === 'EXPIRED';

  return (
    <div className={styles.container} data-testid="daily-scenario-page">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>⚡</span> Daily Executive Dilemma
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {scenario && (
              <Badge variant={isDecided ? 'success' : isExpired ? 'danger' : 'gold'}>
                {scenario.status} ({scenario.date})
              </Badge>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={ticking}
              onClick={handleExecuteTick}
              data-testid="execute-tick-button"
            >
              Run Daily Tick ⏱️
            </Button>
          </div>
        </div>
        <p className={styles.subtitle}>
          Each day, executive founders confront a high-stakes corporate dilemma. Your decision deterministically shapes revenue, expenses, and employee morale.
        </p>

        {/* Navigation Tabs */}
        <div className={styles.navTabs}>
          <Link to="/founder" className={styles.navTab}>Command Overview</Link>
          <Link to="/founder/simulation" className={`${styles.navTab} ${styles.navTabActive}`}>Daily Dilemma & Tick</Link>
          <Link to="/founder/bots" className={styles.navTab}>Bot Fleet</Link>
          <Link to="/founder/jobs" className={styles.navTab}>Job Openings</Link>
          <Link to="/founder/applicants" className={styles.navTab}>Applicant Pipeline</Link>
          <Link to="/founder/ledger" className={styles.navTab}>CorpCoin Ledger</Link>
        </div>
      </div>

      {/* Tick Outcome Feedback Panel */}
      {tickResult && (
        <div className={styles.cyanBanner} data-testid="tick-outcome-banner">
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--cv-text-base)', color: 'var(--cv-accent-cyan-400)' }}>
              Simulation Tick Result: {tickResult.alreadyTicked ? 'Existing Financial Snapshot' : 'New Day Computed'}
            </div>
            {tickResult.tickResult && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap', fontSize: 'var(--cv-text-sm)' }}>
                <span>Revenue: <strong>+{tickResult.tickResult.dailyRevenue} CC</strong></span>
                <span>Expenses: <strong>-{tickResult.tickResult.dailyExpenses} CC</strong></span>
                <span>Net Profit: <strong>{tickResult.tickResult.dailyProfit >= 0 ? `+${tickResult.tickResult.dailyProfit}` : tickResult.tickResult.dailyProfit} CC</strong></span>
                <span>New Health: <strong>{tickResult.tickResult.newFinancialHealth} CC</strong></span>
                <span>Reputation: <strong>{tickResult.tickResult.newCompanyRating}</strong></span>
              </div>
            )}
          </div>
          {tickResult.tickResult && (
            <Badge variant={tickResult.tickResult.isBankrupt ? 'danger' : 'success'}>
              {tickResult.tickResult.isBankrupt ? 'BANKRUPTCY TRIGGERED' : 'SOLVENT'}
            </Badge>
          )}
        </div>
      )}

      {/* Scenario Brief Card */}
      {scenario && (
        <div className={styles.sectionCard} data-testid="scenario-brief-card">
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Badge variant="cyan">{scenario.category}</Badge>
              <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)' }}>Date: {scenario.date}</span>
            </div>
            {isDecided && <Badge variant="success">Decision Submitted</Badge>}
            {isExpired && <Badge variant="danger">Expired — Default Penalty Applied</Badge>}
          </div>

          <div style={{ fontSize: 'var(--cv-text-lg)', fontWeight: 600, color: 'var(--cv-text-primary)', lineHeight: 1.6 }}>
            {scenario.scenarioPrompt}
          </div>
        </div>
      )}

      {/* Options Selection Grid */}
      {scenario && (
        <div className={styles.scenarioGrid}>
          {scenario.options.map((opt) => {
            const isSelected = selectedOptionId === opt.optionId;
            const isChosen = scenario.chosenOptionId === opt.optionId;

            return (
              <div
                key={opt.optionId}
                className={`${styles.optionCard} ${isSelected ? styles.optionCardSelected : ''}`}
                onClick={() => {
                  if (!isDecided && !isExpired) {
                    setSelectedOptionId(opt.optionId);
                  }
                }}
                data-testid={`scenario-option-${opt.optionId.toLowerCase()}`}
              >
                <div className={styles.optionHeader}>
                  <div className={`${styles.optionBadge} ${isSelected ? styles.optionBadgeSelected : ''}`}>
                    {opt.optionId}
                  </div>
                  <h3 className={styles.optionTitle}>{opt.title}</h3>
                  {isChosen && <Badge variant="success">Chosen Option</Badge>}
                </div>

                <p className={styles.optionDescription}>{opt.description}</p>

                <div className={styles.optionOutcome}>
                  <strong>Expected Outcome:</strong> {opt.expectedOutcome}
                </div>

                {/* Modifiers tags preview */}
                {opt.modifiers && (
                  <div className={styles.modifierTags}>
                    {opt.modifiers.revenueDeltaPercent !== undefined && opt.modifiers.revenueDeltaPercent !== 0 && (
                      <span className={`${styles.modifierTag} ${opt.modifiers.revenueDeltaPercent > 0 ? styles.modifierPositive : styles.modifierNegative}`}>
                        {opt.modifiers.revenueDeltaPercent > 0 ? `+${opt.modifiers.revenueDeltaPercent}%` : `${opt.modifiers.revenueDeltaPercent}%`} Revenue
                      </span>
                    )}
                    {opt.modifiers.expensesDeltaPercent !== undefined && opt.modifiers.expensesDeltaPercent !== 0 && (
                      <span className={`${styles.modifierTag} ${opt.modifiers.expensesDeltaPercent < 0 ? styles.modifierPositive : styles.modifierNegative}`}>
                        {opt.modifiers.expensesDeltaPercent > 0 ? `+${opt.modifiers.expensesDeltaPercent}%` : `${opt.modifiers.expensesDeltaPercent}%`} Expenses
                      </span>
                    )}
                    {opt.modifiers.immediateCost !== undefined && opt.modifiers.immediateCost > 0 && (
                      <span className={`${styles.modifierTag} ${styles.modifierNegative}`}>
                        -{opt.modifiers.immediateCost} CC Immediate
                      </span>
                    )}
                    {opt.modifiers.satisfactionDelta !== undefined && opt.modifiers.satisfactionDelta !== 0 && (
                      <span className={`${styles.modifierTag} ${opt.modifiers.satisfactionDelta > 0 ? styles.modifierPositive : styles.modifierNegative}`}>
                        {opt.modifiers.satisfactionDelta > 0 ? `+${opt.modifiers.satisfactionDelta}` : opt.modifiers.satisfactionDelta} Satisfaction
                      </span>
                    )}
                    {opt.modifiers.reputationDelta !== undefined && opt.modifiers.reputationDelta !== 0 && (
                      <span className={`${styles.modifierTag} ${opt.modifiers.reputationDelta > 0 ? styles.modifierPositive : styles.modifierNegative}`}>
                        {opt.modifiers.reputationDelta > 0 ? `+${opt.modifiers.reputationDelta}` : opt.modifiers.reputationDelta} Reputation
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Controls */}
      {!isDecided && !isExpired && scenario && (
        <div className={styles.sectionCard}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="decision-rationale">
              Executive Rationale (Optional)
            </label>
            <input
              id="decision-rationale"
              className={styles.formInput}
              type="text"
              placeholder="Record your executive reasoning for company audit history..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={200}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--cv-space-2)' }}>
            <Button
              variant="gold"
              size="lg"
              disabled={!selectedOptionId}
              loading={submitting}
              onClick={handleSubmitDecision}
              data-testid="submit-decision-button"
            >
              Submit Strategic Decision ({selectedOptionId || 'Select Option'})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
