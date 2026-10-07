import { useState, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';

export interface UseTokenRefreshResult {
  refreshToken: () => Promise<boolean>;
  isRefreshing: boolean;
  hasFailed: boolean;
}

/**
 * Hook for token refresh (POST /api/v1/auth/refresh).
 * Invokes the AuthContext refreshSession to rotate the refresh token and cycle the JWT access token.
 */
export function useTokenRefresh(): UseTokenRefreshResult {
  const { refreshSession } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hasFailed, setHasFailed] = useState<boolean>(false);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    setIsRefreshing(true);
    setHasFailed(false);
    try {
      const success = await refreshSession();
      if (!success) {
        setHasFailed(true);
      }
      return success;
    } catch {
      setHasFailed(true);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSession]);

  return {
    refreshToken,
    isRefreshing,
    hasFailed,
  };
}

export default useTokenRefresh;
