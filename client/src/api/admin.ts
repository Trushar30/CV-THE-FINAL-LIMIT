import { apiClient } from './client';

export interface AdminUserListItem {
  _id: string;
  email: string;
  careerRole: string;
  platformRole: string;
  status: string;
  isSuspended: boolean;
  emailVerified: boolean;
  totalExpCached: number;
  corpCoinBalanceCached: number;
  createdAt: string;
  profile?: {
    displayName?: string;
    domain?: string;
    skills?: string[];
  } | null;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminAnalyticsDateRange {
  startDate: string;
  endDate: string;
  interval?: 'day' | 'week' | 'month';
}

export interface AdminUserAnalytics {
  totals: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
  };
  byRole: { role: string; count: number }[];
  byPlatformRole: { role: string; count: number }[];
  byDomain: { domain: string; count: number }[];
  registrationTrends: { date: string; count: number }[];
  dateRange: AdminAnalyticsDateRange;
}

export interface AdminApplicationAnalytics {
  totalApplications: number;
  byStatus: { status: string; count: number }[];
  byStage: { stage: string; count: number }[];
  rejectionReasons: { stage: string; count: number }[];
  topMissingSkills: { skill: string; count: number }[];
  dateRange: AdminAnalyticsDateRange;
}

export interface AdminTaskAnalytics {
  totalTasks: number;
  totalSubmissions: number;
  submissionRate: number;
  averageScore: number;
  scoreStats: {
    avgScore?: number;
    minScore?: number;
    maxScore?: number;
    totalEvaluations?: number;
  } | null;
  byDifficulty: { difficulty: string; count: number }[];
  byScoreBand: { band: string; count: number }[];
  dailyScoreTrend: { date: string; avgScore: number; count: number }[];
  dateRange: AdminAnalyticsDateRange;
}

export interface AdminEconomyAnalytics {
  circulation: {
    totalExpCirculation: number;
    totalCorpCoinCirculation: number;
  };
  expTransactions: { type: string; totalAmount: number; count: number }[];
  corpCoinTransactions: { type: string; totalAmount: number; count: number }[];
  dateRange: AdminAnalyticsDateRange;
}

export interface AdminCompanyAnalytics {
  companiesByStatus: { status: string; count: number }[];
  totalActiveWorkforce: number;
  financialOutcomes: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    avgDailyRevenue: number;
    avgDailyExpenses: number;
    totalSimulationDaysRecorded: number;
  };
  dateRange: AdminAnalyticsDateRange;
}

export interface AdminAiAnalytics {
  requestsByProvider: { provider: string; count: number }[];
  requestsByTaskType: { taskType: string; count: number }[];
  telemetry: {
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    totalTokens: number;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    failureRate: number;
  };
  errorSummary: { errorCode: string; count: number }[];
  liveQueueDepth: { status: string; count: number }[];
  dateRange: AdminAnalyticsDateRange;
}

export interface AuditLogItem {
  _id: string;
  actorId: string;
  actorRole: 'ADMIN' | 'AI_MANAGER';
  action: string;
  targetType: string;
  targetId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsViewerResponse {
  logs: AuditLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AiLogItem {
  _id: string;
  providerCode: string;
  taskType: string;
  pool: 'DEMO' | 'PIPELINE';
  modelId?: string;
  requestId?: string;
  promptTokens?: number;
  createdAt: string;
}

export interface AiLogsViewerResponse {
  logs: AiLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AiQueueItem {
  _id: string;
  status: string;
  pool: 'DEMO' | 'PIPELINE';
  taskType: string;
  providerPriority?: string[];
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiQueueViewerResponse {
  jobs: AiQueueItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminCompanyItem {
  _id: string;
  name: string;
  type: 'PLATFORM' | 'FOUNDER';
  status: 'ACTIVE' | 'BANKRUPT' | 'SUSPENDED';
  employeeCount: number;
  maxEmployees: number;
  companyRating: number;
  financialHealth: number;
  cumulativeRevenue?: number;
  cumulativeProfit?: number;
  domainsHired: string[];
  createdAt: string;
}

export interface AdminJobItem {
  _id: string;
  companyId: string;
  companyName?: string;
  title: string;
  domain: string;
  minLevel: number;
  maxLevel: number;
  openings: number;
  requiredSkills: string[];
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
}

export const adminApi = {
  // 1. User Management
  listUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    careerRole?: string;
    platformRole?: string;
    status?: string;
    isSuspended?: boolean;
    emailVerified?: boolean;
  }): Promise<AdminUserListResponse> => {
    const res = await apiClient.get<{ success: boolean; data: AdminUserListResponse }>('/admin/users', {
      params: params as Record<string, string | number | boolean>,
    });
    return res.data;
  },

  getUserById: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: unknown }>(`/admin/users/${id}`);
    return res.data;
  },

  updateUser: async (
    id: string,
    body: {
      email?: string;
      careerRole?: string;
      platformRole?: string;
      totalExp?: number;
      corpCoinBalance?: number;
      displayName?: string;
      domain?: string;
      skills?: string[];
      reason: string;
    }
  ) => {
    const res = await apiClient.patch<{ success: boolean; data: unknown }>(`/admin/users/${id}`, body);
    return res.data;
  },

  suspendUser: async (id: string, reason: string) => {
    const res = await apiClient.post<{ success: boolean; data: unknown }>(`/admin/users/${id}/suspend`, {
      reason,
    });
    return res.data;
  },

  restoreUser: async (id: string, reason: string) => {
    const res = await apiClient.post<{ success: boolean; data: unknown }>(`/admin/users/${id}/restore`, {
      reason,
    });
    return res.data;
  },

  deleteUser: async (id: string, confirmation: 'CONFIRM_DELETE_USER', reason: string) => {
    const res = await apiClient.delete<{ success: boolean; data: unknown }>(`/admin/users/${id}`, {
      body: JSON.stringify({ confirmation, reason }),
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
  },

  // 2. PlatformConfig Governance
  getConfig: async (): Promise<Record<string, unknown>> => {
    const res = await apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/admin/config');
    return res.data;
  },

  getConfigSection: async (section: string): Promise<Record<string, unknown>> => {
    const res = await apiClient.get<{ success: boolean; data: Record<string, unknown> }>(
      `/admin/config/sections/${section}`
    );
    return res.data;
  },

  updateConfigSection: async (
    section: string,
    payload: Record<string, unknown>,
    reason: string
  ): Promise<Record<string, unknown>> => {
    const res = await apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(
      `/admin/config/sections/${section}`,
      { payload, reason }
    );
    return res.data;
  },

  // 3. Company & Job Management
  getCompanies: async (params?: { page?: number; limit?: number }): Promise<AdminCompanyItem[]> => {
    const res = await apiClient.get<{ success: boolean; data: AdminCompanyItem[] }>('/companies', {
      params: params as Record<string, string | number>,
    });
    return res.data;
  },

  deleteCompany: async (id: string, confirmation: 'CONFIRM_DELETE_COMPANY', reason: string) => {
    const res = await apiClient.delete<{ success: boolean; data: unknown }>(`/admin/companies/${id}`, {
      body: JSON.stringify({ confirmation, reason }),
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
  },

  getJobs: async (params?: { page?: number; limit?: number }): Promise<AdminJobItem[]> => {
    const res = await apiClient.get<{ success: boolean; data: AdminJobItem[] }>('/jobs', {
      params: params as Record<string, string | number>,
    });
    return res.data;
  },

  createJob: async (body: {
    companyId: string;
    domain: string;
    title: string;
    description: string;
    requiredSkills: string[];
    openings: number;
    minLevel: number;
    maxLevel: number;
    reason: string;
  }) => {
    const res = await apiClient.post<{ success: boolean; data: unknown }>('/admin/jobs', body);
    return res.data;
  },

  updateJob: async (
    id: string,
    body: {
      title?: string;
      description?: string;
      requiredSkills?: string[];
      openings?: number;
      status?: 'OPEN' | 'CLOSED';
      reason: string;
    }
  ) => {
    const res = await apiClient.patch<{ success: boolean; data: unknown }>(`/admin/jobs/${id}`, body);
    return res.data;
  },

  deleteJob: async (id: string, reason: string) => {
    const res = await apiClient.delete<{ success: boolean; data: unknown }>(`/admin/jobs/${id}`, {
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
  },

  resetEconomy: async (body: {
    confirmation: 'CONFIRM_RESET_ECONOMY';
    scope?: 'ALL' | 'USER';
    targetUserId?: string;
    reason: string;
  }) => {
    const res = await apiClient.post<{ success: boolean; data: unknown }>('/admin/economy/reset', body);
    return res.data;
  },

  // 4. Analytics & Telemetry
  getUserAnalytics: async (params?: { startDate?: string; endDate?: string }): Promise<AdminUserAnalytics> => {
    const res = await apiClient.get<{ success: boolean; data: AdminUserAnalytics }>(
      '/admin/analytics/users',
      { params }
    );
    return res.data;
  },

  getApplicationAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<AdminApplicationAnalytics> => {
    const res = await apiClient.get<{ success: boolean; data: AdminApplicationAnalytics }>(
      '/admin/analytics/applications',
      { params }
    );
    return res.data;
  },

  getTaskAnalytics: async (params?: { startDate?: string; endDate?: string }): Promise<AdminTaskAnalytics> => {
    const res = await apiClient.get<{ success: boolean; data: AdminTaskAnalytics }>(
      '/admin/analytics/tasks',
      { params }
    );
    return res.data;
  },

  getEconomyAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<AdminEconomyAnalytics> => {
    const res = await apiClient.get<{ success: boolean; data: AdminEconomyAnalytics }>(
      '/admin/analytics/economy',
      { params }
    );
    return res.data;
  },

  getCompanyAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<AdminCompanyAnalytics> => {
    const res = await apiClient.get<{ success: boolean; data: AdminCompanyAnalytics }>(
      '/admin/analytics/companies',
      { params }
    );
    return res.data;
  },

  getAiAnalytics: async (params?: { startDate?: string; endDate?: string }): Promise<AdminAiAnalytics> => {
    const res = await apiClient.get<{ success: boolean; data: AdminAiAnalytics }>('/admin/analytics/ai', {
      params,
    });
    return res.data;
  },

  // 5. Paginated Viewers
  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    actorId?: string;
    actorRole?: string;
    action?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditLogsViewerResponse> => {
    const res = await apiClient.get<{ success: boolean; data: AuditLogsViewerResponse }>(
      '/admin/analytics/audit-logs',
      { params: params as Record<string, string | number> }
    );
    return res.data;
  },

  getAiLogs: async (params?: {
    page?: number;
    limit?: number;
    providerCode?: string;
    taskType?: string;
    pool?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<AiLogsViewerResponse> => {
    const res = await apiClient.get<{ success: boolean; data: AiLogsViewerResponse }>(
      '/admin/analytics/ai-logs',
      { params: params as Record<string, string | number | boolean> }
    );
    return res.data;
  },

  getAiQueue: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    pool?: string;
    taskType?: string;
  }): Promise<AiQueueViewerResponse> => {
    const res = await apiClient.get<{ success: boolean; data: AiQueueViewerResponse }>(
      '/admin/analytics/ai-queue',
      { params: params as Record<string, string | number> }
    );
    return res.data;
  },
};
