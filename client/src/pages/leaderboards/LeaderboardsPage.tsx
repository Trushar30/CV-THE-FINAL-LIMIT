import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../api/client';
import { useToast } from '../../components/ui/Toast/ToastContext';
import { Button, Spinner, EmptyState, Badge } from '../../components/ui';
import styles from './Leaderboards.module.css';

export type LeaderboardCategory =
  | 'USER_EXP'
  | 'USER_LEVEL'
  | 'USER_CORPCOIN'
  | 'USER_PERFORMANCE'
  | 'USER_FOUNDER'
  | 'COMPANY_PROFIT'
  | 'COMPANY_REVENUE'
  | 'COMPANY_WORKFORCE'
  | 'COMPANY_RETENTION'
  | 'COMPANY_RATING'
  | 'COMPANY_GROWTH'
  | 'COMPANY_LOSS_MAKING';

export interface LeaderboardItem {
  rank: number;
  entityId: string;
  name: string;
  score: number;
  domain?: string;
  careerRole?: string;
  isPlatformCompany?: boolean;
  companyRating?: number;
  secondaryMetric?: string | number;
  details?: Record<string, unknown>;
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  period: string;
  rankings: LeaderboardItem[];
  totalEntries: number;
  page: number;
  limit: number;
  totalPages: number;
  calculatedAt: string;
}

const USER_CATEGORIES: { id: LeaderboardCategory; label: string; icon: string }[] = [
  { id: 'USER_EXP', label: 'Highest EXP', icon: '⚡' },
  { id: 'USER_LEVEL', label: 'Highest Level', icon: '🏅' },
  { id: 'USER_CORPCOIN', label: 'CorpCoin Wealth', icon: '🪙' },
  { id: 'USER_PERFORMANCE', label: 'Task Performance', icon: '🎯' },
  { id: 'USER_FOUNDER', label: 'Top Founders', icon: '👑' },
];

const COMPANY_CATEGORIES: { id: LeaderboardCategory; label: string; icon: string }[] = [
  { id: 'COMPANY_PROFIT', label: 'Net Profit', icon: '📈' },
  { id: 'COMPANY_REVENUE', label: 'Total Revenue', icon: '💰' },
  { id: 'COMPANY_WORKFORCE', label: 'Largest Workforce', icon: '👥' },
  { id: 'COMPANY_RETENTION', label: 'Retention Rate', icon: '🛡️' },
  { id: 'COMPANY_RATING', label: 'Company Rating', icon: '⭐' },
  { id: 'COMPANY_GROWTH', label: 'Fastest Growing', icon: '🚀' },
  { id: 'COMPANY_LOSS_MAKING', label: 'Loss-Making List', icon: '📉' },
];

export const LeaderboardsPage: React.FC = () => {
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<'USERS' | 'COMPANIES'>('USERS');
  const [category, setCategory] = useState<LeaderboardCategory>('USER_EXP');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        category,
        page,
        limit,
      };
      if (selectedDomain !== 'ALL') {
        params.domain = selectedDomain;
      }

      const res = await apiClient.get<{ success: boolean; data: LeaderboardResponse }>('/leaderboards', {
        params,
      });

      if (res && res.data) {
        setData(res.data);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboards';
      toastError(message);
    } finally {
      setLoading(false);
    }
  }, [category, page, limit, selectedDomain, toastError]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleTabChange = (tab: 'USERS' | 'COMPANIES') => {
    setActiveTab(tab);
    setPage(1);
    if (tab === 'USERS') {
      setCategory('USER_EXP');
    } else {
      setCategory('COMPANY_PROFIT');
    }
  };

  const handleCategoryChange = (cat: LeaderboardCategory) => {
    setCategory(cat);
    setPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiClient.post('/leaderboards/refresh', { category });
      toastSuccess('Leaderboard snapshot refreshed from authoritative backend records');
      await fetchLeaderboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      toastError(message);
    } finally {
      setRefreshing(false);
    }
  };

  const currentCategories = activeTab === 'USERS' ? USER_CATEGORIES : COMPANY_CATEGORIES;
  const rankings = data?.rankings || [];
  const topThree = rankings.slice(0, 3);

  const currentUserId = user ? (user.id || (user as unknown as { userId?: string }).userId) : undefined;
  const myRankItem =
    user && activeTab === 'USERS'
      ? rankings.find(
          (r) =>
            (currentUserId && r.entityId === currentUserId) ||
            r.name === user.displayName
        )
      : null;

  return (
    <div className={styles.leaderboardContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitles}>
          <h1>Global Leaderboards</h1>
          <p>Deterministic rankings calculated strictly from stored backend database records.</p>
        </div>
        <div className={styles.headerControls}>
          {data?.calculatedAt && (
            <div className={styles.refreshMeta}>
              <span className={styles.refreshPulse} />
              <span>Snapshot: {new Date(data.calculatedAt).toLocaleTimeString()}</span>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh Cache'}
          </Button>
        </div>
      </div>

      {/* Segment Switcher (Users vs Companies) */}
      <div className={styles.segmentBar}>
        <button
          type="button"
          className={`${styles.segmentButton} ${activeTab === 'USERS' ? styles.segmentButtonActive : ''}`}
          onClick={() => handleTabChange('USERS')}
        >
          👤 Engineering Talent
        </button>
        <button
          type="button"
          className={`${styles.segmentButton} ${activeTab === 'COMPANIES' ? styles.segmentButtonActive : ''}`}
          onClick={() => handleTabChange('COMPANIES')}
        >
          🏢 Corporate Rankings
        </button>
      </div>

      {/* Category Chips Bar */}
      <div className={styles.categoryBar}>
        {currentCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.categoryChip} ${category === c.id ? styles.categoryChipActive : ''}`}
            onClick={() => handleCategoryChange(c.id)}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Domain:</span>
          <select
            className={styles.domainSelect}
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Engineering Domains</option>
            <option value="SOFTWARE_ENGINEERING">Software Engineering</option>
            <option value="CLOUD_ENGINEERING">Cloud Engineering</option>
            <option value="AI_ENGINEERING">AI Engineering</option>
          </select>
        </div>

        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Showing {rankings.length} of {data?.totalEntries || 0} entries
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : rankings.length === 0 ? (
        <EmptyState
          title="No Rankings Found"
          description="No eligible users or companies recorded yet for this category."
        />
      ) : (
        <>
          {/* Top 3 Podium Highlights (Page 1 only) */}
          {page === 1 && topThree.length > 0 && (
            <div className={styles.podiumGrid}>
              {topThree.map((item, idx) => {
                const badgeClass =
                  idx === 0
                    ? styles.badgeGold
                    : idx === 1
                    ? styles.badgeSilver
                    : styles.badgeBronze;
                const podiumClass =
                  idx === 0
                    ? styles.podiumGold
                    : idx === 1
                    ? styles.podiumSilver
                    : styles.podiumBronze;

                return (
                  <div key={item.entityId} className={`${styles.podiumCard} ${podiumClass}`}>
                    <div className={styles.podiumHeader}>
                      <span className={`${styles.rankBadge} ${badgeClass}`}>
                        {idx === 0 ? '🥇 #1 Champion' : idx === 1 ? '🥈 #2 Runner Up' : '🥉 #3 Bronze'}
                      </span>
                      {item.domain && (
                        <Badge variant="default" size="sm">
                          {item.domain.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    <div className={styles.podiumName}>{item.name}</div>
                    <div className={styles.podiumScore}>
                      {typeof item.score === 'number' ? item.score.toLocaleString() : item.score}
                    </div>
                    {item.secondaryMetric && (
                      <div className={styles.podiumSecondary}>{String(item.secondaryMetric)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* My Standing Banner */}
          {myRankItem && (
            <div className={styles.myStandingBanner} data-testid="my-standing-banner">
              <div className={styles.myStandingLeft}>
                <div className={styles.myStandingRankBadge}>#{myRankItem.rank}</div>
                <div className={styles.myStandingInfo}>
                  <h4>Your Standing in this Category</h4>
                  <p>
                    {myRankItem.name} • {myRankItem.careerRole || 'Engineer'}
                  </p>
                </div>
              </div>
              <div className={styles.myStandingStats}>
                <div className={styles.myStandingStatBlock}>
                  <span className={styles.myStandingStatLabel}>Score</span>
                  <span className={styles.myStandingStatValue}>
                    {typeof myRankItem.score === 'number'
                      ? myRankItem.score.toLocaleString()
                      : myRankItem.score}
                  </span>
                </div>
                {myRankItem.secondaryMetric && (
                  <div className={styles.myStandingStatBlock}>
                    <span className={styles.myStandingStatLabel}>Key Metric</span>
                    <span
                      className={styles.myStandingStatValue}
                      style={{ fontSize: '14px', color: '#cbd5e1' }}
                    >
                      {myRankItem.secondaryMetric}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.rankTable}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th>{activeTab === 'USERS' ? 'Engineer' : 'Company'}</th>
                    <th>Domain</th>
                    <th>Score</th>
                    <th>Key Metric</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((item) => {
                    const isMe =
                      user &&
                      activeTab === 'USERS' &&
                      ((currentUserId && item.entityId === currentUserId) ||
                        item.name === user.displayName);

                    const pillClass =
                      item.rank === 1
                        ? styles.rankPillGold
                        : item.rank === 2
                        ? styles.rankPillSilver
                        : item.rank === 3
                        ? styles.rankPillBronze
                        : '';

                    return (
                      <tr
                        key={item.entityId}
                        className={isMe ? styles.myRankRow : ''}
                        data-testid={isMe ? 'my-rank-row' : undefined}
                      >
                        <td>
                          <span className={`${styles.rankPill} ${pillClass}`}>{item.rank}</span>
                        </td>
                        <td>
                          <div className={styles.entityInfo}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span className={styles.entityName}>{item.name}</span>
                              {isMe && (
                                <span
                                  className={styles.myBadge}
                                  data-testid="my-position-badge"
                                >
                                  You
                                </span>
                              )}
                            </div>
                            {item.careerRole && (
                              <span className={styles.entitySub}>{item.careerRole}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {item.domain ? (
                            <Badge variant="default" size="sm">
                              {item.domain.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span style={{ color: '#64748b' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={styles.scoreValue}>
                            {typeof item.score === 'number' ? item.score.toLocaleString() : item.score}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#cbd5e1', fontSize: '13px' }}>
                            {item.secondaryMetric || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data && data.totalPages > 1 && (
              <div className={styles.paginationBar}>
                <div className={styles.paginationInfo}>
                  Page {data.page} of {data.totalPages} ({data.totalEntries} entries)
                </div>
                <div className={styles.paginationButtons}>
                  <button
                    type="button"
                    className={styles.pageButton}
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    className={styles.pageButton}
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
