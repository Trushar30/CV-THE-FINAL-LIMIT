import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactElement,
  type ReactNode,
} from 'react';
import apiClient from '../api/client';

export type CareerRole = 'JOB_SEEKER' | 'EMPLOYEE' | 'FOUNDER' | 'NONE';
export type PlatformRole = 'NONE' | 'ADMIN' | 'AI_MANAGER';

export interface UserStub {
  id: string;
  email: string;
  displayName: string;
  domain?: 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
  careerRole: CareerRole;
  platformRole: PlatformRole;
  level: number;
  totalExpCached: number;
  corpCoinBalanceCached: number;
  activeWarningsCount?: number;
  companyName?: string;
  emailVerified?: boolean;
  status?: string;
  onboardingStep?: string;
}

export interface AuthContextValue {
  user: UserStub | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string; devVerificationUrl?: string; error?: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resendVerification: (
    email: string
  ) => Promise<{ success: boolean; message?: string; devVerificationUrl?: string; error?: string }>;
  setupProfile: (data: {
    displayName: string;
    domain: 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
    skills: string[];
    bio?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  fetchCurrentUser: () => Promise<void>;
  loginStub: (customUser?: Partial<UserStub>) => void;
  logoutStub: () => void;
  toggleAuth: () => void;
  switchCareerRole: (role: CareerRole) => void;
  switchPlatformRole: (role: PlatformRole) => void;
  setExpStub: (exp: number) => void;
  setCorpCoinStub: (coins: number) => void;
}

export function calculateLevelFromExp(exp: number): number {
  if (exp >= 16000) return 10;
  if (exp >= 12000) return 9;
  if (exp >= 9000) return 8;
  if (exp >= 6500) return 7;
  if (exp >= 4500) return 6;
  if (exp >= 3000) return 5;
  if (exp >= 2000) return 4;
  if (exp >= 1200) return 3;
  if (exp >= 500) return 2;
  return 1;
}

export function toUserStub(data: {
  id?: string;
  _id?: string;
  email: string;
  displayName?: string;
  domain?: 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
  careerRole?: CareerRole;
  platformRole?: PlatformRole;
  totalExp?: number;
  totalExpCached?: number;
  corpCoinBalance?: number;
  corpCoinBalanceCached?: number;
  activeWarningsCount?: number;
  companyName?: string;
  emailVerified?: boolean;
  status?: string;
  onboardingStep?: string;
}): UserStub {
  const totalExp = data.totalExp ?? data.totalExpCached ?? 0;
  return {
    id: data.id || data._id || 'usr_default',
    email: data.email,
    displayName: data.displayName || (data.email ? data.email.split('@')[0] : 'User') || 'User',
    domain: data.domain,
    careerRole: data.careerRole || 'JOB_SEEKER',
    platformRole: data.platformRole || 'NONE',
    level: calculateLevelFromExp(totalExp),
    totalExpCached: totalExp,
    corpCoinBalanceCached: data.corpCoinBalance ?? data.corpCoinBalanceCached ?? 0,
    activeWarningsCount: data.activeWarningsCount ?? 0,
    companyName: data.companyName,
    emailVerified: data.emailVerified,
    status: data.status,
    onboardingStep: data.onboardingStep,
  };
}

export const DEFAULT_MOCK_USER: UserStub = {
  id: 'usr_mock_123',
  email: 'alex.chen@corpverse.dev',
  displayName: 'Alex Chen',
  domain: 'SOFTWARE_ENGINEERING',
  careerRole: 'JOB_SEEKER',
  platformRole: 'NONE',
  level: 4,
  totalExpCached: 2450,
  corpCoinBalanceCached: 850,
  activeWarningsCount: 0,
  emailVerified: true,
  status: 'ACTIVE',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  initialUser?: UserStub | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps): ReactElement {
  const [user, setUser] = useState<UserStub | null>(() => {
    if (initialUser !== undefined) return initialUser;
    if (import.meta.env.MODE === 'test') return DEFAULT_MOCK_USER;
    return null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (initialUser !== undefined || import.meta.env.MODE === 'test') return false;
    return true;
  });

  // Synchronize accessToken with apiClient singleton
  const updateAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);
    apiClient.setAccessToken(token);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.post<{
        user: Parameters<typeof toUserStub>[0];
        accessToken: string;
      }>('/auth/refresh');
      if (response && response.accessToken) {
        updateAccessToken(response.accessToken);
        setUser(toUserStub(response.user));
        return true;
      }
      return false;
    } catch {
      updateAccessToken(null);
      setUser(null);
      return false;
    }
  }, [updateAccessToken]);

  // Initial bootstrap: attempt silent refresh if no initialUser was explicitly provided
  useEffect(() => {
    if (initialUser !== undefined || import.meta.env.MODE === 'test') {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    refreshSession()
      .catch(() => {
        // Unauthenticated session on initial load is expected
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialUser, refreshSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await apiClient.post<{
          user: Parameters<typeof toUserStub>[0];
          accessToken: string;
        }>('/auth/login', { email, password });

        if (response && response.accessToken) {
          updateAccessToken(response.accessToken);
          setUser(toUserStub(response.user));
          return { success: true };
        }
        return { success: false, error: 'Login response missing credentials' };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Login failed';
        return { success: false, error: message };
      }
    },
    [updateAccessToken]
  );

  const register = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{
      success: boolean;
      message: string;
      devVerificationUrl?: string;
      error?: string;
    }> => {
      try {
        const response = await apiClient.post<{
          message: string;
          email: string;
          devVerificationUrl?: string;
        }>('/auth/register', { email, password });

        return {
          success: true,
          message: response.message,
          devVerificationUrl: response.devVerificationUrl,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        return {
          success: false,
          message: '',
          error: message,
        };
      }
    },
    []
  );

  const verifyEmail = useCallback(
    async (token: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      try {
        const response = await apiClient.post<{
          message: string;
          email: string;
          onboardingStep: string;
        }>('/auth/verify-email', { token });

        return {
          success: true,
          message: response.message,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Email verification failed';
        return {
          success: false,
          error: message,
        };
      }
    },
    []
  );

  const resendVerification = useCallback(
    async (
      email: string
    ): Promise<{
      success: boolean;
      message?: string;
      devVerificationUrl?: string;
      error?: string;
    }> => {
      try {
        const response = await apiClient.post<{
          message: string;
          devVerificationUrl?: string;
        }>('/auth/resend-verification', { email });

        return {
          success: true,
          message: response.message,
          devVerificationUrl: response.devVerificationUrl,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to resend verification';
        return {
          success: false,
          error: message,
        };
      }
    },
    []
  );

  const setupProfile = useCallback(
    async (data: {
      displayName: string;
      domain: 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
      skills: string[];
      bio?: string;
      githubUrl?: string;
      linkedinUrl?: string;
      portfolioUrl?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await apiClient.post<{
          profile: {
            displayName: string;
            domain: 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
          };
          user: Parameters<typeof toUserStub>[0];
        }>('/profile/setup', data);

        if (response && response.profile) {
          setUser((prev) =>
            toUserStub({
              ...(prev || {}),
              ...response.user,
              displayName: response.profile.displayName,
              domain: response.profile.domain,
              careerRole: 'JOB_SEEKER',
              onboardingStep: 'PROFILE_COMPLETED',
            })
          );
          return { success: true };
        }
        return { success: false, error: 'Profile setup returned invalid response' };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Profile setup failed';
        return { success: false, error: message };
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout to ensure local session is cleared
    } finally {
      updateAccessToken(null);
      setUser(null);
    }
  }, [updateAccessToken]);

  const fetchCurrentUser = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get<{ user: Parameters<typeof toUserStub>[0] }>('/auth/me');
      if (response && response.user) {
        setUser(toUserStub(response.user));
      }
    } catch {
      // If /me fails, session is expired or invalid
      updateAccessToken(null);
      setUser(null);
    }
  }, [updateAccessToken]);

  // Showcase & test stubs
  const loginStub = useCallback((customUser?: Partial<UserStub>) => {
    setUser({
      ...DEFAULT_MOCK_USER,
      ...customUser,
    });
  }, []);

  const logoutStub = useCallback(() => {
    updateAccessToken(null);
    setUser(null);
  }, [updateAccessToken]);

  const toggleAuth = useCallback(() => {
    setUser((prev) => (prev ? null : DEFAULT_MOCK_USER));
  }, []);

  const switchCareerRole = useCallback((role: CareerRole) => {
    setUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        careerRole: role,
        companyName:
          role === 'FOUNDER'
            ? 'Nexus Technologies Inc.'
            : role === 'EMPLOYEE'
              ? 'Apex Systems'
              : undefined,
      };
    });
  }, []);

  const switchPlatformRole = useCallback((role: PlatformRole) => {
    setUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        platformRole: role,
      };
    });
  }, []);

  const setExpStub = useCallback((exp: number) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            totalExpCached: exp,
            level: calculateLevelFromExp(exp),
          }
        : null
    );
  }, []);

  const setCorpCoinStub = useCallback((coins: number) => {
    setUser((prev) => (prev ? { ...prev, corpCoinBalanceCached: coins } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        accessToken,
        login,
        register,
        verifyEmail,
        resendVerification,
        setupProfile,
        logout,
        refreshSession,
        fetchCurrentUser,
        loginStub,
        logoutStub,
        toggleAuth,
        switchCareerRole,
        switchPlatformRole,
        setExpStub,
        setCorpCoinStub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;
