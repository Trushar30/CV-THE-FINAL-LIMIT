import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../components/ui/Toast/ToastContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import styles from './Founder.module.css';

interface BotRosterItem {
  _id: string;
  botType: 'HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT';
  isActive: boolean;
  acquiredAt: string;
}

interface CompanyDetails {
  _id: string;
  name: string;
  status: string;
  isOpenForHiring: boolean;
  bots?: BotRosterItem[];
}

interface BotCatalogItem {
  type: 'HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT';
  title: string;
  subtitle: string;
  icon: string;
  cost: number;
  features: string[];
}

const BASIC_BOT_CATALOG: BotCatalogItem[] = [
  {
    type: 'HIRING_BOT',
    title: 'Basic Hiring Bot',
    subtitle: 'Automated ATS & Technical Screening',
    icon: '🤖',
    cost: 250,
    features: [
      'Executes candidate ATS keyword and rubric screening',
      'Conducts AI chat interview rounds via PIPELINE pool',
      'Calculates candidate stage progression recommendations',
    ],
  },
  {
    type: 'TASK_BOT',
    title: 'Basic Task Bot',
    subtitle: 'Engineering Problem Generator',
    icon: '⚡',
    cost: 250,
    features: [
      'Generates daily primary and bonus engineering challenges',
      'Aligns problem scenarios to domain and seniority level',
      'Configures maximum EXP caps (30 Easy, 60 Med, 100 Hard)',
    ],
  },
  {
    type: 'EVALUATION_BOT',
    title: 'Basic Evaluation Bot',
    subtitle: 'Code & Architectural Assessment',
    icon: '⚖️',
    cost: 250,
    features: [
      'Authoritatively evaluates employee task code submissions',
      'Computes score bands (0-100) and strict clamped EXP',
      'Delivers criterion-by-criterion rubric feedback',
    ],
  },
];

export function BotShopPage(): ReactElement {
  const { user, fetchCurrentUser } = useAuth();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [purchasingType, setPurchasingType] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [ownedBots, setOwnedBots] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ company: CompanyDetails; bots: BotRosterItem[] }>('/founder/bots');
      setCompany(res.company);

      const ownedMap: Record<string, boolean> = {};
      if (res.bots && Array.isArray(res.bots)) {
        res.bots.forEach((b) => {
          if (b.isActive) {
            ownedMap[b.botType] = true;
          }
        });
      }
      setOwnedBots(ownedMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load bot storefront';
      error(msg);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async (botType: 'HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT'): Promise<void> => {
    try {
      setPurchasingType(botType);
      await apiClient.post('/founder/bots/purchase', { botType });
      success(`${botType.replace('_', ' ')} acquired successfully!`);
      await fetchCurrentUser();
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to purchase bot';
      error(msg);
    } finally {
      setPurchasingType(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 350 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--cv-text-secondary)', marginTop: '1rem' }}>Accessing AI Bot Marketplace...</p>
      </div>
    );
  }

  const currentBalance = user?.corpCoinBalanceCached ?? 0;
  const ownedCount = Object.keys(ownedBots).length;
  const allBasicBotsOwned = Boolean(ownedBots['HIRING_BOT'] && ownedBots['TASK_BOT'] && ownedBots['EVALUATION_BOT']);

  return (
    <div className={styles.container} data-testid="bot-shop-page">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span>🛒</span> AI Workforce Storefront
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Badge variant="gold">
              🪙 Balance: {currentBalance.toLocaleString()} CC
            </Badge>
            {allBasicBotsOwned ? (
              <Badge variant="success">Open for Hiring Active</Badge>
            ) : (
              <Badge variant="default">{ownedCount} of 3 Basic Bots</Badge>
            )}
          </div>
        </div>
        <p className={styles.subtitle}>
          Acquire specialized AI workforce units to operate your company. Basic bots cost 250 CorpCoin each. A company unlocks candidate recruitment only after acquiring all 3 basic bots.
        </p>
      </div>

      {/* Hiring Status Activation Banner */}
      {allBasicBotsOwned ? (
        <div className={styles.cyanBanner} data-testid="hiring-active-banner">
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--cv-text-base)', color: 'var(--cv-accent-cyan-400)' }}>
              ✨ Complete Basic Suite Deployed: {company?.name || 'Company'} is Open for Hiring
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
              All 3 basic workforce bots (Hiring, Task, Evaluation) are active. You can now post requisitions and process job applications.
            </p>
          </div>
          <Badge variant="success">OPEN FOR HIRING</Badge>
        </div>
      ) : (
        <div className={styles.goldBanner} data-testid="hiring-inactive-banner">
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--cv-text-base)', color: 'var(--cv-gold-400)' }}>
              ⚠️ Hiring Suspended: Workforce Incomplete ({ownedCount}/3 Bots)
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-secondary)' }}>
              Purchase all 3 basic bots (750 CC total) to activate candidate intake and task generation.
            </p>
          </div>
          <Badge variant="default">HIRING LOCKED</Badge>
        </div>
      )}

      {/* Basic Bots Storefront Grid */}
      <div className={styles.botStoreGrid}>
        {BASIC_BOT_CATALOG.map((bot) => {
          const isOwned = Boolean(ownedBots[bot.type]);
          const canAfford = currentBalance >= bot.cost;
          const isBusy = purchasingType === bot.type;

          return (
            <div
              key={bot.type}
              className={`${styles.botCard} ${isOwned ? styles.botCardOwned : ''}`}
              data-testid={`bot-card-${bot.type.toLowerCase()}`}
            >
              <div>
                <div className={styles.botHeader}>
                  <div className={`${styles.botIconCircle} ${isOwned ? styles.botIconCircleOwned : ''}`}>
                    {bot.icon}
                  </div>
                  {isOwned ? (
                    <Badge variant="success">Acquired</Badge>
                  ) : (
                    <Badge variant="gold">{bot.cost} CC</Badge>
                  )}
                </div>

                <h3 className={styles.botTitle}>{bot.title}</h3>
                <span className={styles.botSubtitle}>{bot.subtitle}</span>

                <div style={{ margin: 'var(--cv-space-4) 0' }}>
                  <ul className={styles.botFeatureList}>
                    {bot.features.map((feat, idx) => (
                      <li key={idx} className={styles.botFeatureItem}>
                        <span style={{ color: isOwned ? 'var(--cv-accent-emerald-400)' : 'var(--cv-gold-400)' }}>✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className={styles.botFooter}>
                <div className={styles.botPrice}>
                  <span>🪙 {bot.cost}</span>
                  <span style={{ fontSize: 'var(--cv-text-xs)', color: 'var(--cv-text-tertiary)', fontWeight: 400 }}>CC</span>
                </div>

                {isOwned ? (
                  <Button variant="secondary" size="sm" disabled>
                    Deployed In Fleet
                  </Button>
                ) : (
                  <Button
                    variant="gold"
                    size="sm"
                    disabled={!canAfford || Boolean(purchasingType)}
                    loading={isBusy}
                    onClick={() => handlePurchase(bot.type)}
                    data-testid={`buy-bot-${bot.type.toLowerCase()}`}
                  >
                    Acquire Bot
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Advanced Bot (Locked in v1) */}
        <div className={styles.botCard} style={{ opacity: 0.65, borderStyle: 'dashed' }}>
          <div>
            <div className={styles.botHeader}>
              <div className={styles.botIconCircle} style={{ background: 'rgba(167, 139, 250, 0.15)', color: 'var(--cv-violet-400)' }}>
                🧠
              </div>
              <Badge variant="default">Coming in v2</Badge>
            </div>

            <h3 className={styles.botTitle}>Advanced Autonomous Bot</h3>
            <span className={styles.botSubtitle}>Multi-Agent Executive Strategist</span>

            <div style={{ margin: 'var(--cv-space-4) 0' }}>
              <ul className={styles.botFeatureList}>
                <li className={styles.botFeatureItem}>
                  <span>🔒</span> Bounded autonomous market operations
                </li>
                <li className={styles.botFeatureItem}>
                  <span>🔒</span> Enhanced productivity coefficient ($+15\%$)
                </li>
                <li className={styles.botFeatureItem}>
                  <span>🔒</span> Config price: 400 CorpCoin
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.botFooter}>
            <div className={styles.botPrice} style={{ color: 'var(--cv-text-tertiary)' }}>
              <span>🪙 400 CC</span>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Locked in v1
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
