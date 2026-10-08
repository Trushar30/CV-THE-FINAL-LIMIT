import { ApiClientError, type ApiErrorResponse, type ApiSuccessResponse } from './types';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (import.meta.env.VITE_API_URL as string | undefined) ||
      'http://localhost:5000/api/v1';
  }

  public setBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;
    const url = this.buildUrl(endpoint, params);

    const authHeaders: Record<string, string> = {};
    if (this.accessToken) {
      authHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const isFormData = typeof FormData !== 'undefined' && customConfig.body instanceof FormData;
    const defaultHeaders: Record<string, string> = isFormData
      ? {
          Accept: 'application/json',
          ...authHeaders,
          ...(headers as Record<string, string>),
        }
      : {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
          ...(headers as Record<string, string>),
        };

    const config: RequestInit = {
      ...customConfig,
      headers: defaultHeaders,
      credentials: 'include', // Includes httpOnly cookies for sessions
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      throw new ApiClientError(
        networkError instanceof Error ? networkError.message : 'Network connection failure',
        'NETWORK_ERROR',
        0,
        networkError
      );
    }

    // Try parsing JSON body
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Body is not JSON
      if (!response.ok) {
        throw new ApiClientError(
          response.statusText || 'Unexpected server error',
          'HTTP_ERROR',
          response.status
        );
      }
      return undefined as T;
    }

    // Check for normalized server error response shape
    if (!response.ok) {
      const errorPayload = body as Partial<ApiErrorResponse>;
      if (errorPayload && errorPayload.error) {
        throw new ApiClientError(
          errorPayload.error.message || 'API request failed',
          errorPayload.error.code || 'UNKNOWN_ERROR',
          response.status,
          errorPayload.error.details
        );
      }

      throw new ApiClientError(
        response.statusText || 'Request failed',
        'HTTP_ERROR',
        response.status,
        body
      );
    }

    // Server success wrapper { success: true, data: ... }
    const successPayload = body as ApiSuccessResponse<T>;
    if (successPayload && typeof successPayload === 'object' && 'data' in successPayload) {
      return successPayload.data;
    }

    return body as T;
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  public upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
